import {
  AuditFinding,
  EvidenceCitation,
  FindingStatus,
  Severity
} from '../types/audit';

export type RiskRating = 'High Risk' | 'Medium Risk' | 'Low Risk' | 'Compliant';

export enum FindingStatusEnum {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING'
}

export interface FindingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RawEvidenceInput {
  documentName?: string;
  pageNumber?: number | string;
  fieldName?: string;
  extractedValue?: any;
  contextSnippet?: string;
}

/**
 * Single, unified parameter interface for constructing any audit finding.
 */
export interface AuditFindingParams {
  id?: string;
  ruleId: string;
  ruleName: string;
  status: FindingStatus | FindingStatusEnum;
  severity?: Severity; // Optional: auto-derived from status if not specified
  title: string;
  description: string;
  evidenceCitations?: (EvidenceCitation | RawEvidenceInput)[];
  riskRating?: RiskRating; // Optional: auto-derived from status if not specified
  recommendation?: string; // Optional: auto-derived from status if not specified
}

// Backwards compatibility alias
export type CreateFindingParams = AuditFindingParams;
export type PassFindingParams = Omit<AuditFindingParams, 'status'> & { status?: FindingStatus };
export type FailFindingParams = Omit<AuditFindingParams, 'status'> & { status?: FindingStatus };
export type WarningFindingParams = Omit<AuditFindingParams, 'status'> & { status?: FindingStatus };

/**
 * Standardized Data Model for all Audit Finding outputs.
 * 
 * Provides runtime validation, type safety, default value computation,
 * serialization, and convenient creator methods.
 */
export class AuditFindingModel implements AuditFinding {
  public readonly id: string;
  public readonly ruleId: string;
  public readonly ruleName: string;
  public readonly status: FindingStatus;
  public readonly severity: Severity;
  public readonly title: string;
  public readonly description: string;
  public readonly evidenceCitations: EvidenceCitation[];
  public readonly riskRating: RiskRating;
  public readonly recommendation: string;

  constructor(params: AuditFindingParams) {
    // Validate required identifiers and titles
    if (!params.ruleId || typeof params.ruleId !== 'string') {
      throw new Error(`[AuditFindingModel] Invalid ruleId: "${params.ruleId}". Must be a non-empty string.`);
    }
    if (!params.ruleName || typeof params.ruleName !== 'string') {
      throw new Error(`[AuditFindingModel] Invalid ruleName: "${params.ruleName}". Must be a non-empty string.`);
    }
    if (!params.title || typeof params.title !== 'string') {
      throw new Error(`[AuditFindingModel] Invalid title for rule "${params.ruleId}". Must be a non-empty string.`);
    }

    // Standardize & validate status enum
    const statusUpper = String(params.status || '').toUpperCase() as FindingStatus;
    if (!['PASS', 'FAIL', 'WARNING'].includes(statusUpper)) {
      throw new Error(`[AuditFindingModel] Invalid status: "${params.status}". Allowed values: PASS, FAIL, WARNING.`);
    }
    this.status = statusUpper;

    this.ruleId = params.ruleId.trim();
    this.ruleName = params.ruleName.trim();
    this.title = params.title.trim();
    this.description = (params.description || '').trim();

    // Standardize ID: if not provided, derive from ruleId
    this.id = params.id?.trim() || `FND_${this.ruleId.replace(/^RULE_/, '')}`;

    // Auto-derive Severity based on status if omitted
    if (params.severity && ['critical', 'high', 'medium', 'low'].includes(params.severity.toLowerCase())) {
      this.severity = params.severity.toLowerCase() as Severity;
    } else {
      this.severity = this.status === 'PASS' ? 'low' : this.status === 'WARNING' ? 'medium' : 'high';
    }

    // Auto-derive Risk Rating based on status and severity if omitted
    if (params.riskRating && ['High Risk', 'Medium Risk', 'Low Risk', 'Compliant'].includes(params.riskRating)) {
      this.riskRating = params.riskRating;
    } else {
      if (this.status === 'PASS') {
        this.riskRating = 'Compliant';
      } else if (this.status === 'WARNING') {
        this.riskRating = 'Medium Risk';
      } else {
        this.riskRating = this.severity === 'critical' || this.severity === 'high' ? 'High Risk' : 'Medium Risk';
      }
    }

    // Auto-derive Recommendation if omitted
    if (params.recommendation && params.recommendation.trim().length > 0) {
      this.recommendation = params.recommendation.trim();
    } else {
      this.recommendation = this.status === 'PASS' 
        ? 'No action required.' 
        : 'Investigate variance and verify supporting documentation.';
    }

    // Standardize Evidence Citations
    this.evidenceCitations = (params.evidenceCitations || []).map(cit => AuditFindingModel.normalizeCitation(cit));
  }

  /**
   * Primary factory method to create an audit finding
   */
  public static create(params: AuditFindingParams): AuditFindingModel {
    return new AuditFindingModel(params);
  }

  /**
   * Helper to normalize raw evidence citations into strictly typed EvidenceCitation objects
   */
  public static normalizeCitation(raw: RawEvidenceInput | EvidenceCitation): EvidenceCitation {
    const pageNumber = typeof raw.pageNumber === 'number'
      ? raw.pageNumber
      : (typeof raw.pageNumber === 'string' && !isNaN(Number(raw.pageNumber)) ? Number(raw.pageNumber) : 1);

    const extractedVal = raw.extractedValue !== undefined && raw.extractedValue !== null
      ? String(raw.extractedValue)
      : 'N/A';

    return {
      documentName: raw.documentName?.trim() || 'Document.pdf',
      pageNumber: Math.max(1, pageNumber),
      fieldName: raw.fieldName?.trim() || 'Audited Field',
      extractedValue: extractedVal,
      contextSnippet: raw.contextSnippet ? String(raw.contextSnippet).trim() : undefined
    };
  }

  /**
   * Helper to cite an extracted field cleanly with sensible fallbacks
   */
  public static citeField(
    field: any,
    fieldName: string,
    defaultDoc: string = 'Document.pdf',
    defaultPage: number = 1
  ): EvidenceCitation {
    if (!field) {
      return {
        documentName: defaultDoc,
        pageNumber: defaultPage,
        fieldName,
        extractedValue: 'Not Provided'
      };
    }

    const docName = field.sourceDocument || field.evidences?.[0]?.document_name || defaultDoc;
    const pageNum = field.sourcePage || field.evidences?.[0]?.page_number || defaultPage;
    const val = field.value !== undefined ? field.value : field;

    let displayVal: string;
    if (Array.isArray(val)) {
      displayVal = `${val.length} records`;
    } else if (typeof val === 'object' && val !== null) {
      displayVal = JSON.stringify(val);
    } else {
      displayVal = String(val ?? 'N/A');
    }

    return {
      documentName: docName,
      pageNumber: typeof pageNum === 'number' ? pageNum : (Number(pageNum) || 1),
      fieldName,
      extractedValue: displayVal
    };
  }

  /**
   * Safe parser/normalizer from any raw output returned by a rule function.
   * Ensures backend never crashes even if custom developer rule returns a plain object or partial data.
   */
  public static from(
    data: unknown,
    fallbackContext?: { id: string; name: string; severity?: Severity }
  ): AuditFindingModel {
    if (data instanceof AuditFindingModel) {
      return data;
    }

    if (!data || typeof data !== 'object') {
      const ruleId = fallbackContext?.id || 'UNKNOWN_RULE';
      const ruleName = fallbackContext?.name || 'Unknown Rule';
      return new AuditFindingModel({
        ruleId,
        ruleName,
        status: 'FAIL',
        severity: fallbackContext?.severity || 'high',
        title: `Rule Evaluation Error (${ruleId})`,
        description: `The rule evaluation did not return a valid result object. Received: ${typeof data}`,
        recommendation: 'Fix rule implementation to return an AuditFindingModel instance.'
      });
    }

    const raw = data as Record<string, any>;
    const ruleId = String(raw.ruleId || fallbackContext?.id || 'RULE_UNKNOWN');
    const ruleName = String(raw.ruleName || fallbackContext?.name || 'Unknown Audit Rule');
    const status = (String(raw.status || 'FAIL').toUpperCase() as FindingStatus);

    return new AuditFindingModel({
      id: raw.id,
      ruleId,
      ruleName,
      status: ['PASS', 'FAIL', 'WARNING'].includes(status) ? status : 'FAIL',
      severity: raw.severity || fallbackContext?.severity,
      title: raw.title || `Finding for ${ruleName}`,
      description: raw.description || '',
      evidenceCitations: Array.isArray(raw.evidenceCitations) ? raw.evidenceCitations : [],
      riskRating: raw.riskRating,
      recommendation: raw.recommendation
    });
  }

  /**
   * Validates if a given object conforms to the AuditFinding structure
   */
  public static validate(data: unknown): FindingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      return { isValid: false, errors: ['Input must be a non-null object.'], warnings };
    }

    const obj = data as Record<string, any>;

    if (!obj.ruleId || typeof obj.ruleId !== 'string') {
      errors.push('Field "ruleId" is required and must be a string.');
    }
    if (!obj.ruleName || typeof obj.ruleName !== 'string') {
      errors.push('Field "ruleName" is required and must be a string.');
    }
    if (!obj.title || typeof obj.title !== 'string') {
      errors.push('Field "title" is required and must be a string.');
    }
    if (!obj.status || !['PASS', 'FAIL', 'WARNING'].includes(String(obj.status).toUpperCase())) {
      errors.push('Field "status" must be one of: "PASS", "FAIL", "WARNING".');
    }
    if (obj.severity && !['critical', 'high', 'medium', 'low'].includes(String(obj.severity).toLowerCase())) {
      warnings.push(`Severity "${obj.severity}" is not a recognized level (critical, high, medium, low).`);
    }
    if (obj.evidenceCitations && !Array.isArray(obj.evidenceCitations)) {
      errors.push('Field "evidenceCitations" must be an array.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Plain JSON serializable representation
   */
  public toJSON(): AuditFinding {
    return {
      id: this.id,
      ruleId: this.ruleId,
      ruleName: this.ruleName,
      status: this.status,
      severity: this.severity,
      title: this.title,
      description: this.description,
      evidenceCitations: this.evidenceCitations,
      riskRating: this.riskRating,
      recommendation: this.recommendation
    };
  }

  // Convenience aliases for backward compatibility
  public static pass(params: PassFindingParams): AuditFindingModel {
    return new AuditFindingModel({ ...params, status: 'PASS' });
  }

  public static fail(params: FailFindingParams): AuditFindingModel {
    return new AuditFindingModel({ ...params, status: 'FAIL' });
  }

  public static warning(params: WarningFindingParams): AuditFindingModel {
    return new AuditFindingModel({ ...params, status: 'WARNING' });
  }
}

// Convenient export aliases
export const createFinding = (params: AuditFindingParams) => new AuditFindingModel(params);
export const citeField = AuditFindingModel.citeField;
