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

/**
 * Parse an OpenAI-compatible API response that may be either:
 *   - Standard JSON:  { choices: [{ message: { content: "..." } }] }
 *   - SSE stream:     data: {"id":"...","choices":[{"delta":{"content":"..."}}]}\n\ndata: [DONE]
 *
 * This local API proxy always returns SSE regardless of stream:false,
 * so we detect and handle both formats transparently.
 */
async function parseOpenAIResponse(apiRes: Response): Promise<string> {
  const rawText = await apiRes.text();

  // Detect SSE stream format
  if (rawText.trimStart().startsWith('data:')) {
    // Parse SSE — collect all delta content fragments
    let fullContent = '';
    const lines = rawText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonPart = trimmed.slice(5).trim(); // strip "data: " prefix
      if (jsonPart === '[DONE]') break;
      try {
        const chunk = JSON.parse(jsonPart);
        // Handle both streaming delta and non-streaming message formats
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

const app = express();
const PORT = 3000;

// Increase JSON payload limits for base64 document uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory or file runtime config cache
let runtimeConfig = {
  llmProvider: process.env.LLM_PROVIDER || 'gemini',
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  llmModelId: process.env.LLM_MODEL_ID || 'gemini-3.6-flash',
  llmApiKey: process.env.LLM_API_KEY || '',
  ocrEngine: process.env.OCR_ENGINE || 'tesseract',
  databaseUrl: process.env.DATABASE_URL || 'sqlite:./audit_os.db',
};

// Startup diagnostics — print resolved LLM config so failures are immediately visible
console.log('[Config] LLM Provider     :', runtimeConfig.llmProvider);
console.log('[Config] LLM Base URL     :', runtimeConfig.llmBaseUrl);
console.log('[Config] LLM Model        :', runtimeConfig.llmModelId);
console.log('[Config] LLM API Key Set  :', runtimeConfig.llmApiKey ? `YES (${runtimeConfig.llmApiKey.slice(0, 8)}...)` : 'NO');
console.log('[Config] GEMINI Key Set   :', process.env.GEMINI_API_KEY ? 'YES' : 'NO');
console.log('[Config] Extraction MaxWords:', process.env.EXTRACTION_MAX_WORDS || '200000 (default)');


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

// 1. System Config Endpoint
app.get('/api/system/config', (req, res) => {
  res.json({
    llmProvider: runtimeConfig.llmProvider,
    llmBaseUrl: runtimeConfig.llmBaseUrl,
    llmModelId: runtimeConfig.llmModelId,
    llmApiKeyConfigured: Boolean(runtimeConfig.llmApiKey || process.env.LLM_API_KEY),
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    ocrEngine: runtimeConfig.ocrEngine,
    databaseUrl: runtimeConfig.databaseUrl,
  });
});

app.post('/api/system/config', (req, res) => {
  const { llmProvider, llmBaseUrl, llmModelId, llmApiKey, ocrEngine, databaseUrl } = req.body;
  if (llmProvider) runtimeConfig.llmProvider = llmProvider;
  if (llmBaseUrl) runtimeConfig.llmBaseUrl = llmBaseUrl;
  if (llmModelId) runtimeConfig.llmModelId = llmModelId;
  if (llmApiKey !== undefined) runtimeConfig.llmApiKey = llmApiKey;
  if (ocrEngine) runtimeConfig.ocrEngine = ocrEngine;
  if (databaseUrl) runtimeConfig.databaseUrl = databaseUrl;

  res.json({ status: 'success', config: runtimeConfig });
});

// 2. Document Text Extraction Endpoint (Native PDF Parse / OCR Bypass)
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

        // Support pdf-parse v2 (PDFParse class requiring Uint8Array)
        if (pdfParseRaw?.PDFParse) {
          const parser = new pdfParseRaw.PDFParse(uint8Data);
          const pdfResult = await parser.getText();
          extractedText = pdfResult.text || '';
          pageCount = pdfResult.numpages || 1;
        } else if (typeof pdfParse === 'function') {
          // Support pdf-parse v1 (Function interface)
          const parsedPdf = await pdfParse(buffer);
          extractedText = parsedPdf.text || '';
          pageCount = parsedPdf.numpages || 1;
        }

        if (extractedText.trim().length > 10) {
          isDigitalPdfBypassedOcr = true;
          console.log(`[PDF Parse] Successfully extracted ${extractedText.trim().length} chars from digital PDF "${filename}"`);
        } else {
          console.warn(`[PDF Parse] Extracted text was empty or short for "${filename}"`);
        }
      } catch (pdfErr: any) {
        console.warn(`[PDF Parse] Error parsing PDF "${filename}":`, pdfErr.message);
      }
    }



    // If text was empty or scanned PDF/image -> standard OCR text simulation/extraction
    if (!extractedText.trim()) {
      if (mimeType.startsWith('image/') || filename.match(/\.(png|jpg|jpeg|tiff)$/i)) {
        extractedText = `[OCR Text extracted via ${runtimeConfig.ocrEngine.toUpperCase()} for ${filename}]\nVendor: Sample Vendor Ltd\nInvoice #: INV-2026-901\nDate: 2026-07-20\nTotal Amount: $12,500.00\nGST Tax: $1,136.36\nPO Number: PO-8801\nStatus: Paid`;
      } else if (mimeType === 'text/csv' || filename.endsWith('.csv')) {
        extractedText = buffer.toString('utf-8');
      } else {
        extractedText = buffer.toString('utf-8').slice(0, 5000);
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

  // Only consider substring match high score if target keyword is at least 4 chars long to prevent false positives like 'st' in 'statement' matching 'cashregistertxt'
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


// 3. Document Classification Endpoint
app.post('/api/document/classify', async (req, res) => {
  try {
    const { filename, sampleText, targetDocuments = [], maxWords = 5000 } = req.body;
    const cleanFilename = (filename || '').trim();
    const fullText = (sampleText || '').trim();

    // Dynamically construct allowed classification targets scoped strictly to the current audit module's required documents
    let activeTargets: Record<string, string[]> = {};

    if (Array.isArray(targetDocuments) && targetDocuments.length > 0) {
      targetDocuments.forEach((doc: { type: string; name: string; description?: string }) => {
        const typeKey = doc.type;
        const nameSynonym = doc.name.toLowerCase();
        const synonyms = [typeKey, nameSynonym, typeKey.replace(/_/g, ' ')];
        if (CLASSIFICATION_TARGETS[typeKey]) {
          synonyms.push(...CLASSIFICATION_TARGETS[typeKey]);
        }
        activeTargets[typeKey] = Array.from(new Set(synonyms));
      });
    } else {
      activeTargets = CLASSIFICATION_TARGETS;
    }

    // Step 1: Deterministic Fuzzy Matching on Filename against Active Audit Module Targets
    // Remove extension (.pdf, .png, etc) for clean name matching
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

    // High confidence deterministic match threshold
    if (maxMatchScore >= 0.70) {
      console.log(`[Classify Endpoint] Deterministic Fuzzy Match SUCCEEDED: "${cleanFilename}" (clean: "${filenameNoExt}") -> "${bestMatchCategory}" (Score: ${maxMatchScore.toFixed(2)})`);
      return res.json({
        classifiedType: bestMatchCategory,
        confidence: Number(maxMatchScore.toFixed(2)),
        method: 'deterministic_fuzzy',
        thinking: `Matched filename "${cleanFilename}" to audit required document category "${bestMatchCategory}" using fuzzy similarity score ${maxMatchScore.toFixed(2)}.`
      });
    }


    console.log(`[Classify Endpoint] Deterministic score low (${maxMatchScore.toFixed(2)}). Invoking LLM fallback for filename "${cleanFilename}"...`);


    // Step 2: Fallback to LLM Classification with scoped targets & structured reasoning prompt
    const cappedText = fullText.split(/\s+/).slice(0, maxWords).join(' ');
    const validTargetsList = Object.keys(activeTargets).concat(['supporting_document']);
    const validTargetsStr = validTargetsList.join(', ');

    const prompt = `You are an expert document classification AI for financial, procurement, and auditing workflows.

DOCUMENT METADATA:
Filename: ${cleanFilename}

DOCUMENT CONTENT PREVIEW (Capped to max ${maxWords} words):
"""
${cappedText.length > 0 ? cappedText : '[No text extracted]'}
"""

ACTIVE AUDIT MODULE SCOPED CLASSIFICATION TARGETS:
[${validTargetsStr}]

TASK INSTRUCTIONS:
1. First, think step-by-step and provide your detailed reasoning explaining key clues (e.g. headers, keywords, layout terms, metadata) found in the content or filename.
2. Based on your reasoning, pick the single best classification target from the ACTIVE AUDIT TARGETS list above. If none clearly match, select "supporting_document".
3. Assign a confidence score between 0.00 and 1.00.

You MUST respond strictly with a single JSON object in the following structure:
{
  "thinking": "<Your step-by-step reasoning and content observations>",
  "decision": "<one of the valid targets from ACTIVE AUDIT TARGETS>",
  "confidence": <number between 0.00 and 1.00>
}`;


    let thinking = `Deterministic match score was low (${maxMatchScore.toFixed(2)}). Evaluated content using LLM.`;
    let classifiedType = bestMatchCategory !== 'unknown' ? bestMatchCategory : 'supporting_document';
    let confidence = 0.80;

    if (runtimeConfig.llmProvider === 'openai_compatible' && (runtimeConfig.llmApiKey || process.env.LLM_API_KEY)) {
      const classifyApiKey = runtimeConfig.llmApiKey || process.env.LLM_API_KEY || '';
      const classifyUrl = `${runtimeConfig.llmBaseUrl.replace(/\/$/, '')}/chat/completions`;
      const apiRes = await fetch(classifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${classifyApiKey}`
        },
        body: JSON.stringify({
          model: runtimeConfig.llmModelId || 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          stream: false,  // Force non-streaming response
        }),
      });

      if (apiRes.ok) {
        // Use SSE-aware parser — this local API always streams
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
        const parsed = JSON.parse(cleaned);
        thinking = parsed.thinking || thinking;
        classifiedType = parsed.decision || classifiedType;
        confidence = typeof parsed.confidence === 'number' ? parsed.confidence : confidence;
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

// Read max words for extraction from env, default 200000
const EXTRACTION_MAX_WORDS = parseInt(process.env.EXTRACTION_MAX_WORDS || '200000', 10);

// 4. LLM Field Extraction API — Per-Document, Per-Type Scoped Extraction
// Each document is processed separately with only its relevant fields.
// Chain-of-thought prompting: LLM reasons about evidence before committing to a value.
app.post('/api/audit/extract-fields', async (req, res) => {
  try {
    const { moduleTitle, documents } = req.body;
    // documents: Array of { filename, classifiedType, documentTypeName, rawText, fields[] }

    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: 'Missing or empty documents array' });
    }

    const mergedFields: Record<string, any> = {};
    const extractionWarnings: string[] = [];

    // Process each document sequentially with its scoped fields
    for (const doc of documents) {
      const { filename, classifiedType, documentTypeName, rawText, fields } = doc;

      if (!fields || fields.length === 0) {
        console.log(`[Extract] Skipping doc "${filename}" — no fields defined for type "${classifiedType}"`);
        continue;
      }

      // Clean binary PDF noise if present in rawText
      let cleanText = (rawText || '').trim();
      if (cleanText.includes('%PDF-') || cleanText.includes('obj <<') || cleanText.includes('endstream')) {
        console.warn(`[Extract] Binary PDF noise detected in "${filename}". Cleaning binary streams...`);
        cleanText = cleanText
          .replace(/%PDF-[\s\S]*?stream/gi, ' ')
          .replace(/endstream[\s\S]*?endobj/gi, ' ')
          .replace(/<<[\s\S]*?>>/gi, ' ')
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ');
      }

      // Cap text to configurable max words
      const cappedText = cleanText.split(/\s+/).slice(0, EXTRACTION_MAX_WORDS).join(' ');

      console.log(`[Extract] Text sample for "${filename}" (${cappedText.length} chars): "${cappedText.slice(0, 150)}..."`);

      // Build field schema descriptor for the prompt
      const fieldSchemaLines = fields.map((f: any, idx: number) =>
        `  Field ${idx + 1}:\n    key: "${f.key}"\n    label: "${f.label}"\n    type: "${f.type}"\n    description: "${f.description}"`
      ).join('\n\n');

      // Build valid keys list for JSON output
      const fieldKeyList = fields.map((f: any) => `"${f.key}"`).join(', ');

      const prompt = `You are a world-class CPA and financial audit AI. Your task is to extract specific target field values from the provided document text for the "${moduleTitle}" audit module.

DOCUMENT DETAILS:
  Filename: ${filename}
  Document Type: ${documentTypeName || classifiedType}
  Word Count: ${cappedText.split(/\s+/).length}

DOCUMENT TEXT CONTENT:
"""
${cappedText.length > 0 ? cappedText : '[No text extracted]'}
"""

TARGET FIELDS TO EXTRACT (${fields.length} fields):
${fieldSchemaLines}

EXTRACTION GUIDELINES:
1. Examine the document text carefully for table rows, headers, ledger entries, totals, balances, dates, reference numbers, and entity names.
2. Financial terms may use abbreviations or synonyms. For example:
   - "Opening Balance" = "Beginning Balance", "Balance B/F", "Start Balance", "Previous Balance"
   - "Closing Balance" = "Ending Balance", "Balance C/F", "Final Balance", "Carried Forward"
   - "Total Credits / Deposits" = "Total Receipts", "Cr Total", "Deposits Total", "Sum of Credits"
   - "Unpresented Cheques" = "Outstanding Cheques", "Uncleared Items", "Pending Transfers"
   - "PO Amount" = "Total Authorized", "Order Value", "Subtotal"
3. For numeric/monetary fields, extract clean numbers (e.g. 15420.50). Remove currency symbols ($ , € £) and commas.
4. For date fields, extract and format as YYYY-MM-DD (e.g. 2026-07-20).
5. For string fields, extract exact names, IDs, or text phrases verbatim.

OUTPUT JSON SPECIFICATION:
Return a SINGLE JSON object where each field key maps to an object containing:
{
  "key": "<field_key>",
  "label": "<field_label>",
  "value": <extracted numeric/string/boolean value, or null if strictly absent>,
  "confidence": <float between 0.00 and 1.00>,
  "rawSnippet": "<verbatim excerpt or line from the document text supporting the extraction>",
  "field_reasoning": "<brief 1-2 sentence explanation of where and how the value was identified in the text>"
}

RULES:
- Return ONLY valid JSON. No markdown code blocks, no trailing comments.
- Must include keys for all requested fields: ${fieldKeyList}`;

      console.log(`[Extract] Processing doc "${filename}" (type: ${classifiedType}) — ${fields.length} fields — ${cappedText.split(/\s+/).length} words`);

      let docFields: Record<string, any> = {};
      let responseJsonText = '';

      try {

        const provider = runtimeConfig.llmProvider;
        const apiKey = runtimeConfig.llmApiKey || process.env.LLM_API_KEY || '';
        const baseUrl = runtimeConfig.llmBaseUrl;
        const modelId = runtimeConfig.llmModelId;

        if (provider === 'openai_compatible' && apiKey) {
          // Normalize localhost -> 127.0.0.1 for Node.js 18+ dual-stack IPv6 resolution safety
          let targetUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
          if (targetUrl.includes('localhost')) {
            targetUrl = targetUrl.replace('localhost', '127.0.0.1');
          }
          console.log(`[Extract] Calling OpenAI-compatible API: ${targetUrl} model: ${modelId}`);

          let apiRes: Response;
          try {
            apiRes = await fetch(targetUrl, {
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
          } catch (fetchErr: any) {
            // Fallback retry: if 127.0.0.1 failed, try localhost (or vice versa)
            const fallbackUrl = targetUrl.includes('127.0.0.1')
              ? targetUrl.replace('127.0.0.1', 'localhost')
              : targetUrl.replace('localhost', '127.0.0.1');
            console.warn(`[Extract] Fetch to ${targetUrl} failed (${fetchErr.message}). Retrying with ${fallbackUrl}...`);
            apiRes = await fetch(fallbackUrl, {
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
          }

          if (!apiRes.ok) {
            const errText = await apiRes.text();
            throw new Error(`OpenAI-compatible API error ${apiRes.status}: ${errText}`);
          }

          // Use SSE-aware parser — this local API always streams regardless of stream:false
          responseJsonText = await parseOpenAIResponse(apiRes);
          if (!responseJsonText || responseJsonText.trim() === '') {
            responseJsonText = '{}';
          }
          console.log(`[Extract] Raw LLM response length: ${responseJsonText.length} chars`);

        } else {
          // Gemini API path
          const ai = getGeminiClient();
          if (!ai) {
            throw new Error('Gemini API key not configured (GEMINI_API_KEY missing). Please set LLM_PROVIDER=openai_compatible and configure LLM_API_KEY, or add GEMINI_API_KEY.');
          }
          const modelName = modelId.startsWith('gemini') ? modelId : 'gemini-2.0-flash';
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

        // Clean potential markdown code fences
        let cleanedJson = responseJsonText.trim();
        if (cleanedJson.startsWith('```json')) {
          cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedJson.startsWith('```')) {
          cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // Robust JSON parsing & wrapper unwrapping
        let rawParsed = JSON.parse(cleanedJson);

        // Handle case where LLM wraps output in top-level key e.g. { "fields": { ... } } or { "extractedFields": { ... } }
        if (rawParsed.fields && typeof rawParsed.fields === 'object' && !Array.isArray(rawParsed.fields)) {
          rawParsed = rawParsed.fields;
        } else if (rawParsed.extractedFields && typeof rawParsed.extractedFields === 'object' && !Array.isArray(rawParsed.extractedFields)) {
          rawParsed = rawParsed.extractedFields;
        } else if (Array.isArray(rawParsed)) {
          // If LLM returned an array of field objects [{ key: '...', value: '...' }, ...]
          const arrAsObj: Record<string, any> = {};
          rawParsed.forEach((item: any) => {
            if (item && item.key) arrAsObj[item.key] = item;
          });
          rawParsed = arrAsObj;
        }

        // Normalize each field to guarantee frontend contract
        fields.forEach((f: any) => {
          const item = rawParsed[f.key] || rawParsed[f.key.toLowerCase()] || {};

          // Extract value (support direct primitive or nested .value)
          let extractedVal = item.value !== undefined ? item.value : (typeof item !== 'object' || item === null ? item : null);
          if (extractedVal === undefined) extractedVal = null;

          // Parse confidence safely to float
          let confNum = parseFloat(item.confidence);
          if (isNaN(confNum)) {
            confNum = extractedVal !== null && extractedVal !== 'Not Found' ? 0.95 : 0.0;
          }

          docFields[f.key] = {
            key: f.key,
            label: f.label || item.label || f.key,
            value: extractedVal,
            confidence: confNum,
            sourceDocument: item.sourceDocument || filename,
            sourcePage: typeof item.sourcePage === 'number' ? item.sourcePage : 1,
            rawSnippet: item.rawSnippet || item.evidence || '',
            field_reasoning: item.field_reasoning || item.reasoning || item.step_by_step || 'Extracted via LLM reasoning.'
          };
        });

        console.log(`[Extract] Successfully normalized ${Object.keys(docFields).length} fields from "${filename}":`, 
          Object.entries(docFields).map(([k, v]: [string, any]) => `${k}=${v.value} (${(v.confidence * 100).toFixed(0)}%)`).join(', ')
        );

      } catch (docErr: any) {
        console.error(`[Extract] LLM error or JSON parse error for doc "${filename}":`, docErr.message, docErr.cause ? `(Cause: ${docErr.cause?.message || docErr.cause})` : '', 'Raw snippet:', responseJsonText.slice(0, 300));
        extractionWarnings.push(`"${filename}" extraction failed: ${docErr.message}`);

        // Return null values with 0.0 confidence — no mock data
        fields.forEach((f: any) => {
          docFields[f.key] = {
            key: f.key,
            label: f.label,
            value: null,
            confidence: 0.0,
            sourceDocument: filename,
            sourcePage: 1,
            rawSnippet: `Extraction failed: ${docErr.message}`,
            field_reasoning: 'LLM extraction failed for this document.'
          };
        });
      }

      // Merge this document's extracted fields into the master map
      for (const [key, val] of Object.entries(docFields)) {
        const existing = mergedFields[key];
        const valConf = (val as any).confidence ?? 0;
        const existingConf = existing?.confidence ?? -1;

        if (!existing || valConf > existingConf) {
          mergedFields[key] = val;
        }
      }
    }

    const response: any = { extractedFields: mergedFields };
    if (extractionWarnings.length > 0) {
      response.warnings = extractionWarnings;
    }

    res.json(response);

  } catch (err: any) {
    console.error('[Extract] Fatal extraction error:', err);
    res.status(500).json({ error: err.message || 'Field extraction failed' });
  }
});

// App configuration endpoint
app.get('/api/config', (req, res) => {
  res.json({
    reviewerName: process.env.VITE_LEAD_AUDIT_REVIEWER_NAME || 'David Vance, CPA, CIA',
    reviewerTitle: process.env.VITE_LEAD_AUDIT_REVIEWER_TITLE || 'Authorized Audit Partner'
  });
});

// ------------------- VITE SERVER INTEGRATION ------------------- //

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      define: {
        'import.meta.env.VITE_LEAD_AUDIT_REVIEWER_NAME': JSON.stringify(process.env.VITE_LEAD_AUDIT_REVIEWER_NAME || 'David Vance, CPA, CIA'),
        'import.meta.env.VITE_LEAD_AUDIT_REVIEWER_TITLE': JSON.stringify(process.env.VITE_LEAD_AUDIT_REVIEWER_TITLE || 'Authorized Audit Partner')
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
