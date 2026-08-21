import {
  AuditFinding,
  AuditModule,
  CleanExtractedData,
  ExtractedFieldMap,
  ExtractedFieldNode,
  MissingEvidenceItem,
  UploadedDocument
} from '../types/audit';
import { AuditFindingModel } from '../models/auditFinding';

/**
 * Extracts clean, hierarchical data containing ONLY field values
 * (stripped of chain_of_thought, extraction_status, and evidence wrappers)
 * for consumption by deterministic audit rule functions.
 */
export function extractCleanHierarchicalData(fields: ExtractedFieldMap): CleanExtractedData {
  const cleanData: CleanExtractedData = {};

  function unwrapNode(node: any): any {
    if (node === null || node === undefined) return null;
    if (typeof node !== 'object') return node;

    // If it's an ExtractedFieldNode with .value
    if ('value' in node && ('extraction_status' in node || 'evidences' in node || 'confidence' in node)) {
      return unwrapNode(node.value);
    }

    if (Array.isArray(node)) {
      return node.map(item => unwrapNode(item));
    }

    const unwrappedObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(node)) {
      unwrappedObj[k] = unwrapNode(v);
    }
    return unwrappedObj;
  }

  // Populate cleanData with both hierarchical and flat keys
  for (const [key, node] of Object.entries(fields)) {
    const rawUnwrapped = unwrapNode(node);
    cleanData[key] = rawUnwrapped;

    // If node is an ExtractedFieldNode, create a proxy wrapper so that both
    // fields.my_field.value and fields.my_field work seamlessly
    if (node && typeof node === 'object' && 'value' in node) {
      // Create dual-accessor object
      const val = node.value;
      const dualWrapper: any = {
        value: val,
        sourceDocument: node.sourceDocument || node.evidences?.[0]?.document_name || 'Document',
        sourcePage: node.sourcePage || node.evidences?.[0]?.page_number || 1,
        rawSnippet: node.rawSnippet || node.evidences?.[0]?.evidence_text || '',
        confidence: node.confidence ?? (node.extraction_status === 'success' ? 0.95 : 0.0),
        valueOf: () => val,
        toString: () => String(val ?? ''),
      };
      cleanData[key] = dualWrapper;
    }
  }

  return cleanData;
}

export function evaluateModuleRules(
  module: AuditModule,
  extractedFields: ExtractedFieldMap,
  documents: UploadedDocument[]
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const cleanFields = extractCleanHierarchicalData(extractedFields);

  module.rules.forEach(ruleDef => {
    try {
      const rawFinding = ruleDef.evaluate(cleanFields, documents, extractedFields);
      const standardizedFinding = AuditFindingModel.from(rawFinding, {
        id: ruleDef.id,
        name: ruleDef.name,
        severity: ruleDef.severity
      });
      findings.push(standardizedFinding.toJSON());
    } catch (err: any) {
      console.error(`Error evaluating rule ${ruleDef.id}:`, err);
      const errorFinding = AuditFindingModel.fail({
        ruleId: ruleDef.id,
        ruleName: ruleDef.name,
        severity: ruleDef.severity || 'high',
        title: `Evaluation Error in ${ruleDef.name}`,
        description: `Rule encountered an execution exception: ${err?.message || String(err)}`,
        recommendation: 'Check rule logic or verify input extraction fields for null/unexpected values.'
      });
      findings.push(errorFinding.toJSON());
    }
  });

  return findings;
}

export function computeMissingEvidence(
  module: AuditModule,
  uploadedDocs: UploadedDocument[]
): MissingEvidenceItem[] {
  return module.requiredDocuments.map(req => {
    const matchingDocs = uploadedDocs.filter(
      doc => doc.classifiedType === req.type || doc.classifiedType.includes(req.type)
    );
    const isUploaded = matchingDocs.length > 0;

    return {
      documentType: req.type,
      documentName: req.name,
      isMandatory: req.isMandatory,
      allowMultiple: req.allowMultiple,
      uploadedCount: matchingDocs.length,
      status: isUploaded ? 'uploaded' : 'missing'
    };
  });
}

export function computeOverallRiskScore(findings: AuditFinding[]): 'PASS' | 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK' {
  const hasFailures = findings.some(f => f.status === 'FAIL');
  const hasWarnings = findings.some(f => f.status === 'WARNING');

  if (hasFailures) {
    const criticalFail = findings.some(f => f.status === 'FAIL' && f.severity === 'critical');
    return criticalFail ? 'HIGH RISK' : 'HIGH RISK';
  }

  if (hasWarnings) return 'MEDIUM RISK';
  return 'PASS';
}
