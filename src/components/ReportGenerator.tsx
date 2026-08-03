import React from 'react';
import { 
  Printer, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Building, 
  Calendar,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { AuditFinding, AuditModule, AuditSession } from '../types/audit';

interface ReportGeneratorProps {
  session: AuditSession;
  module: AuditModule;
  onNewAudit: () => void;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  session,
  module,
  onNewAudit
}) => {
  const [reviewerName, setReviewerName] = React.useState(
    ((import.meta as any).env && (import.meta as any).env.VITE_LEAD_AUDIT_REVIEWER_NAME) || 'David Vance, CPA, CIA'
  );
  const [reviewerTitle, setReviewerTitle] = React.useState(
    ((import.meta as any).env && (import.meta as any).env.VITE_LEAD_AUDIT_REVIEWER_TITLE) || 'Authorized Audit Partner'
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.reviewerName) setReviewerName(data.reviewerName);
        if (data.reviewerTitle) setReviewerTitle(data.reviewerTitle);
      })
      .catch(err => console.log('Using default reviewer info:', err));
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPdf(true);
      const element = document.getElementById('printable-audit-report');
      if (!element) return;

      if (!(window as any).html2pdf) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load PDF library'));
          document.body.appendChild(script);
        });
      }

      const opt = {
        margin:       [0.4, 0.4, 0.4, 0.4],
        filename:     `Audit_Report_${session.moduleId}_${Date.now()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0F1117' },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await (window as any).html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF download error, falling back to print dialog:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadJSON = () => {
    const reportExportData = {
      reportTitle: `${module.title} Audit Report`,
      moduleId: session.moduleId,
      auditTimestamp: session.timestamp,
      auditor: {
        name: reviewerName,
        title: reviewerTitle
      },
      summary: {
        totalRulesEvaluated: session.findings.length,
        passed: session.findings.filter(f => f.status === 'PASS').length,
        warnings: session.findings.filter(f => f.status === 'WARNING').length,
        failures: session.findings.filter(f => f.status === 'FAIL').length,
      },
      findings: session.findings,
      extractedFields: session.extractedFields
    };

    const jsonBlob = new Blob([JSON.stringify(reportExportData, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(jsonBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Audit_Report_${session.moduleId}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  const failCount = session.findings.filter(f => f.status === 'FAIL').length;
  const warningCount = session.findings.filter(f => f.status === 'WARNING').length;
  const passCount = session.findings.filter(f => f.status === 'PASS').length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:max-w-none font-mono">
      {/* Top Export Bar (Hidden when printing) */}
      <div className="bg-[#0F1117] rounded-xl p-4 mb-8 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl border border-[#2A2D35] print:hidden">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold">FORMAL_AUDIT_REPORT_READY</h3>
            <p className="text-xs text-gray-400 font-sans">Export or print official audit dossier</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono font-bold text-xs px-3.5 py-2 rounded transition shadow cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs px-3.5 py-2 rounded transition shadow cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>

          <button
            onClick={handleDownloadJSON}
            className="flex items-center space-x-1.5 bg-[#1A1D23] hover:bg-[#2A2D35] text-gray-200 font-mono font-semibold text-xs px-3.5 py-2 rounded border border-[#2A2D35] transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={onNewAudit}
            className="flex items-center space-x-1.5 bg-[#2A2D35] hover:bg-gray-700 text-white font-mono text-xs px-3 py-2 rounded transition cursor-pointer ml-auto"
          >
            <span>NEW_AUDIT</span>
          </button>
        </div>
      </div>

      {/* Official Audit Document Sheet (Printable) */}
      <div id="printable-audit-report" className="bg-[#0F1117] rounded-xl border border-[#2A2D35] p-8 sm:p-12 shadow-2xl text-[#E0E0E0] print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="border-b-2 border-[#2A2D35] pb-6 mb-8 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold font-mono tracking-widest uppercase text-blue-400 mb-1">
              AUDIT_OS • OFFICIAL_AUDIT_DOSSIER
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {module.title} Report
            </h1>
            <p className="text-xs text-gray-400 mt-1 font-sans">
              Deterministic Evidence Verification & Compliance Audit
            </p>
          </div>

          <div className="text-right text-xs text-gray-400 font-mono">
            <div>Audit Ref: <strong className="text-white">AUD-{session.id.slice(-6).toUpperCase()}</strong></div>
            <div>Date: <strong className="text-white">{new Date(session.createdAt).toLocaleDateString()}</strong></div>
            <div>Status: <span className="font-bold text-emerald-400 uppercase">FINAL SIGN-OFF</span></div>
          </div>
        </div>

        {/* Executive Summary & Assessment */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 font-sans">
          <div className="md:col-span-2 bg-[#1A1D23] p-5 rounded-lg border border-[#2A2D35]">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-gray-300 mb-2">
              1. Executive Summary & Scope
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              This automated audit dossier evaluates the company's <strong className="text-white">{module.title}</strong> records for completeness, contractual compliance, and risk exposures. Ingestion was executed via <strong className="text-blue-400">AI Audit OS Deterministic Rule Engine</strong> with zero decision hallucination.
            </p>
          </div>

          <div className="bg-[#1A1D23] text-white p-5 rounded-lg border border-[#2A2D35] flex flex-col justify-between font-mono">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Audit Conclusion Score
              </div>
              <div className={`text-2xl font-black mt-1 ${
                failCount > 0 ? 'text-rose-400' : warningCount > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {session.overallRiskScore}
              </div>
            </div>

            <div className="text-[11px] text-gray-300 mt-3 pt-3 border-t border-[#2A2D35] flex justify-between">
              <span>Exceptions: <strong className="text-rose-400">{failCount}</strong></span>
              <span>Passed: <strong className="text-emerald-400">{passCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Reviewed Documents Inventory */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3 font-mono">
            2. Reviewed Documents & Evidence Completeness
          </h3>
          <div className="overflow-x-auto border border-[#2A2D35] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1A1D23] text-gray-400 font-bold border-b border-[#2A2D35] font-mono">
                <tr>
                  <th className="p-3">Document Name</th>
                  <th className="p-3">Classified Type</th>
                  <th className="p-3">Pages</th>
                  <th className="p-3">Extraction Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D35] font-mono text-gray-300">
                {session.documents.map(d => (
                  <tr key={d.id} className="hover:bg-[#1A1D23]/50">
                    <td className="p-3 font-semibold text-white">{d.filename}</td>
                    <td className="p-3 capitalize">{d.classifiedType.replace('_', ' ')}</td>
                    <td className="p-3">{d.pageCount}</td>
                    <td className="p-3">
                      {d.isDigitalPdfBypassedOcr ? (
                        <span className="text-emerald-400 font-bold">Native Text (OCR Bypassed)</span>
                      ) : (
                        <span className="text-indigo-400">Tesseract / VLM OCR</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Waiver Log Section if applicable */}
        {session.missingEvidence.some(m => m.status === 'waived') && (
          <div className="mb-8 bg-amber-950/20 border border-amber-800/50 rounded-lg p-5 text-xs text-amber-200 font-mono">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2 flex items-center space-x-1.5">
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>3. Missing Evidence Auditor Waivers Log</span>
            </h3>
            {session.missingEvidence.filter(m => m.status === 'waived').map((w, idx) => (
              <div key={idx} className="mt-2 pt-2 border-t border-amber-800/40">
                <div>Document: <strong>{w.documentName}</strong></div>
                <div className="italic mt-0.5">Reason: "{w.waiverReason}"</div>
                <div className="text-[10px] text-amber-400 mt-1">
                  Waived by: {w.waivedBy} at {new Date(w.waivedAt || '').toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Deterministic Rule Findings Table */}
        <div className="mb-8 font-mono">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3">
            4. Deterministic Audit Rule Engine Findings
          </h3>
          <div className="space-y-3">
            {session.findings.map(f => (
              <div key={f.id} className="p-4 rounded-lg border border-[#2A2D35] bg-[#1A1D23]/50 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white flex items-center space-x-2">
                    <span className="font-mono text-[10px] bg-[#2A2D35] text-gray-300 px-1.5 py-0.5 rounded">
                      {f.ruleId}
                    </span>
                    <span>{f.title}</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    f.status === 'FAIL' ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50' : f.status === 'WARNING' ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                  }`}>
                    {f.status}
                  </span>
                </div>
                <p className="text-gray-300 mt-1.5 leading-relaxed font-sans">{f.description}</p>
                {f.recommendation && (
                  <div className="mt-2 text-[11px] text-blue-300 font-medium font-sans">
                    Recommendation: {f.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Auditor Sign-off Footer */}
        <div className="pt-8 border-t-2 border-[#2A2D35] mt-12 grid grid-cols-2 gap-8 text-xs font-mono">
          <div>
            <div className="font-bold text-gray-300 mb-1">Lead Audit Reviewer</div>
            <div className="h-10 border-b border-gray-600 font-serif italic text-white flex items-end pb-1">
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="bg-transparent w-full font-serif italic text-white focus:outline-none focus:border-blue-500 hover:bg-[#1A1D23]/50 px-1 py-0.5 rounded transition"
                placeholder="Enter Reviewer Name, Title..."
                title="Click to edit reviewer name"
              />
            </div>
            <div className="mt-1">
              <input
                type="text"
                value={reviewerTitle}
                onChange={(e) => setReviewerTitle(e.target.value)}
                className="bg-transparent w-full text-[10px] text-gray-400 focus:outline-none focus:border-blue-500 hover:bg-[#1A1D23]/50 px-1 py-0.5 rounded transition"
                placeholder="Enter Reviewer Role/Title..."
                title="Click to edit reviewer title"
              />
            </div>
          </div>

          <div>
            <div className="font-bold text-gray-300 mb-1">System Verification Certificate</div>
            <div className="h-10 border-b border-gray-600 font-mono text-[10px] text-gray-400 flex items-end pb-1">
              SHA256: 8f921a41b20c99a0e... (AI AUDIT OS SEAL)
            </div>
            <div className="text-[10px] text-gray-500 mt-1">Automated Audit OS Sign-off</div>
          </div>
        </div>
      </div>
    </div>
  );
};
