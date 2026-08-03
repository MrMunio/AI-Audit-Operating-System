export type AuditCategory = 
  | 'financial'
  | 'operational'
  | 'compliance'
  | 'fraud_controls';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type FindingStatus = 'PASS' | 'FAIL' | 'WARNING';

export type OcrEngineType = 'tesseract' | 'vlm' | 'document_intelligence';
export type LlmProviderType = 'gemini' | 'openai_compatible';

export interface RequiredDocumentDef {
  type: string;
  name: string;
  description: string;
  isMandatory: boolean;
}

export interface ExtractedFieldDef {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  description: string;
}

export interface AuditRuleDef {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: Severity;
  expressionDescription: string;
  // Function evaluated deterministically
  evaluate: (fields: ExtractedFieldMap, documents: UploadedDocument[]) => AuditFinding;
}

export interface ExtractedField {
  key: string;
  label: string;
  value: any;
  confidence: number; // 0 to 1
  sourceDocument: string;
  sourcePage: number;
  rawSnippet?: string;
  isUserVerified?: boolean;
}

export type ExtractedFieldMap = Record<string, ExtractedField>;

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

export interface AuditModule {
  id: string;
  title: string;
  category: AuditCategory;
  description: string;
  iconName: string;
  requiredDocuments: RequiredDocumentDef[];
  extractedFieldsSchema: ExtractedFieldDef[];
  /**
   * Per-document-type scoped field schemas for LLM extraction.
   * Key = classifiedType (e.g. 'bank_statement', 'general_ledger').
   * Each entry contains only the fields that should be extracted from that document type.
   * When defined, extraction runs once per uploaded document using its scoped fields.
   * Falls back to extractedFieldsSchema if a document type has no entry here.
   */
  documentFieldSchemas?: Record<string, ExtractedFieldDef[]>;
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
  ocrEngine: OcrEngineType;
  databaseUrl: string;
}
