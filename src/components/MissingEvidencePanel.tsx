import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  FileX2, 
  Upload, 
  FileText, 
  ShieldAlert, 
  Check, 
  Sparkles,
  UserCheck,
  Clock
} from 'lucide-react';
import { AuditModule, MissingEvidenceItem, UploadedDocument } from '../types/audit';

interface MissingEvidencePanelProps {
  module: AuditModule;
  uploadedDocs: UploadedDocument[];
  missingEvidenceList: MissingEvidenceItem[];
  onUpdateMissingItem: (item: MissingEvidenceItem) => void;
  onProceedToRules: () => void;
}

export const MissingEvidencePanel: React.FC<MissingEvidencePanelProps> = ({
  module,
  uploadedDocs,
  missingEvidenceList,
  onUpdateMissingItem,
  onProceedToRules
}) => {
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [waiverReason, setWaiverReason] = useState<string>('');
  const [supportingNotes, setSupportingNotes] = useState<string>('');
  const [waivedBy, setWaivedBy] = useState<string>('Senior Lead Auditor');

  const handleSaveWaiver = (item: MissingEvidenceItem) => {
    if (!waiverReason.trim()) return;

    onUpdateMissingItem({
      ...item,
      status: 'waived',
      waiverReason: waiverReason,
      supportingNotes: supportingNotes,
      waivedBy: waivedBy,
      waivedAt: new Date().toISOString()
    });

    setSelectedDocType(null);
    setWaiverReason('');
    setSupportingNotes('');
  };

  const missingCount = missingEvidenceList.filter(i => i.status === 'missing').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-mono">
      {/* Top Banner */}
      <div className="bg-[#0F1117] border border-[#2A2D35] rounded-xl p-6 shadow-xl mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-rose-400 bg-rose-950/60 border border-rose-800/50 px-2.5 py-1 rounded mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>AUTOMATED_MISSING_EVIDENCE_DETECTOR</span>
          </div>
          <h2 className="text-xl font-bold text-white">
            MISSING_EVIDENCE_VERIFICATION
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-sans">
            Required audit documents are evaluated against uploaded files. Missing evidence must be uploaded or formally waived with auditor justification.
          </p>
        </div>

        <button
          onClick={onProceedToRules}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs px-4 py-2.5 rounded shadow-lg shadow-blue-900/30 transition cursor-pointer self-start sm:self-auto"
        >
          <span>PROCEED_TO_EXTRACTION</span>
        </button>
      </div>

      {/* Checklist Grid */}
      <div className="space-y-4 mb-8">
        {missingEvidenceList.map(item => {
          const isUploaded = item.status === 'uploaded';
          const isWaived = item.status === 'waived';
          const isMissing = item.status === 'missing';

          return (
            <div
              key={item.documentType}
              className={`bg-[#0F1117] rounded-xl border p-5 transition shadow-lg ${
                isUploaded
                  ? 'border-emerald-800/40 bg-emerald-950/10'
                  : isWaived
                  ? 'border-amber-800/40 bg-amber-950/10'
                  : 'border-rose-800/40 bg-rose-950/10'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className={`p-2.5 rounded shrink-0 ${
                    isUploaded ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50' : isWaived ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50' : 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
                  }`}>
                    {isUploaded ? <CheckCircle2 className="w-5 h-5" /> : isWaived ? <AlertTriangle className="w-5 h-5" /> : <FileX2 className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-white">
                        {item.documentName}
                      </h4>
                      {item.isMandatory && (
                        <span className="text-[10px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/50 px-2 py-0.5 rounded">
                          Mandatory Evidence
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Type identifier: <code className="text-gray-300 font-mono">{item.documentType}</code>
                    </p>
                  </div>
                </div>

                {/* Status Badges & Action Buttons */}
                <div className="flex items-center space-x-3 shrink-0">
                  {isUploaded && (
                    <span className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-emerald-950/50 text-emerald-400 px-3 py-1.5 rounded border border-emerald-800/50">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Document Uploaded</span>
                    </span>
                  )}

                  {isWaived && (
                    <span className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-amber-950/50 text-amber-300 px-3 py-1.5 rounded border border-amber-800/50">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Evidence Waived</span>
                    </span>
                  )}

                  {isMissing && (
                    <button
                      onClick={() => setSelectedDocType(item.documentType)}
                      className="flex items-center space-x-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-1.5 rounded shadow transition cursor-pointer font-mono"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Waive / Explain Missing Doc</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Display Waiver Log details if waived */}
              {isWaived && item.waiverReason && (
                <div className="mt-4 pt-3 border-t border-amber-800/40 bg-amber-950/30 p-3 rounded text-xs text-amber-200">
                  <div className="font-bold flex items-center space-x-1 mb-1">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Auditor Waiver Logged by {item.waivedBy || 'Auditor'}:</span>
                  </div>
                  <p className="italic">"{item.waiverReason}"</p>
                  {item.supportingNotes && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      Notes: {item.supportingNotes}
                    </p>
                  )}
                </div>
              )}

              {/* Form to log waiver */}
              {selectedDocType === item.documentType && (
                <div className="mt-4 pt-4 border-t border-[#2A2D35] bg-[#1A1D23] p-4 rounded-lg space-y-3 font-mono">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                    PROVIDE AUDITOR WAIVER JUSTIFICATION
                  </h5>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                      Reason for Document Absence
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PO not applicable because emergency hardware purchase was approved directly by CFO."
                      value={waiverReason}
                      onChange={(e) => setWaiverReason(e.target.value)}
                      className="w-full text-xs p-2.5 bg-[#0F1117] border border-[#2A2D35] text-white rounded focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                      Supporting Cross-Reference / Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Referenced email approval ticket #INC-9041"
                      value={supportingNotes}
                      onChange={(e) => setSupportingNotes(e.target.value)}
                      className="w-full text-xs p-2.5 bg-[#0F1117] border border-[#2A2D35] text-white rounded focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setSelectedDocType(null)}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#2A2D35] rounded transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveWaiver(item)}
                      className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded shadow transition cursor-pointer"
                    >
                      Save Auditor Waiver Entry
                    </button>
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
