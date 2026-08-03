# AI Audit Operating System (AI Audit OS)

An enterprise auditing operating system designed to automate compliance reviews, evidence collection, document extraction, and zero-hallucination deterministic rule evaluations across financial, operational, and regulatory audit modules.

---

## 🎯 What the System Does

**AI Audit OS** simplifies complex financial and compliance audits by replacing manual sampling and spreadsheet checks with an automated end-to-end audit pipeline:

1. **Evidence Collection & Classification:** Upload financial documents (PDFs, Invoices, Bank Statements, General Ledgers, CSVs). The system routes and classifies uploaded files using deterministic fuzzy matching and LLM fallbacks.
2. **LLM Structured Field Extraction:** Extracted raw document text is passed to an LLM using per-document targeted JSON schemas and chain-of-thought reasoning to pull key audit numbers (balances, totals, line items, dates, vendor names).
3. **Zero-Hallucination Rule Engine:** Extracted field values are evaluated by a **100% deterministic rule engine** (no LLM guesswork). Every audit rule returns `PASS`, `FAIL`, or `WARNING` with exact quantitative evidence and mathematical calculations.
4. **Audit Trail & Executive Reporting:** Generates audit reports with risk scoring, human-in-the-loop verification flags, document citations, and exportable JSON audit trails.

---

## 🔄 Core Audit Workflow Architecture

```
[ Upload Evidence ] ──> [ Document Parser & Classifier ]
                                │
                                ▼
                   [ Per-Document LLM Field Extraction ]
                                │ (Chain-of-Thought Reasoning + Citations)
                                ▼
                   [ Human-in-the-Loop Field Verification ]
                                │
                                ▼
                   [ Deterministic Audit Rule Engine ]
                                │ (Zero-Hallucination Math Evaluation)
                                ▼
                   [ Audit Report & Executive Sign-off ]
```

---

## ⚙️ Key Subsystems

### 1. Document Parsing & Classification
- **Native Digital PDF Parsing:** Fast native text extraction for digital PDFs via `pdf-parse` v2 (bypassing slow OCR).
- **OCR Engine Support:** Scanned images or non-text PDFs fallback to OCR engines (Tesseract / VLM).
- **Two-Tier Classifier:** 
  - *Tier 1 (Primary):* Deterministic fuzzy string matching (Levenshtein distance) on clean filenames.
  - *Tier 2 (Fallback):* LLM-assisted document classification.

### 2. LLM-Based Field Extraction
- **Scoped Per-Document Schemas:** Each document type (e.g. `bank_statement`, `general_ledger`) receives only the target fields expected from that document.
- **Chain-of-Thought Reasoning:** The LLM evaluates text evidence and field mapping rationale before producing structured field JSON.
- **Provider Agnostic:** Supports OpenAI-compatible local APIs (`ollama`, `vllm`, `lmstudio`, local proxies) and `@google/genai` (Gemini API).

### 3. Deterministic Audit Rule Engine
- **Zero Hallucination Guarantee:** Rules operate strictly on verified numeric/boolean data.
- **Supported Audit Modules (15+):**
  - Bank Reconciliation Audit
  - Expense & AP Audit
  - 3-Way Procurement Audit
  - Fraud Detection & Structuring
  - Payroll & Attendance Audit
  - Revenue Recognition Audit
  - Inventory & Stock Audit
  - GST / VAT Tax Compliance
  - Internal Controls & Segregation of Duties (Maker-Checker)
  - Accounts Payable / Receivable Aging
  - Fixed Asset Depreciation
  - Cash Flow Statement Audit
  - Corporate Tax Audit
  - IFRS 16 Lease Compliance

---

## 🚀 Running Locally

### Prerequisites
- Node.js (v18+)
- Local LLM endpoint (OpenAI-compatible) **OR** Google Gemini API key

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create or update your `.env` file:

```env
# Option A: OpenAI-compatible API (Local server / proxy)
LLM_PROVIDER="openai_compatible"
LLM_BASE_URL="http://localhost:8080/api"
LLM_MODEL_ID="gpt-4o-mini"
LLM_API_KEY="sk-your-api-key"

# Option B: Google Gemini API
# GEMINI_API_KEY="your-gemini-api-key"

# Field Extraction Max Words Window
EXTRACTION_MAX_WORDS="200000"
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
