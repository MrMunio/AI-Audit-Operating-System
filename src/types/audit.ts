export type AuditCategory =
  | 'financial'
  | 'operational'
  | 'compliance'
  | 'fraud_controls';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type FindingStatus = 'PASS' | 'FAIL' | 'WARNING';

export type OcrEngineType = 'tesseract' | 'vlm' | 'document_intelligence';
export type LlmProviderType = 'gemini' | 'openai_compatible';

export type ExtractionStatus =
  | 'success'
  | 'data_not_found'
  | 'partial'
  | 'uncertain'
  | 'failed'
  | 'manual_entry';

export interface RequiredDocumentDef {
  type: string;
  name: string;
  description: string;
  isMandatory: boolean;
  allowMultiple?: boolean; // When true, multiple files can be classified under this category
  maxFiles?: number;
}

export type FieldSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'object' | 'array';

export interface FieldSchemaProperty {
  type: FieldSchemaType;
  title?: string;
  label?: string;
  description?: string;
  required?: boolean | string[];
  properties?: Record<string, FieldSchemaProperty>;
  items?: FieldSchemaProperty;
  enum?: (string | number)[];
  format?: string;
  metadata?: Record<string, any>;
}

export interface DocumentFieldSchema {
  type: 'object';
  title?: string;
  description?: string;
  required?: string[];
  properties: Record<string, FieldSchemaProperty>;
}

export interface FieldEvidence {
  page_number?: number | string;
  document_name?: string;
  document_id?: string;
  evidence_text: string;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ExtractedFieldNode {
  field_key?: string;
  field_label?: string;
  value: any;
  chain_of_thought?: string;
  extraction_status: ExtractionStatus;
  evidences: FieldEvidence[];
  is_user_verified?: boolean;
  confidence?: number;
  // Backward compatibility fields
  key?: string;
  label?: string;
  sourceDocument?: string;
  sourcePage?: number;
  rawSnippet?: string;
}

export type ExtractedFieldMap = Record<string, ExtractedFieldNode | any>;

export type CleanExtractedData = Record<string, any>;

export interface UploadedDocument {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  classifiedType: string; // e.g., 'invoice', 'purchase_order', 'bank_statement'
  classificationConfidence: number;
  pageCount: number;
  isDigitalPdfBypassedOcr: boolean;
  rawText?: string;
  uploadedAt: string;
}

export interface MissingEvidenceItem {
  documentType: string;
  documentName: string;
  isMandatory: boolean;
  status: 'uploaded' | 'missing' | 'waived';
  allowMultiple?: boolean;
  uploadedCount?: number;
  waiverReason?: string;
  supportingNotes?: string;
  waivedBy?: string;
  waivedAt?: string;
}

export interface EvidenceCitation {
  documentName: string;
  pageNumber: number;
  fieldName: string;
  extractedValue: string;
  contextSnippet?: string;
}

export interface AuditFinding {
  id: string;
  ruleId: string;
  ruleName: string;
  status: FindingStatus;
  severity: Severity;
  title: string;
  description: string;
  evidenceCitations: EvidenceCitation[];
  riskRating: 'High Risk' | 'Medium Risk' | 'Low Risk' | 'Compliant';
  recommendation: string;
}

export interface AuditRuleDef {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: Severity;
  expressionDescription: string;
  evaluate: (
    fields: CleanExtractedData,
    documents: UploadedDocument[],
    rawFieldNodes?: ExtractedFieldMap
  ) => AuditFinding;
}

export * from '../models/auditFinding';

export interface AuditModule {
  id: string;
  title: string;
  category: AuditCategory;
  description: string;
  iconName: string;
  requiredDocuments: RequiredDocumentDef[];
  /**
   * JSON Schema definition per document category.
   * Key = classifiedType (e.g. 'bank_statement', 'general_ledger').
   */
  documentFieldSchemas: Record<string, DocumentFieldSchema>;
  rules: AuditRuleDef[];
  samplePackName?: string;
}

export interface AuditSession {
  id: string;
  moduleId: string;
  moduleTitle: string;
  category: AuditCategory;
  createdAt: string;
  status: 'document_upload' | 'extraction' | 'review' | 'rule_evaluation' | 'complete';
  documents: UploadedDocument[];
  extractedFields: ExtractedFieldMap;
  cleanedData?: CleanExtractedData;
  missingEvidence: MissingEvidenceItem[];
  findings: AuditFinding[];
  overallRiskScore: 'HIGH RISK' | 'MEDIUM RISK' | 'LOW RISK' | 'PASS';
  auditorNotes?: string;
  executiveSummary?: string;
}

export interface SystemConfig {
  llmProvider: LlmProviderType;
  llmBaseUrl: string;
  llmModelId: string;
  llmApiKeyConfigured: boolean;
  geminiKeyConfigured?: boolean;
  ocrEngine: OcrEngineType;
  databaseUrl: string;
  fuzzyMatchThreshold?: number;
  maxMultiFilesClassify?: number;
  reviewerName?: string;
  reviewerTitle?: string;
}
