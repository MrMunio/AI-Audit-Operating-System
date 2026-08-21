import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  FileSearch,
  Sparkles,
  Download,
  Check,
  Building,
  Info
} from 'lucide-react';
import { AuditFinding, AuditModule, FindingStatus, Severity } from '../types/audit';

interface AuditRuleResultsProps {
  module: AuditModule;
  findings: AuditFinding[];
  overallRiskScore: string;
  onProceedToReport: () => void;
}

export const AuditRuleResults: React.FC<AuditRuleResultsProps> = ({
  module,
  findings,
  overallRiskScore,
  onProceedToReport
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredFindings = findings.filter(f => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'failed') return f.status === 'FAIL';
    if (statusFilter === 'warning') return f.status === 'WARNING';
    if (statusFilter === 'pass') return f.status === 'PASS';
    return true;
  });

  const failCount = findings.filter(f => f.status === 'FAIL').length;
  const warningCount = findings.filter(f => f.status === 'WARNING').length;
  const passCount = findings.filter(f => f.status === 'PASS').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-mono">
      {/* Overall Audit Executive Risk Score Banner */}
      <div className={`rounded-xl p-6 sm:p-8 text-[#E0E0E0] shadow-xl mb-8 border border-[#2A2D35] relative overflow-hidden bg-[#0F1117]`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 bg-blue-950/60 border border-blue-800/50 px-3 py-1 rounded text-xs font-mono mb-3 text-blue-300">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>DETERMINISTIC_AUDIT_RULE_ENGINE (0% Decision Hallucination)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono">
              AUDIT_FINDINGS: {module.title}
            </h2>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl font-sans">
              All rules evaluated purely via deterministic math, relational matching, and logical assertions against extracted evidence.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end bg-[#1A1D23] p-4 rounded border border-[#2A2D35] shrink-0 font-mono">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Audit Assessment Score
            </span>
            <span className={`text-xl font-extrabold tracking-wide mt-1 ${failCount > 0 ? 'text-rose-400' : warningCount > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
              {overallRiskScore}
            </span>
            <div className="flex items-center space-x-3 text-xs text-gray-300 mt-2">
              <span className="text-rose-400 font-bold">{failCount} Exceptions</span>
              <span>•</span>
              <span className="text-amber-400 font-bold">{warningCount} Warnings</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">{passCount} Passed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Generate Report Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-1.5 bg-[#0F1117] p-1.5 rounded-lg border border-[#2A2D35]">
          {[
            { id: 'all', label: `All Rules (${findings.length})` },
            { id: 'failed', label: `Exceptions (${failCount})` },
            { id: 'warning', label: `Warnings (${warningCount})` },
            { id: 'pass', label: `Passed (${passCount})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded text-xs font-mono transition cursor-pointer ${statusFilter === tab.id
                  ? 'bg-blue-600 text-white font-bold shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-[#1A1D23]'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={onProceedToReport}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs px-4 py-2.5 rounded shadow-lg shadow-blue-900/30 transition cursor-pointer self-start sm:self-auto"
        >
          <span>GENERATE_AUDIT_REPORT</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Findings Cards List */}
      <div className="space-y-4 mb-8">
        {filteredFindings.map(finding => {
          const isFail = finding.status === 'FAIL';
          const isWarning = finding.status === 'WARNING';
          const isPass = finding.status === 'PASS';

          return (
            <div
              key={finding.id}
              className={`bg-[#0F1117] rounded-xl border p-6 transition shadow-lg ${isFail
                  ? 'border-rose-800/50 bg-rose-950/10'
                  : isWarning
                    ? 'border-amber-800/50 bg-amber-950/10'
                    : 'border-[#2A2D35]'
                }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div className={`p-2.5 rounded shrink-0 ${isFail
                      ? 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
                      : isWarning
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                        : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                    }`}>
                    {isFail ? <XCircle className="w-6 h-6" /> : isWarning ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono font-bold bg-[#1A1D23] text-gray-300 px-2 py-0.5 rounded border border-[#2A2D35]">
                        {finding.ruleId}
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        {finding.title}
                      </h4>
                    </div>

                    <div className="text-xs text-gray-300 mt-2.5 leading-relaxed font-sans whitespace-pre-line space-y-1">
                      {finding.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className={`px-3 py-1 rounded text-xs font-bold font-mono uppercase tracking-wider ${isFail
                      ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                      : isWarning
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                        : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                    }`}>
                    {finding.status}
                  </span>
                </div>
              </div>

              {/* Evidence Citations Block */}
              {finding.evidenceCitations && finding.evidenceCitations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#2A2D35] bg-[#1A1D23] p-3.5 rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center space-x-1.5 font-mono">
                    <FileSearch className="w-3.5 h-3.5 text-blue-400" />
                    <span>Evidence Document Citations ({finding.evidenceCitations.length})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                    {finding.evidenceCitations.map((cite, idx) => (
                      <div key={idx} className="bg-[#0F1117] border border-[#2A2D35] rounded p-2.5 text-xs">
                        <div className="font-semibold text-white flex items-center justify-between">
                          <span className="truncate">{cite.documentName}</span>
                          <span className="text-[10px] bg-[#1A1D23] text-gray-400 px-1.5 py-0.5 rounded">
                            Page {cite.pageNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1 break-words">
                          {cite.fieldName}: <strong className="text-blue-400">{cite.extractedValue}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Auditor Recommendation */}
              {finding.recommendation && (
                <div className="mt-3.5 pt-3.5 border-t border-[#2A2D35] text-xs text-gray-300 font-sans">
                  <strong className="text-white font-mono block mb-1">Auditor Recommended Action:</strong>
                  <div className="text-gray-300 whitespace-pre-line leading-relaxed pl-1">
                    {finding.recommendation}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
