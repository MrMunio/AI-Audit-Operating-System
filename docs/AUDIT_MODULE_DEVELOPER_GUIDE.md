# AI Audit Operating System - Audit Module Developer Guide

Welcome to the **AI Audit Operating System** developer guide! This document provides complete specifications, architecture patterns, and best practices for creating and registering new audit procedures in [`src/config/auditModules.ts`](file:///d:/Infomerica/OneDrive%20-%20infomerica,inc/Sekhar/projects/ai-audit-operating-system/src/config/auditModules.ts).

---

## 1. Architectural Philosophy

The AI Audit Operating System is built on a **two-layer deterministic architecture**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │                      Layer 1: Perception                    │
 │    AI / VLM Multi-Modal Document Extraction Engine          │
 │  (Extracts text, numbers, dates & bounding boxes to JSON)   │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Extracted Field Nodes
 ┌──────────────────────────────▼──────────────────────────────┐
 │                      Layer 2: Judgment                      │
 │          Deterministic Rule Engine (0% Hallucination)       │
 │   (Strict math, assertions, and standardized data models)   │
 └──────────────────────────────┬──────────────────────────────┘
                                │ AuditFindingModel Instances
 ┌──────────────────────────────▼──────────────────────────────┐
 │               Standardized Executive Audit Report           │
 └─────────────────────────────────────────────────────────────┘
```

1. **AI Perception Layer**: Large Language Models (LLMs) and Vision Language Models (VLMs) extract structured fields and evidence citations from uploaded documents based on your defined JSON schemas.
2. **Deterministic Rule Engine**: Rules are pure TypeScript functions that execute deterministic arithmetic, cross-document reconciliation, and business logic against extracted data with **0% hallucination risk**.
3. **Standardized Finding Output**: Every rule returns an [`AuditFindingModel`](src/models/auditFinding.ts) instance, ensuring consistent reporting, UI presentation, and risk scoring without backend modifications.

---

## 2. Anatomy of an Audit Module

An audit module implements the `AuditModule` interface from [`src/types/audit.ts`](src/types/audit.ts). It contains four core sections:

```ts
import { AuditModule } from '../types/audit';
import { AuditFindingModel, citeField, FindingStatusEnum } from '../models/auditFinding';

export const myAuditModule: AuditModule = {
  // 1. Metadata
  id: 'my_audit_module',
  title: 'My Custom Audit Title',
  category: 'financial', // 'financial' | 'operational' | 'compliance' | 'fraud_controls'
  description: 'Detailed description of what this audit procedure tests.',
  iconName: 'Receipt',   // Lucide icon name (e.g. Receipt, Building, ShieldCheck)
  samplePackName: 'Q3 Enterprise Sample Batch',

  // 2. Document Classification Requirements
  requiredDocuments: [ ... ],

  // 3. Document Extraction JSON Schemas
  documentFieldSchemas: { ... },

  // 4. Deterministic Audit Rules
  rules: [ ... ]
};
```

---

## 3. Core Specification Details

### 3.1 `requiredDocuments`

Defines the types of files expected for the audit:

```ts
requiredDocuments: [
  {
    type: 'invoice',                   // Unique classifiedType slug
    name: 'Vendor Invoice',            // Human-readable title
    description: 'Official tax invoice issued by the supplier',
    isMandatory: true,                 // Flagged as missing if omitted
    allowMultiple: true,               // Enables multi-file classification & batch analysis
    maxFiles: 10                       // Optional maximum file limit
  }
]
```

#### 3.1.1 Multi-File Classification & Cross-Document Analysis (`allowMultiple: true`)

Set `allowMultiple: true` whenever an audit procedure needs to ingest and analyze **multiple documents under the same category**.

##### Common Scenarios:
- **Expense & Invoice Batches**: Auditing 5–20 vendor invoices or expense receipts against a single PO spend limit.
- **Bank Reconciliations**: Processing multiple monthly bank statement PDFs (Jan, Feb, Mar) against ongoing general ledger exports.
- **Procurement 3-Way Matching**: Matching one Purchase Order against multiple partial **Goods Receipt Notes (GRNs)** and split vendor invoices.
- **Disbursement Logs**: Reconciling multiple payment vouchers or bank advice files against a master AP schedule.

##### How Multi-File Processing Works:
1. **AI Classification**: The classifier recognizes that multiple files are eligible for this category and groups them seamlessly without duplicate type collisions.
2. **Per-Document Field Provenance**: The extraction engine captures field nodes from all files in the batch, tagging each extracted field and evidence citation with its specific `document_name` and `page_number`.
3. **Rule Evaluation Access**:
   Inside your rule's `evaluate(fields, documents, rawFieldNodes)` function, you have direct access to:
   - `fields`: Clean dual-accessor extracted values.
   - `documents`: Full array of [`UploadedDocument[]`](src/types/audit.ts#L88-L99) containing metadata (filenames, page counts, classified types) across all uploaded files.
   - `rawFieldNodes`: Raw extraction nodes with complete multi-evidence citation arrays.

---

### 3.2 `documentFieldSchemas`

Defines the exact fields the AI extraction engine must extract from each document category. The top-level key must match the `type` in `requiredDocuments`:

```ts
documentFieldSchemas: {
  vendor_invoice: {
    type: 'object',
    title: 'Vendor Invoice Schema',
    description: 'Structured extraction schema for invoices',
    properties: {
      invoice_number: {
        type: 'string',
        title: 'Invoice Number',
        description: 'Unique reference number (e.g. INV-2026-001)'
      },
      invoice_amount: {
        type: 'number',
        title: 'Total Gross Amount ($)',
        description: 'Total billed amount including all applicable taxes'
      },
      invoice_date: {
        type: 'date',
        title: 'Invoice Date',
        description: 'Date the invoice was issued (YYYY-MM-DD)'
      }
    }
  }
}
```

Supported property types: `'string' | 'number' | 'integer' | 'boolean' | 'date' | 'object' | 'array'`.

---

## 4. Writing Deterministic Rules with `AuditFindingModel`

### 4.1 The Rule Definition (`AuditRuleDef`)

Every rule in `rules: [...]` has the following structure:

```ts
{
  id: 'RULE_MYMOD_01',                         // Unique identifier (RULE_<MODULE>_<NUM>)
  name: 'Invoice vs PO Price Reconciliation',   // Short descriptive title
  description: 'Verifies invoiced unit price does not exceed agreed PO price.',
  category: 'Price Compliance',                // Functional grouping
  severity: 'high',                            // 'critical' | 'high' | 'medium' | 'low'
  expressionDescription: 'invoice_unit_price <= po_unit_price',
  evaluate: (fields, documents, rawFieldNodes) => {
    // Deterministic logic goes here
    // Must return an AuditFindingModel instance
  }
}
```

### 4.2 Standardized Output: `AuditFindingModel`

All rules must return an instance of `AuditFindingModel`. You can construct findings in two equivalent, standardized ways:

#### Option A: Unified Constructor (Recommended)
```ts
return new AuditFindingModel({
  ruleId: 'RULE_MYMOD_01',
  ruleName: 'Invoice vs PO Price Reconciliation',
  status: isMatch ? 'PASS' : 'FAIL', // Accepts 'PASS' | 'FAIL' | 'WARNING' or FindingStatusEnum
  title: isMatch ? 'Price Contractually Compliant' : `Price Variance Detected ($${diff})`,
  description: isMatch
    ? `Unit price ($${invPrice}) matches purchase order rate.`
    : `Vendor billed $${invPrice}, exceeding PO rate ($${poPrice}) by $${diff}.`,
  evidenceCitations: [
    citeField(fields.invoice_unit_price, 'Invoice Price', 'Invoice.pdf', 1),
    citeField(fields.po_unit_price, 'PO Price', 'PO.pdf', 1)
  ],
  // Optional: severity, riskRating, and recommendation will auto-default if omitted!
  severity: 'high',
  recommendation: isMatch ? 'No action required.' : 'Request amended invoice at contracted PO rate.'
});
```

#### Option B: Factory Convenience Methods
```ts
if (isMatch) {
  return AuditFindingModel.pass({
    ruleId: 'RULE_MYMOD_01',
    ruleName: 'Invoice vs PO Price Reconciliation',
    title: 'Price Contractually Compliant',
    description: `Unit price ($${invPrice}) matches purchase order rate.`,
    evidenceCitations: [citeField(fields.invoice_unit_price, 'Invoice Price', 'Invoice.pdf', 1)]
  });
}

return AuditFindingModel.fail({
  ruleId: 'RULE_MYMOD_01',
  ruleName: 'Invoice vs PO Price Reconciliation',
  severity: 'high',
  title: `Price Discrepancy Detected ($${diff})`,
  description: `Vendor billed $${invPrice}, exceeding PO rate ($${poPrice}).`,
  evidenceCitations: [
    citeField(fields.invoice_unit_price, 'Invoice Price', 'Invoice.pdf', 1),
    citeField(fields.po_unit_price, 'PO Price', 'PO.pdf', 1)
  ],
  recommendation: 'Issue debit note or request corrected invoice before disbursement.'
});
```

---

## 5. Field Evidence & The `citeField()` Helper

Never manually construct raw citation dictionaries if you can use [`citeField()`](src/models/auditFinding.ts#L182-L210).

```ts
citeField(fieldNode, label, fallbackDocumentName?, fallbackPageNumber?)
```

- Automatically extracts `.value`, `.sourceDocument`, and `.sourcePage` from the extracted node proxy.
- Handles `null` or `undefined` values safely without runtime crashes.

```ts
// Example:
evidenceCitations: [
  citeField(fields.invoice_amount, 'Invoice Total', 'Invoice.pdf', 1),
  citeField(fields.bank_transfer_net, 'Bank Transfer Net', 'Bank_Advice.pdf', 1)
]
```

---

## 6. Complete End-to-End Example

Here is a complete, production-ready module for a **Vendor Onboarding & Sanctions Audit**:

```ts
import { AuditModule } from '../types/audit';
import { AuditFindingModel, citeField } from '../models/auditFinding';

export const VENDOR_COMPLIANCE_AUDIT: AuditModule = {
  id: 'vendor_compliance',
  title: 'Vendor Compliance & Sanctions Audit',
  category: 'compliance',
  description: 'Audit new vendor KYC profiles, bank details, tax registrations, and sanctions list screening before vendor activation.',
  iconName: 'ShieldCheck',
  samplePackName: 'Vendor Onboarding KYC Batch',
  requiredDocuments: [
    { type: 'vendor_kyc', name: 'Vendor KYC Form', description: 'Signed vendor onboarding registration form', isMandatory: true },
    { type: 'tax_certificate', name: 'Tax Registration Certificate (W-9 / GSTIN)', description: 'Government tax identification certificate', isMandatory: true },
    { type: 'sanctions_report', name: 'Sanctions / AML Screening Report', description: 'Automated AML/PEP screening database export', isMandatory: false }
  ],
  documentFieldSchemas: {
    vendor_kyc: {
      type: 'object',
      title: 'Vendor KYC Schema',
      description: 'Extracted details from vendor KYC form',
      properties: {
        vendor_name: { type: 'string', title: 'Vendor Legal Name', description: 'Registered legal entity name' },
        tax_id: { type: 'string', title: 'Tax ID / EIN / GSTIN', description: 'Tax identifier stated on KYC form' },
        bank_country: { type: 'string', title: 'Bank Account Country', description: 'Country of the vendor bank account' }
      }
    },
    tax_certificate: {
      type: 'object',
      title: 'Tax Certificate Schema',
      description: 'Extracted details from tax certificate',
      properties: {
        tax_id: { type: 'string', title: 'Certified Tax ID', description: 'Official tax ID on government document' }
      }
    },
    sanctions_report: {
      type: 'object',
      title: 'Sanctions Report Schema',
      description: 'Screening report results',
      properties: {
        is_sanctioned: { type: 'boolean', title: 'Sanctions Match Flag', description: 'True if vendor matches active watchlist' }
      }
    }
  },
  rules: [
    {
      id: 'RULE_VND_01',
      name: 'Tax ID Consistency Check',
      description: 'Tax ID on KYC onboarding form must match certified government tax document exactly.',
      category: 'Tax Verification',
      severity: 'critical',
      expressionDescription: 'kyc_tax_id == cert_tax_id',
      evaluate: (fields) => {
        const kycTax = String(fields.tax_id?.value || '').trim();
        const certTax = String(fields.tax_certificate?.tax_id?.value || fields.tax_id?.value || '').trim();
        const isMatch = kycTax.length > 0 && kycTax === certTax;

        if (isMatch) {
          return AuditFindingModel.pass({
            id: 'FND_VND_01',
            ruleId: 'RULE_VND_01',
            ruleName: 'Tax ID Consistency Check',
            title: 'Tax Identification Number Verified',
            description: `KYC Tax ID (${kycTax}) matches certified tax document.`,
            evidenceCitations: [
              citeField(fields.tax_id, 'KYC Tax ID', 'Vendor_KYC.pdf', 1)
            ],
            recommendation: 'Tax document verified.'
          });
        }

        return AuditFindingModel.fail({
          id: 'FND_VND_01',
          ruleId: 'RULE_VND_01',
          ruleName: 'Tax ID Consistency Check',
          severity: 'critical',
          title: 'Tax ID Discrepancy Found',
          description: `KYC Form Tax ID (${kycTax || 'Empty'}) does not match Certified Tax Document (${certTax || 'Empty'}).`,
          evidenceCitations: [
            citeField(fields.tax_id, 'KYC Tax ID', 'Vendor_KYC.pdf', 1)
          ],
          recommendation: 'Reject vendor onboarding until official certified tax documents match application form.'
        });
      }
    }
  ]
};
```

---

## 7. Registration Checklist

To register your new module in the platform:

1. Open [`src/config/auditModules.ts`](file:///d:/Infomerica/OneDrive%20-%20infomerica,inc/Sekhar/projects/ai-audit-operating-system/src/config/auditModules.ts).
2. Append your module object to the `AUDIT_MODULES` array:
   ```ts
   export const AUDIT_MODULES: AuditModule[] = [
     // ... existing modules
     VENDOR_COMPLIANCE_AUDIT
   ];
   ```
3. Run the type-checker to verify zero compile errors:
   ```bash
   npm run lint
   ```
4. Start the dev server and test in the UI:
   ```bash
   npm run dev
   ```

---

## 8. Best Practices (DOs and DON'Ts)

### ✅ DOs:
- **Use `AuditFindingModel`**: Always return an instance of `AuditFindingModel` (or use `new AuditFindingModel({ ... })`).
- **Use `citeField()`**: Always cite source documents and page numbers for auditor traceability.
- **Defensive Value Parsing**: Use `Number(fields.my_field?.value || 0)` or `String(fields.my_field?.value || '')` to guard against missing fields.
- **Provide Actionable Recommendations**: Give clear next steps (e.g. *"Hold payment"*, *"Post adjusting journal entry"*, *"Request secondary CFO approval"*).
- **Match Identifiers**: Keep `ruleId` (e.g. `RULE_XYZ_01`) and finding `id` (e.g. `FND_XYZ_01`) standard and consistent.

### ❌ DON'Ts:
- **Don't return raw JSON literals**: Avoid `return { id: '...', status: 'PASS' }` without the data model.
- **Don't leave findings without citations**: Auditors require evidence citations to certify findings.
- **Don't throw uncaught errors**: If a field is missing, handle it gracefully or let `ruleEngine.ts` safely capture it.
- **Don't hardcode math**: Ensure formulas strictly match the rule's `expressionDescription`.
