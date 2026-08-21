import 'dotenv/config'; // Must be first — loads .env before any process.env reads
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const require = createRequire(import.meta.url);
const pdfParseRaw = require('pdf-parse');
const pdfParse = typeof pdfParseRaw === 'function' ? pdfParseRaw : (pdfParseRaw?.default || pdfParseRaw);

let Tesseract: any = null;
try {
  const tesseractRaw = require('tesseract.js');
  Tesseract = tesseractRaw?.default || tesseractRaw;
} catch (e) {
  console.warn('[OCR] Notice: tesseract.js not loaded:', e);
}

// Load global configuration defaults from systemConfig.json
let systemDefaults: Record<string, any> = {
  fuzzyMatchThreshold: 0.70,
  maxMultiFilesClassify: 10,
  extractionMaxWords: 200000,
  defaultLlmProvider: 'gemini',
  defaultLlmModelId: 'gemini-3.6-flash',
  defaultLlmBaseUrl: 'https://api.openai.com/v1',
  defaultOcrEngine: 'tesseract',
  defaultDatabaseUrl: 'sqlite:./audit_os.db',
  leadAuditReviewerName: 'David Vance, CPA, CIA',
  leadAuditReviewerTitle: 'Authorized Audit Partner',
};

try {
  const configFilePath = path.join(process.cwd(), 'src', 'config', 'systemConfig.json');
  if (fs.existsSync(configFilePath)) {
    const raw = fs.readFileSync(configFilePath, 'utf-8');
    systemDefaults = { ...systemDefaults, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('[Config] Notice: Using fallback system defaults:', e);
}

/**
 * Parse an OpenAI-compatible API response that may be either:
 *   - Standard JSON:  { choices: [{ message: { content: "..." } }] }
 *   - SSE stream:     data: {"id":"...","choices":[{"delta":{"content":"..."}}]}\n\ndata: [DONE]
 */
async function parseOpenAIResponse(apiRes: Response): Promise<string> {
  const rawText = await apiRes.text();

  // Detect SSE stream format
  if (rawText.trimStart().startsWith('data:')) {
    let fullContent = '';
    const lines = rawText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonPart = trimmed.slice(5).trim();
      if (jsonPart === '[DONE]') break;
      try {
        const chunk = JSON.parse(jsonPart);
        const delta = chunk.choices?.[0]?.delta?.content;
        const msg = chunk.choices?.[0]?.message?.content;
        if (delta != null) fullContent += delta;
        else if (msg != null) fullContent += msg;
      } catch {
        // Skip malformed SSE lines
      }
    }
    return fullContent;
  }

  // Standard JSON response
  try {
    const parsed = JSON.parse(rawText);
    return parsed.choices?.[0]?.message?.content || '{}';
  } catch {
    throw new Error(`OpenAI-compatible API returned unparseable response: ${rawText.slice(0, 300)}`);
  }
}

/**
 * Robust fetch wrapper with automatic retries and exponential backoff
 * for handling transient upstream Cloudflare / OpenAI 5xx, 429, or gateway dropped connections.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelayMs = 1500
): Promise<Response> {
  let lastError: any = null;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      // Handle transient server / gateway errors
      if (res.status >= 500 || res.status === 429) {
        const bodyText = await res.text();
        console.warn(`[API Retry] Attempt ${attempt}/${maxRetries} to ${url} returned status ${res.status}: ${bodyText.slice(0, 150)}. Retrying in ${delay}ms...`);
        if (attempt === maxRetries) {
          throw new Error(`API error ${res.status}: ${bodyText}`);
        }
      } else if (!res.ok) {
        const bodyText = await res.text();
        // Check if upstream gateway returned HTML 520/502/503/504 wrapped in a 400 response
        if (
          bodyText.includes('520:') ||
          bodyText.includes('502:') ||
          bodyText.includes('503:') ||
          bodyText.includes('504:') ||
          bodyText.includes('rate_limit') ||
          bodyText.includes('Cloudflare')
        ) {
          console.warn(`[API Retry] Upstream transient error in attempt ${attempt}/${maxRetries}: ${bodyText.slice(0, 150)}. Retrying in ${delay}ms...`);
          if (attempt === maxRetries) {
            throw new Error(`API error ${res.status}: ${bodyText}`);
          }
        } else {
          // Standard client 4xx error (invalid token or payload), do not retry
          throw new Error(`API error ${res.status}: ${bodyText}`);
        }
      } else {
        return res;
      }
    } catch (err: any) {
      lastError = err;
      if (attempt === maxRetries) {
        throw lastError;
      }
      console.warn(`[API Retry] Attempt ${attempt}/${maxRetries} failed with network error (${err.message}). Retrying in ${delay}ms...`);
    }

    await new Promise(r => setTimeout(r, delay));
    delay *= 2;
  }

  throw lastError || new Error('Fetch retries exhausted');
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory runtime config cache initialized from env or systemDefaults
let runtimeConfig = {
  llmProvider: process.env.LLM_PROVIDER || systemDefaults.defaultLlmProvider,
  llmBaseUrl: process.env.LLM_BASE_URL || systemDefaults.defaultLlmBaseUrl,
  llmModelId: process.env.LLM_MODEL_ID || systemDefaults.defaultLlmModelId,
  llmApiKey: process.env.LLM_API_KEY || '',
  ocrEngine: process.env.OCR_ENGINE || systemDefaults.defaultOcrEngine,
  databaseUrl: process.env.DATABASE_URL || systemDefaults.defaultDatabaseUrl,
  fuzzyMatchThreshold: parseFloat(process.env.FUZZY_MATCH_THRESHOLD || '') || systemDefaults.fuzzyMatchThreshold || 0.70,
  maxMultiFilesClassify: parseInt(process.env.MAX_MULTI_FILES_CLASSIFY || '', 10) || systemDefaults.maxMultiFilesClassify || 10,
  extractionMaxWords: parseInt(process.env.EXTRACTION_MAX_WORDS || '', 10) || systemDefaults.extractionMaxWords || 200000,
  reviewerName: process.env.VITE_LEAD_AUDIT_REVIEWER_NAME || systemDefaults.leadAuditReviewerName,
  reviewerTitle: process.env.VITE_LEAD_AUDIT_REVIEWER_TITLE || systemDefaults.leadAuditReviewerTitle,
};

// Startup diagnostics
console.log('[Config] LLM Provider         :', runtimeConfig.llmProvider);
console.log('[Config] LLM Base URL         :', runtimeConfig.llmBaseUrl);
console.log('[Config] LLM Model            :', runtimeConfig.llmModelId);
console.log('[Config] LLM API Key Set      :', runtimeConfig.llmApiKey ? `YES (${runtimeConfig.llmApiKey.slice(0, 8)}...)` : 'NO');
console.log('[Config] GEMINI Key Set       :', process.env.GEMINI_API_KEY ? 'YES' : 'NO');
console.log('[Config] Fuzzy Match Threshold:', runtimeConfig.fuzzyMatchThreshold);
console.log('[Config] Extraction MaxWords  :', runtimeConfig.extractionMaxWords);

// Lazy initialization of Gemini client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ------------------- API ROUTES ------------------- //

// 1. System Config Endpoints
app.get('/api/system/config', (req, res) => {
  res.json({
    llmProvider: runtimeConfig.llmProvider,
    llmBaseUrl: runtimeConfig.llmBaseUrl,
    llmModelId: runtimeConfig.llmModelId,
    llmApiKeyConfigured: Boolean(runtimeConfig.llmApiKey || process.env.LLM_API_KEY),
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    ocrEngine: runtimeConfig.ocrEngine,
    databaseUrl: runtimeConfig.databaseUrl,
    fuzzyMatchThreshold: runtimeConfig.fuzzyMatchThreshold,
    maxMultiFilesClassify: runtimeConfig.maxMultiFilesClassify,
    reviewerName: runtimeConfig.reviewerName,
    reviewerTitle: runtimeConfig.reviewerTitle,
  });
});

app.post('/api/system/config', (req, res) => {
  const {
    llmProvider,
    llmBaseUrl,
    llmModelId,
    llmApiKey,
    ocrEngine,
    databaseUrl,
    fuzzyMatchThreshold,
    maxMultiFilesClassify,
    reviewerName,
    reviewerTitle,
  } = req.body;

  if (llmProvider) runtimeConfig.llmProvider = llmProvider;
  if (llmBaseUrl) runtimeConfig.llmBaseUrl = llmBaseUrl;
  if (llmModelId) runtimeConfig.llmModelId = llmModelId;
  if (llmApiKey !== undefined) runtimeConfig.llmApiKey = llmApiKey;
  if (ocrEngine) runtimeConfig.ocrEngine = ocrEngine;
  if (databaseUrl) runtimeConfig.databaseUrl = databaseUrl;
  if (typeof fuzzyMatchThreshold === 'number') runtimeConfig.fuzzyMatchThreshold = fuzzyMatchThreshold;
  if (typeof maxMultiFilesClassify === 'number') runtimeConfig.maxMultiFilesClassify = maxMultiFilesClassify;
  if (reviewerName) runtimeConfig.reviewerName = reviewerName;
  if (reviewerTitle) runtimeConfig.reviewerTitle = reviewerTitle;

  res.json({ status: 'success', config: runtimeConfig });
});

// App general metadata endpoint
app.get('/api/config', (req, res) => {
  res.json({
    reviewerName: runtimeConfig.reviewerName,
    reviewerTitle: runtimeConfig.reviewerTitle,
    fuzzyMatchThreshold: runtimeConfig.fuzzyMatchThreshold,
    maxMultiFilesClassify: runtimeConfig.maxMultiFilesClassify,
  });
});

// 2. Document Text Extraction Endpoint (Native PDF Parse / Page Number Delineation)
app.post('/api/document/parse', async (req, res) => {
  try {
    const { filename, base64Data, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    let extractedText = '';
    let pageCount = 1;
    let isDigitalPdfBypassedOcr = false;

    if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
      try {
        const uint8Data = new Uint8Array(buffer);

        // Support pdf-parse v2
        if (pdfParseRaw?.PDFParse) {
          const parser = new pdfParseRaw.PDFParse(uint8Data);
          const pdfResult = await parser.getText();
          extractedText = pdfResult.text || '';
          pageCount = pdfResult.numpages || 1;
        } else if (typeof pdfParse === 'function') {
          // Support pdf-parse v1 with page-rendering hook if available
          let pageNum = 0;
          const pagerOptions = {
            pagerender: function (pageData: any) {
              pageNum++;
              return pageData.getTextContent().then(function (textContent: any) {
                let lastY, text = '';
                for (let item of textContent.items) {
                  if (lastY == item.transform[5] || !lastY) {
                    text += item.str;
                  } else {
                    text += '\n' + item.str;
                  }
                  lastY = item.transform[5];
                }
                return `\n--- [Page ${pageNum}] ---\n` + text;
              });
            }
          };

          try {
            const parsedPdf = await pdfParse(buffer, pagerOptions);
            extractedText = parsedPdf.text || '';
            pageCount = parsedPdf.numpages || 1;
          } catch (pagerErr) {
            // Fallback to plain parse
            const parsedPdf = await pdfParse(buffer);
            extractedText = parsedPdf.text || '';
            pageCount = parsedPdf.numpages || 1;
          }
        }

        const bodyTextOnly = extractedText
          .replace(/-- \d+ of \d+ --/g, '')
          .replace(/--- \[Page \d+\] ---/g, '')
          .trim();

        if (bodyTextOnly.length > 20) {
          isDigitalPdfBypassedOcr = true;
          if (!extractedText.includes('--- [Page')) {
            extractedText = `--- [Page 1] ---\n` + extractedText;
          }
          console.log(`[PDF Parse] Successfully extracted ${bodyTextOnly.length} chars from digital PDF "${filename}" (${pageCount} pages)`);
        } else {
          console.log(`[PDF Parse] Digital text empty in "${filename}". Triggering OCR engine: ${runtimeConfig.ocrEngine}...`);
          extractedText = '';
        }
      } catch (pdfErr: any) {
        console.warn(`[PDF Parse] Error parsing PDF "${filename}":`, pdfErr.message);
        extractedText = '';
      }
    }

    // Fallback OCR or text simulation
    if (!extractedText.trim()) {
      let ocrSucceeded = false;

      if (Tesseract && (mimeType.startsWith('image/') || filename.match(/\.(png|jpg|jpeg|tiff)$/i) || filename.toLowerCase().endsWith('.pdf'))) {
        try {
          let imageBufferToOcr: Buffer | null = null;
          if (mimeType.startsWith('image/') || filename.match(/\.(png|jpg|jpeg|tiff)$/i)) {
            imageBufferToOcr = buffer;
          } else if (filename.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf') {
            // Extract embedded JPEG stream from PDF
            const startMarker = Buffer.from([0xFF, 0xD8]);
            const endMarker = Buffer.from([0xFF, 0xD9]);
            const startIdx = buffer.indexOf(startMarker);
            const endIdx = buffer.indexOf(endMarker, startIdx);
            if (startIdx !== -1 && endIdx !== -1) {
              imageBufferToOcr = buffer.subarray(startIdx, endIdx + 2);
            }
          }

          if (imageBufferToOcr) {
            console.log(`[OCR] Running Tesseract.js recognition for "${filename}" (${imageBufferToOcr.length} image bytes)...`);
            const tesseractResult = await Tesseract.recognize(imageBufferToOcr, 'eng');
            const recognized = tesseractResult?.data?.text || '';
            if (recognized.trim().length > 10) {
              extractedText = `--- [Page 1] ---\n` + recognized;
              ocrSucceeded = true;
              console.log(`[OCR] Tesseract OCR successfully extracted ${recognized.trim().length} chars from "${filename}".`);
            }
          }
        } catch (ocrErr: any) {
          console.warn(`[OCR] Tesseract OCR error for "${filename}":`, ocrErr.message);
        }
      }

      if (!ocrSucceeded && !extractedText.trim()) {
        if (mimeType === 'text/csv' || filename.endsWith('.csv')) {
          extractedText = `--- [Page 1] ---\n` + buffer.toString('utf-8');
        } else {
          extractedText = `--- [Page 1] ---\n` + buffer.toString('utf-8').slice(0, 5000);
        }
      }
    }

    return res.json({
      filename,
      extractedText,
      pageCount,
      isDigitalPdfBypassedOcr,
      ocrEngineUsed: isDigitalPdfBypassedOcr ? 'Native PDF Text Parser (OCR Bypassed)' : runtimeConfig.ocrEngine,
    });
  } catch (err: any) {
    console.error('Document parse error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse document' });
  }
});

// Helper for levenshtein / fuzzy string similarity
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  if (s2.length >= 4 && (s1.includes(s2) || s2.includes(s1))) return 0.85;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  const dist = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return Math.max(0, 1 - dist / maxLen);
}

const CLASSIFICATION_TARGETS: Record<string, string[]> = {
  invoice: ['invoice', 'bill', 'tax invoice', 'commercial invoice', 'sales invoice'],
  purchase_order: ['po', 'purchase order', 'procurement order', 'po document', 'order requisition'],
  bank_statement: ['bank statement', 'account statement', 'passbook', 'opening balance', 'bank summary'],
  general_ledger: ['general ledger', 'gl ledger', 'gl account', 'ledger report', 'journal ledger'],
  goods_receipt: ['grn', 'goods receipt', 'delivery note', 'receiving slip', 'delivery receipt'],
  payment_voucher: ['payment voucher', 'remittance advice', 'payment advice', 'remittance', 'disbursement'],
  payroll_register: ['payroll', 'salary register', 'pay stub', 'payslip', 'payroll summary'],
  vendor_master: ['vendor master', 'supplier master', 'vendor list', 'vendor directory'],
  cash_register: ['cash register', 'cash book', 'cash receipt', 'petty cash', 'till report']
};

// 3. Document Classification Endpoint with Configurable Fuzzy Threshold & Multi-File Awareness
app.post('/api/document/classify', async (req, res) => {
  try {
    const {
      filename,
      sampleText,
      targetDocuments = [],
      maxWords = 5000,
      fuzzyMatchThreshold,
    } = req.body;

    const cleanFilename = (filename || '').trim();
    const fullText = (sampleText || '').trim();
    const activeThreshold = typeof fuzzyMatchThreshold === 'number'
      ? fuzzyMatchThreshold
      : runtimeConfig.fuzzyMatchThreshold;

    let activeTargets: Record<string, string[]> = {};
    const multiFileEligibleTargets: string[] = [];

    if (Array.isArray(targetDocuments) && targetDocuments.length > 0) {
      targetDocuments.forEach((doc: { type: string; name: string; description?: string; allowMultiple?: boolean }) => {
        const typeKey = doc.type;
        const nameSynonym = doc.name.toLowerCase();
        const synonyms = [typeKey, nameSynonym, typeKey.replace(/_/g, ' ')];
        if (CLASSIFICATION_TARGETS[typeKey]) {
          synonyms.push(...CLASSIFICATION_TARGETS[typeKey]);
        }
        activeTargets[typeKey] = Array.from(new Set(synonyms));
        if (doc.allowMultiple) {
          multiFileEligibleTargets.push(typeKey);
        }
      });
    } else {
      activeTargets = CLASSIFICATION_TARGETS;
    }

    // Step 1: Deterministic Fuzzy Matching on Filename
    const filenameNoExt = cleanFilename.replace(/\.[^/.]+$/, '');
    let bestMatchCategory = 'unknown';
    let maxMatchScore = 0;

    for (const [targetKey, synonyms] of Object.entries(activeTargets)) {
      for (const synonym of synonyms) {
        const score = calculateSimilarity(filenameNoExt, synonym);
        if (score > maxMatchScore) {
          maxMatchScore = score;
          bestMatchCategory = targetKey;
        }
      }
    }

    if (maxMatchScore >= activeThreshold) {
      console.log(`[Classify Endpoint] Deterministic Fuzzy Match SUCCEEDED: "${cleanFilename}" -> "${bestMatchCategory}" (Score: ${maxMatchScore.toFixed(2)} >= Threshold ${activeThreshold.toFixed(2)})`);
      return res.json({
        classifiedType: bestMatchCategory,
        confidence: Number(maxMatchScore.toFixed(2)),
        method: 'deterministic_fuzzy',
        thinking: `Matched filename "${cleanFilename}" to required document category "${bestMatchCategory}" using fuzzy similarity score ${maxMatchScore.toFixed(2)} (threshold: ${activeThreshold.toFixed(2)}).`
      });
    }

    console.log(`[Classify Endpoint] Fuzzy score (${maxMatchScore.toFixed(2)}) below threshold (${activeThreshold.toFixed(2)}). Invoking LLM classification for "${cleanFilename}"...`);

    // Step 2: Fallback to LLM Classification with Multi-File Context
    const cappedText = fullText.split(/\s+/).slice(0, maxWords).join(' ');
    const validTargetsList = Object.keys(activeTargets).concat(['supporting_document']);
    const validTargetsStr = validTargetsList.join(', ');

    const prompt = `You are an expert document classification AI for financial, procurement, and auditing operating systems.

DOCUMENT METADATA:
Filename: ${cleanFilename}

DOCUMENT CONTENT PREVIEW (Capped to max ${maxWords} words):
"""
${cappedText.length > 0 ? cappedText : '[No text extracted]'}
"""

ACTIVE AUDIT MODULE SCOPED CLASSIFICATION TARGETS:
[${validTargetsStr}]

MULTI-FILE ENABLED CATEGORIES IN THIS AUDIT MODULE:
[${multiFileEligibleTargets.length > 0 ? multiFileEligibleTargets.join(', ') : 'None explicitly declared'}]

TASK INSTRUCTIONS:
1. Examine the document filename, headers, financial tables, account terms, dates, and layouts.
2. Note: A single audit category may receive MULTIPLE related documents (such as multiple monthly bank statements, ledger exports, invoices, or supporting evidence attachments).
3. First, think step-by-step and provide your detailed reasoning explaining key clues found in the content or filename.
4. Select the single best classification target from the ACTIVE AUDIT TARGETS list above. If none clearly match, select "supporting_document".
5. Assign a confidence score between 0.00 and 1.00.

You MUST respond strictly with a single JSON object in the following structure:
{
  "thinking": "<Your step-by-step reasoning and content observations>",
  "decision": "<one of the valid targets from ACTIVE AUDIT TARGETS>",
  "confidence": <number between 0.00 and 1.00>
}`;

    let thinking = `Deterministic match score was (${maxMatchScore.toFixed(2)} < threshold ${activeThreshold.toFixed(2)}). Evaluated content using LLM.`;
    let classifiedType = bestMatchCategory !== 'unknown' ? bestMatchCategory : 'supporting_document';
    let confidence = 0.80;

    if (runtimeConfig.llmProvider === 'openai_compatible' && (runtimeConfig.llmApiKey || process.env.LLM_API_KEY)) {
      const classifyApiKey = runtimeConfig.llmApiKey || process.env.LLM_API_KEY || '';
      let classifyUrl = `${runtimeConfig.llmBaseUrl.replace(/\/$/, '')}/chat/completions`;
      if (classifyUrl.includes('localhost')) {
        classifyUrl = classifyUrl.replace('localhost', '127.0.0.1');
      }

      try {
        const apiRes = await fetchWithRetry(classifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${classifyApiKey}`
          },
          body: JSON.stringify({
            model: runtimeConfig.llmModelId || 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            stream: false,
          }),
        });

        if (apiRes.ok) {
          const classifyContent = await parseOpenAIResponse(apiRes);
          if (classifyContent) {
            const cleaned = classifyContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
            try {
              const parsed = JSON.parse(cleaned);
              thinking = parsed.thinking || thinking;
              classifiedType = parsed.decision || classifiedType;
              confidence = typeof parsed.confidence === 'number' ? parsed.confidence : confidence;
            } catch (e) {
              console.warn('[Classify] LLM response JSON parse failed:', cleaned.slice(0, 200));
            }
          }
        }
      } catch (err: any) {
        console.warn(`[Classify] Classification API call failed after retries:`, err.message);
      }
    } else {
      const ai = getGeminiClient();
      if (ai) {
        const modelName = runtimeConfig.llmModelId.startsWith('gemini') ? runtimeConfig.llmModelId : 'gemini-3.6-flash';
        const geminiRes = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const rawContent = geminiRes.text || '{}';
        const cleaned = rawContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          thinking = parsed.thinking || thinking;
          classifiedType = parsed.decision || classifiedType;
          confidence = typeof parsed.confidence === 'number' ? parsed.confidence : confidence;
        } catch (e) {
          console.warn('[Classify] Gemini JSON parse failed:', cleaned.slice(0, 200));
        }
      }
    }

    res.json({
      classifiedType,
      confidence,
      method: 'llm_classifier',
      thinking
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to recursively normalize schema node into ExtractedFieldNode
function normalizeFieldNode(
  rawNode: any,
  schemaProp: any,
  fieldKey: string,
  docCount: number,
  fallbackDocName?: string
): { node: any; cleanVal: any } {
  // If rawNode is a primitive or null
  const isDirectPrimitive = typeof rawNode !== 'object' || rawNode === null || Array.isArray(rawNode);
  const rawObj = isDirectPrimitive ? { value: rawNode } : (rawNode || {});

  let value = rawObj.value !== undefined ? rawObj.value : (isDirectPrimitive ? rawNode : null);
  let status = rawObj.extraction_status || (value !== null && value !== undefined && value !== 'Not Found' ? 'success' : 'data_not_found');
  let cot = rawObj.chain_of_thought || rawObj.reasoning || rawObj.thought_process || rawObj.field_reasoning || '';
  let rawEvidences = Array.isArray(rawObj.evidences) ? rawObj.evidences : (rawObj.rawSnippet || rawObj.evidence ? [{ evidence_text: rawObj.rawSnippet || rawObj.evidence, page_number: rawObj.sourcePage || 1, document_name: rawObj.sourceDocument || fallbackDocName }] : []);

  // Format evidences list
  const formattedEvidences = rawEvidences.map((ev: any) => {
    if (typeof ev === 'string') {
      return { evidence_text: ev, page_number: 1, ...(docCount > 1 && fallbackDocName ? { document_name: fallbackDocName } : {}) };
    }
    return {
      evidence_text: ev.evidence_text || ev.snippet || ev.text || '',
      page_number: typeof ev.page_number === 'number' ? ev.page_number : (typeof ev.page === 'number' ? ev.page : 1),
      ...(docCount > 1 && (ev.document_name || ev.document_id || fallbackDocName) ? { document_name: ev.document_name || ev.document_id || fallbackDocName } : (ev.document_name ? { document_name: ev.document_name } : {}))
    };
  });

  // If schema indicates object type and value is a nested dictionary
  if (schemaProp?.type === 'object' && schemaProp.properties) {
    const nestedNodes: Record<string, any> = {};
    const nestedClean: Record<string, any> = {};
    const childRaw = (typeof value === 'object' && value !== null && !Array.isArray(value)) ? value : {};

    for (const [subKey, subProp] of Object.entries(schemaProp.properties) as [string, any][]) {
      const subRawVal = childRaw[subKey] || childRaw[subKey.toLowerCase()];
      const { node: subNode, cleanVal: subClean } = normalizeFieldNode(subRawVal, subProp, subKey, docCount, fallbackDocName);
      nestedNodes[subKey] = subNode;
      nestedClean[subKey] = subClean;
    }

    return {
      node: {
        field_key: fieldKey,
        field_label: schemaProp.title || schemaProp.label || fieldKey,
        value: nestedNodes,
        chain_of_thought: cot || `Extracted object structure for ${fieldKey}.`,
        extraction_status: status,
        evidences: formattedEvidences,
        is_user_verified: Boolean(rawObj.is_user_verified),
        confidence: typeof rawObj.confidence === 'number' ? rawObj.confidence : (status === 'success' ? 0.95 : 0.0),
      },
      cleanVal: nestedClean
    };
  }

  // If schema indicates array type (e.g. line items or transaction records)
  if (schemaProp?.type === 'array' && schemaProp.items) {
    const itemProp = schemaProp.items;
    const arrayItems = Array.isArray(value) ? value : [];
    const normalizedArrayNodes: any[] = [];
    const cleanArrayVals: any[] = [];

    arrayItems.forEach((itemVal: any, itemIdx: number) => {
      if (itemProp.type === 'object' && itemProp.properties) {
        const itemNodeMap: Record<string, any> = {};
        const itemCleanMap: Record<string, any> = {};
        const itemObj = (typeof itemVal === 'object' && itemVal !== null) ? itemVal : {};

        for (const [propK, propDef] of Object.entries(itemProp.properties) as [string, any][]) {
          const rawPropVal = itemObj[propK];
          const { node: pNode, cleanVal: pClean } = normalizeFieldNode(rawPropVal, propDef, propK, docCount, fallbackDocName);
          itemNodeMap[propK] = pNode;
          itemCleanMap[propK] = pClean;
        }

        normalizedArrayNodes.push(itemNodeMap);
        cleanArrayVals.push(itemCleanMap);
      } else {
        const { node: pNode, cleanVal: pClean } = normalizeFieldNode(itemVal, itemProp, `item_${itemIdx}`, docCount, fallbackDocName);
        normalizedArrayNodes.push(pNode);
        cleanArrayVals.push(pClean);
      }
    });

    const arrayEvidences = (formattedEvidences && formattedEvidences.length > 0)
      ? formattedEvidences
      : (fallbackDocName ? [{
          document_name: fallbackDocName,
          page_number: 1,
          evidence_text: `Extracted ${normalizedArrayNodes.length} transaction / record entries from table in ${fallbackDocName}.`
        }] : []);

    return {
      node: {
        field_key: fieldKey,
        field_label: schemaProp.title || schemaProp.label || fieldKey,
        value: normalizedArrayNodes,
        chain_of_thought: cot || `Extracted ${normalizedArrayNodes.length} list entries.`,
        extraction_status: status,
        evidences: arrayEvidences,
        is_user_verified: Boolean(rawObj.is_user_verified),
        confidence: typeof rawObj.confidence === 'number' ? rawObj.confidence : (status === 'success' ? 0.95 : 0.0),
        sourceDocument: arrayEvidences[0]?.document_name || fallbackDocName || 'Document',
        sourcePage: arrayEvidences[0]?.page_number || 1
      },
      cleanVal: cleanArrayVals
    };
  }

  // Primitive scalar conversion
  let finalVal = value;
  if (schemaProp?.type === 'number' || schemaProp?.type === 'integer') {
    if (typeof finalVal === 'string') {
      const cleanedNum = finalVal.replace(/[^0-9.-]/g, '');
      const parsedNum = parseFloat(cleanedNum);
      if (!isNaN(parsedNum)) finalVal = parsedNum;
    }
  } else if (schemaProp?.type === 'boolean') {
    if (typeof finalVal === 'string') {
      finalVal = finalVal.toLowerCase() === 'true' || finalVal.toLowerCase() === 'yes';
    }
  }

  return {
    node: {
      field_key: fieldKey,
      field_label: schemaProp?.title || schemaProp?.label || fieldKey,
      value: finalVal,
      chain_of_thought: cot,
      extraction_status: status,
      evidences: formattedEvidences,
      is_user_verified: Boolean(rawObj.is_user_verified),
      confidence: typeof rawObj.confidence === 'number' ? rawObj.confidence : (finalVal !== null && finalVal !== undefined ? 0.95 : 0.0),
      // Backward compatibility keys
      key: fieldKey,
      label: schemaProp?.title || schemaProp?.label || fieldKey,
      sourceDocument: formattedEvidences[0]?.document_name || fallbackDocName || 'Document',
      sourcePage: formattedEvidences[0]?.page_number || 1,
      rawSnippet: formattedEvidences[0]?.evidence_text || '',
    },
    cleanVal: finalVal
  };
}

// 4. LLM Field Extraction API — Multi-Document Bundled Hierarchical Schema Extraction
app.post('/api/audit/extract-fields', async (req, res) => {
  try {
    const { moduleTitle, categories = [], documents = [] } = req.body;

    // Normalization: Group inputs by category whether sent as categories[] or documents[]
    let extractionTargets: Array<{
      categoryKey: string;
      categoryName: string;
      schema: any;
      documents: Array<{ id: string; filename: string; pageCount: number; rawText: string }>;
    }> = [];

    if (Array.isArray(categories) && categories.length > 0) {
      extractionTargets = categories;
    } else if (Array.isArray(documents) && documents.length > 0) {
      // Group documents by classifiedType
      const catMap = new Map<string, any>();
      documents.forEach(doc => {
        const catKey = doc.classifiedType || 'supporting_document';
        if (!catMap.has(catKey)) {
          catMap.set(catKey, {
            categoryKey: catKey,
            categoryName: doc.documentTypeName || catKey,
            schema: doc.schema || (doc.fields ? { type: 'object', properties: Object.fromEntries((doc.fields || []).map((f: any) => [f.key, { type: f.type || 'string', title: f.label, description: f.description }])) } : null),
            documents: []
          });
        }
        catMap.get(catKey).documents.push({
          id: doc.id || doc.filename,
          filename: doc.filename,
          pageCount: doc.pageCount || 1,
          rawText: doc.rawText || '',
        });
      });
      extractionTargets = Array.from(catMap.values());
    }

    if (extractionTargets.length === 0) {
      return res.status(400).json({ error: 'Missing or empty extraction targets' });
    }

    const allCategoryFieldNodes: Record<string, any> = {};
    const masterCleanedData: Record<string, any> = {};
    const flatFieldNodes: Record<string, any> = {};
    const extractionWarnings: string[] = [];

    // Process each document category
    for (const target of extractionTargets) {
      const { categoryKey, categoryName, schema, documents: catDocs } = target;

      if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
        console.log(`[Extract] Skipping category "${categoryKey}" — empty schema properties.`);
        continue;
      }

      if (!catDocs || catDocs.length === 0) {
        console.log(`[Extract] Category "${categoryKey}" has no uploaded documents.`);
        continue;
      }

      // Combine text from all documents in this category with Document & Page separators
      let combinedDocText = '';
      catDocs.forEach((docItem, idx) => {
        let cleanText = (docItem.rawText || '').trim();
        // Remove binary PDF garbage if present
        if (cleanText.includes('%PDF-') || cleanText.includes('obj <<') || cleanText.includes('endstream')) {
          cleanText = cleanText
            .replace(/%PDF-[\s\S]*?stream/gi, ' ')
            .replace(/endstream[\s\S]*?endobj/gi, ' ')
            .replace(/<<[\s\S]*?>>/gi, ' ')
            .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
            .replace(/\s+/g, ' ');
        }

        combinedDocText += `\n\n` +
          `================================================================================\n` +
          `DOCUMENT [${idx + 1} of ${catDocs.length}]: "${docItem.filename}" (Pages: ${docItem.pageCount})\n` +
          `================================================================================\n` +
          cleanText + `\n`;
      });

      const cappedText = combinedDocText.split(/\s+/).slice(0, runtimeConfig.extractionMaxWords).join(' ');

      // Build JSON Schema representation for prompt
      const schemaJsonStr = JSON.stringify(schema, null, 2);

      const prompt = `You are a world-class CPA, Forensic Auditor, and Financial AI.
Your task is to extract structured, hierarchical audit data according to the provided JSON Schema from the evidence text for the "${moduleTitle}" audit module.

DOCUMENT CATEGORY DETAILS:
  Category Key: "${categoryKey}"
  Category Name: "${categoryName}"
  Total Source Documents Provided: ${catDocs.length}
  Document List: ${catDocs.map(d => `"${d.filename}" (${d.pageCount} pgs)`).join(', ')}

TARGET JSON SCHEMA:
${schemaJsonStr}

EVIDENCE DOCUMENTS CONTENT (Delineated with Document and Page separators):
"""
${cappedText.length > 0 ? cappedText : '[No text extracted]'}
"""

EXTRACTION RULES & STRUCTURED OUTPUT INSTRUCTIONS:
1. Examine all provided evidence text carefully across all documents and pages.
2. For EVERY field defined in the JSON Schema (scalars, nested objects, or arrays of records), return a structured Field Node Object:
   {
     "value": <extracted typed value: number, string, boolean, array of records, or nested object of field nodes>,
     "extraction_status": "success" | "data_not_found" | "partial" | "uncertain",
     "chain_of_thought": "<step-by-step reasoning explaining where and how you found or deduced this value>",
     "evidences": [
       {
         ${catDocs.length > 1 ? '"document_name": "<exact filename of source document>",' : ''}
         "page_number": <integer page number where snippet is located>,
         "evidence_text": "<verbatim excerpt or line from document supporting this extraction>"
       }
     ]
   }
3. If multiple documents are present, use evidence across all relevant documents and note the exact "document_name" in the evidences list.
4. For numeric/monetary fields, extract clean numbers (e.g. 145250.00). Remove currency symbols ($ , € £) and commas.
5. For date fields, extract as YYYY-MM-DD whenever possible.
6. If a field cannot be found anywhere in the provided documents, set:
   - "value": null
   - "extraction_status": "data_not_found"
   - "chain_of_thought": "Field not present in uploaded evidence documents."
   - "evidences": []

You MUST return strictly valid JSON conforming to the field keys of the target JSON Schema.`;

      console.log(`[Extract] Processing category "${categoryKey}" (${catDocs.length} doc(s)) — Schema properties: ${Object.keys(schema.properties).join(', ')}`);

      let responseJsonText = '{}';
      try {
        const provider = runtimeConfig.llmProvider;
        const apiKey = runtimeConfig.llmApiKey || process.env.LLM_API_KEY || '';
        const baseUrl = runtimeConfig.llmBaseUrl;
        const modelId = runtimeConfig.llmModelId;

        if (provider === 'openai_compatible' && apiKey) {
          let targetUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
          if (targetUrl.includes('localhost')) {
            targetUrl = targetUrl.replace('localhost', '127.0.0.1');
          }

          const apiRes = await fetchWithRetry(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelId || 'gpt-4o',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              stream: false,
            }),
          });

          responseJsonText = await parseOpenAIResponse(apiRes);
        } else {
          // Gemini API path
          const ai = getGeminiClient();
          if (!ai) {
            throw new Error('Gemini API key not configured (GEMINI_API_KEY missing).');
          }
          const modelName = modelId.startsWith('gemini') ? modelId : 'gemini-3.6-flash';
          console.log(`[Extract] Calling Gemini API: model: ${modelName}`);

          const geminiRes = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });
          responseJsonText = geminiRes.text || '{}';
        }

        let cleanedJson = responseJsonText.trim();
        if (cleanedJson.startsWith('```json')) {
          cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedJson.startsWith('```')) {
          cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        let rawParsed = JSON.parse(cleanedJson);
        if (rawParsed.fields && typeof rawParsed.fields === 'object' && !Array.isArray(rawParsed.fields)) {
          rawParsed = rawParsed.fields;
        }

        // Normalize each top-level property in schema
        const categoryNodes: Record<string, any> = {};
        const categoryClean: Record<string, any> = {};

        for (const [propKey, propSchema] of Object.entries(schema.properties) as [string, any][]) {
          const rawFieldVal = rawParsed[propKey] || rawParsed[propKey.toLowerCase()];
          const fallbackDoc = catDocs[0]?.filename;
          const { node, cleanVal } = normalizeFieldNode(rawFieldVal, propSchema, propKey, catDocs.length, fallbackDoc);

          categoryNodes[propKey] = node;
          categoryClean[propKey] = cleanVal;

          // Also populate flat map for backward-compatibility with flat lookups
          flatFieldNodes[propKey] = node;
          masterCleanedData[propKey] = cleanVal;
        }

        allCategoryFieldNodes[categoryKey] = categoryNodes;
        masterCleanedData[categoryKey] = categoryClean;

        console.log(`[Extract] Successfully extracted ${Object.keys(categoryNodes).length} fields for category "${categoryKey}".`);

      } catch (catErr: any) {
        console.error(`[Extract] Error extracting category "${categoryKey}":`, catErr.message);
        extractionWarnings.push(`Extraction failed for "${categoryName}": ${catErr.message}`);

        const fallbackCategoryNodes: Record<string, any> = {};
        const fallbackCategoryClean: Record<string, any> = {};

        for (const [propKey, propSchema] of Object.entries(schema.properties) as [string, any][]) {
          const fallbackNode = {
            field_key: propKey,
            field_label: propSchema.title || propSchema.label || propKey,
            value: null,
            chain_of_thought: `Extraction failed: ${catErr.message}`,
            extraction_status: 'failed' as const,
            evidences: [],
            is_user_verified: false,
            confidence: 0.0,
            key: propKey,
            label: propSchema.title || propSchema.label || propKey,
            sourceDocument: catDocs[0]?.filename || 'Error',
            sourcePage: 1,
            rawSnippet: `Error: ${catErr.message}`
          };
          fallbackCategoryNodes[propKey] = fallbackNode;
          fallbackCategoryClean[propKey] = null;
          flatFieldNodes[propKey] = fallbackNode;
          masterCleanedData[propKey] = null;
        }
        allCategoryFieldNodes[categoryKey] = fallbackCategoryNodes;
        masterCleanedData[categoryKey] = fallbackCategoryClean;
      }
    }

    res.json({
      extractedFields: flatFieldNodes,
      categoryFields: allCategoryFieldNodes,
      cleanedData: masterCleanedData,
      warnings: extractionWarnings.length > 0 ? extractionWarnings : undefined,
    });

  } catch (err: any) {
    console.error('[Extract] Fatal extraction error:', err);
    res.status(500).json({ error: err.message || 'Field extraction failed' });
  }
});

// ------------------- VITE SERVER INTEGRATION ------------------- //

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      define: {
        'import.meta.env.VITE_LEAD_AUDIT_REVIEWER_NAME': JSON.stringify(runtimeConfig.reviewerName),
        'import.meta.env.VITE_LEAD_AUDIT_REVIEWER_TITLE': JSON.stringify(runtimeConfig.reviewerTitle)
      }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Audit OS running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
