import { AuditFinding, AuditModule, ExtractedFieldMap, MissingEvidenceItem, UploadedDocument } from '../types/audit';

export function evaluateModuleRules(
  module: AuditModule,
  extractedFields: ExtractedFieldMap,
  documents: UploadedDocument[]
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  module.rules.forEach(ruleDef => {
    try {
      const finding = ruleDef.evaluate(extractedFields, documents);
      findings.push(finding);
    } catch (err) {
      console.error(`Error evaluating rule ${ruleDef.id}:`, err);
    }
  });

  return findings;
}

export function computeMissingEvidence(
  module: AuditModule,
  uploadedDocs: UploadedDocument[]
): MissingEvidenceItem[] {
  return module.requiredDocuments.map(req => {
    const isUploaded = uploadedDocs.some(
      doc => doc.classifiedType === req.type || doc.classifiedType.includes(req.type)
    );

    return {
      documentType: req.type,
      documentName: req.name,
      isMandatory: req.isMandatory,
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
