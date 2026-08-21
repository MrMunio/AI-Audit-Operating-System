# AI Audit Operating System (AI Audit OS)

An enterprise auditing operating system designed to automate compliance reviews, multi-document evidence collection, hierarchical JSON schema extraction, and zero-hallucination deterministic rule evaluations across financial, operational, and regulatory audit modules.

---

## 🎯 What the System Does

**AI Audit OS** simplifies complex financial and compliance audits by replacing manual sampling and spreadsheet checks with an automated, explainable, end-to-end audit pipeline:

1. **Multi-Document Evidence Collection & Classification:** Upload financial documents (PDFs, Invoices, Bank Statements, General Ledgers, CSVs, Receipts). The system routes and classifies files using deterministic fuzzy matching against configurable thresholds and LLM fallbacks. Supports multi-file classification for document categories requiring multiple related files (e.g. multi-month statements, ledger batches, multiple invoices).
2. **Hierarchical JSON Schema Field Extraction:** Pass combined, page-delineated document streams to the LLM using flexible, structured JSON Schemas per document category (supporting nested objects, arrays of line items/records, and scalar values).
3. **Traceable Field Nodes with Chain of Thought & Evidences:** The LLM returns structured field objects containing the extracted value, extraction status (`success`, `data_not_found`, `partial`, `uncertain`), step-by-step AI chain-of-thought reasoning, and verbatim raw text citations with source document name and page number references.
4. **Dynamic Human-in-the-Loop Extraction Reviewer:** An interactive UI allows auditors to explore extracted data by document category, inspect AI chain-of-thought rationale, view citation snippets, and modify or verify values inline.
5. **Zero-Hallucination Deterministic Rule Engine:** Clean hierarchical data is evaluated by a **100% deterministic rule engine** (no LLM mathematical guesswork). Every audit rule returns `PASS`, `FAIL`, or `WARNING` with exact calculations and quantitative citations.
6. **Executive Reporting & Export:** Generates formal audit reports with executive risk scoring, auditor sign-off, and exportable JSON audit trails.

---

## 🔄 Core Audit Workflow Architecture

```
[ Upload Evidence Files ] ──> [ PDF Parser with Page Markers & Multi-File Classifier ]
                                               │
                                               ▼
                         [ Bundled Multi-Doc JSON Schema LLM Extraction ]
                                               │
                     ┌─────────────────────────┴─────────────────────────┐
                     ▼                                                   ▼
       [ Extracted Field Nodes Tree ]                     [ Clean Hierarchical Data ]
   (Value + CoT + Status + Evidences)                        (Pure Values for Math)
                     │                                                   │
                     ▼                                                   ▼
       [ Dynamic Extraction Reviewer ]                    [ Deterministic Rule Engine ]
   (Category Tabs, CoT & Evidence Modals)                 (100% Deterministic Math)
                     │                                                   │
                     └─────────────────────────┬─────────────────────────┘
                                               │
                                               ▼
                                  [ Executive Audit Report ]
```

---

## ⚙️ Key Subsystems & Features

### 1. Document Parsing, Classification & Multi-File Support
- **Native Digital PDF Text Parsing:** Fast text extraction for digital PDFs via `pdf-parse` v2 (bypassing slow OCR), automatically injecting page markers (`--- [Page N] ---`).
- **Multi-File Document Categories:** Document categories can be configured with `allowMultiple: true` in `requiredDocuments` to group and process multiple related documents under a single audit category.
- **Configurable Deterministic Fuzzy Matching (Tier 1):** Fast Levenshtein distance matching on clean filenames using global `fuzzyMatchThreshold` (default `0.70`).
- **Multi-File Aware LLM Classifier (Tier 2 Fallback):** Intelligently routes files when fuzzy matching is below threshold.

### 2. Hierarchical JSON Schema Extraction
- **Flexible JSON Schemas:** Document schemas (`DocumentFieldSchema`) replace flat key-value pairs with rich schemas supporting:
  - **Primitives:** `number`, `string`, `boolean`, `date` (with currency and date formatting).
  - **Nested Dictionaries/Objects:** Hierarchical sections with sub-properties.
  - **Arrays & Lists:** Tabular records (e.g. line items, transactions) and string lists.
- **Multi-Document Bundling:** For categories with multiple files, the pipeline combines text streams with clear document headers and page separators (`--- [Document: <filename> | Page <N>] ---`).
- **Structured Field Response Format:**
  ```json
  {
    "bank_opening_balance": {
      "value": 145250.00,
      "extraction_status": "success",
      "chain_of_thought": "Located on page 1 top header in the Summary of Accounts.",
      "evidences": [
        {
          "document_name": "Chase_Bank_Statement_July2026.pdf",
          "page_number": 1,
          "evidence_text": "Beginning Balance on 07/01/2026: $145,250.00"
        }
      ]
    }
  }
  ```

### 3. Dynamic Extraction Reviewer UI
- **Category Tabs:** Switch seamlessly between document categories (`Bank Statement [2 docs]`, `General Ledger [1 doc]`, etc.) or view `All Categories`.
- **Dynamic Recursive Renderer:** Elegantly renders scalars, collapsible nested objects, and record tables.
- **AI Chain of Thought Modal:** Click the **Chain of Thought** (`Brain`) button to view the step-by-step reasoning for any extracted field.
- **Evidence Inspector Modal:** Click the **Evidence** (`Quote`) button to reveal all citations with document names, page numbers, and verbatim text quotes.
- **Search & Status Filtering:** Filter by text or status (`All`, `Success`, `Exceptions`, `Verified`).
- **Inline Editing & Verification:** Modify values inline and flag fields as human-verified.

### 4. Zero-Hallucination Deterministic Rule Engine
- **Clean Data Feeding:** The engine receives cleaned hierarchical data stripped of metadata wrappers, ensuring math and logical assertions are strictly deterministic.
- **15+ Built-in Audit Modules:**
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
  - IT Access Controls Audit

---

## 🛠️ Configuration Architecture

Global defaults and settings are decoupled from source code and managed via:
- [src/config/systemConfig.json](file:///d:/Infomerica/OneDrive%20-%20infomerica,inc/Sekhar/projects/ai-audit-operating-system/src/config/systemConfig.json): Central defaults for thresholds, limits, and auditor metadata.
- `.env`: Runtime environment variables.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Web server listening port | `3000` |
| `LLM_PROVIDER` | LLM backend: `openai_compatible` or `gemini` | `gemini` |
| `LLM_BASE_URL` | Base URL for OpenAI-compatible endpoint | `https://api.openai.com/v1` |
| `LLM_MODEL_ID` | Model identifier (e.g. `gpt-4o-mini`, `gemini-3.6-flash`) | `gemini-3.6-flash` |
| `LLM_API_KEY` | API Key for OpenAI-compatible endpoint | `""` |
| `GEMINI_API_KEY` | Google Gemini API Key | `""` |
| `FUZZY_MATCH_THRESHOLD` | Primary filename classifier similarity threshold (0.00 - 1.00) | `0.70` |
| `EXTRACTION_MAX_WORDS` | Maximum word context window for LLM document extraction | `200000` |
| `OCR_ENGINE` | OCR Engine for scanned PDFs/images (`tesseract`, `vlm`) | `tesseract` |
| `DATABASE_URL` | Audit storage connection string | `sqlite:./audit_os.db` |
| `VITE_LEAD_AUDIT_REVIEWER_NAME` | Authorized signatory auditor name | `David Vance, CPA, CIA` |
| `VITE_LEAD_AUDIT_REVIEWER_TITLE` | Authorized signatory auditor title | `Authorized Audit Partner` |

---

## 🐳 Docker Setup (Recommended)

The project includes a multi-stage [Dockerfile](file:///d:/Infomerica/OneDrive%20-%20infomerica,inc/Sekhar/projects/ai-audit-operating-system/Dockerfile) and [docker-compose.yml](file:///d:/Infomerica/OneDrive%20-%20infomerica,inc/Sekhar/projects/ai-audit-operating-system/docker-compose.yml) configured with `restart: unless-stopped`.

### Why `restart: unless-stopped`?
The container will automatically start whenever the Docker daemon reboots or starts up, and will automatically restart if the container crashes or encounters a fatal exit, **unless** it was explicitly stopped by the user via `docker compose down` or `docker stop`.

### 1. Environment File Preparation
Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` to configure your LLM provider and credentials:

```env
# Example A: Using Google Gemini
LLM_PROVIDER="gemini"
GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"

# Example B: Using Local / Self-Hosted OpenAI-Compatible Endpoint
# LLM_PROVIDER="openai_compatible"
# LLM_BASE_URL="http://host.docker.internal:8080/api"
# LLM_MODEL_ID="gpt-4o-mini"
# LLM_API_KEY="sk-your-api-key"
```

> **Note for Local LLM Services (Ollama / LocalAI / vLLM):**  
> When running local LLMs on your host machine, use `http://host.docker.internal:<PORT>/v1` as your `LLM_BASE_URL` so the Docker container can access the host service.

---

### 2. Start with Docker Compose

Build and launch the container in the background (detached mode):

```bash
docker compose up -d --build
```

Access the web interface at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

### 3. Essential Docker Management Commands

| Action | Command |
| :--- | :--- |
| **View real-time logs** | `docker compose logs -f` |
| **Check container health & status** | `docker compose ps` |
| **Restart container** | `docker compose restart` |
| **Rebuild after source edits** | `docker compose up -d --build` |
| **Stop and remove container** | `docker compose down` |
| **Stop container (preserves volume)** | `docker compose stop` |

---

### 4. Running with Standalone Docker CLI (Alternative)

If you prefer building and running directly with the `docker` CLI:

```bash
# 1. Build the Docker image
docker build -t ai-audit-operating-system .

# 2. Run container with 'unless-stopped' restart policy
docker run -d \
  --name ai-audit-operating-system \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -v audit_data:/app/data \
  ai-audit-operating-system
```

---

## 💻 Running Locally (Without Docker)

### Prerequisites
- **Node.js**: v18.0 or higher
- **npm** or **bun** / **yarn**
- LLM Provider API access (Gemini API Key or OpenAI-compatible endpoint)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create your local `.env` file:

```bash
cp .env.example .env
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build & Run Production Bundle Locally
```bash
npm run build
npm start
```

---

## 🔒 Security & Data Privacy
- **Zero Data Leakage:** All deterministic calculations occur locally inside your environment.
- **Air-Gapped Ready:** Can be configured to route to fully on-premise LLMs (e.g. Ollama, vLLM, LocalAI) by setting `LLM_PROVIDER=openai_compatible` and providing a private URL.
