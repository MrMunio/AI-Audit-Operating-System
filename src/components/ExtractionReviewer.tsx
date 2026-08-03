import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Check, 
  ArrowRight, 
  FileSearch, 
  Sparkles,
  Info,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Brain
} from 'lucide-react';
import { AuditModule, ExtractedFieldMap, ExtractedField } from '../types/audit';

interface ExtractionReviewerProps {
  module: AuditModule;
  extractedFields: ExtractedFieldMap;
  onUpdateField: (key: string, newValue: any) => void;
  onProceedToRules: () => void;
  onReExtract: () => void;
  isExtracting: boolean;
}

export const ExtractionReviewer: React.FC<ExtractionReviewerProps> = ({
  module,
  extractedFields,
  onUpdateField,
  onProceedToRules,
  onReExtract,
  isExtracting
}) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState<string>('');
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());

  const toggleReasoning = (key: string) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const fieldKeys = module.extractedFieldsSchema;

  // Calculate low confidence field count
  const lowConfidenceCount = (Object.values(extractedFields) as ExtractedField[]).filter(
    f => (f.confidence < 0.90 && !f.isUserVerified)
  ).length;

  const handleStartEdit = (field: ExtractedField) => {
    setEditingKey(field.key);
    setEditVal(String(field.value ?? ''));
  };

  const handleSaveEdit = (key: string) => {
    onUpdateField(key, editVal);
    setEditingKey(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Banner */}
      <div className="bg-[#0F1117] border border-[#2A2D35] rounded-xl p-6 shadow-xl mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-400 bg-blue-950/60 border border-blue-800/50 px-2.5 py-1 rounded mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>STRUCTURED_EXTRACTION_ENGINE (Confidence Loop & Citation Tracking)</span>
          </div>
          <h2 className="text-xl font-bold text-white">
            EVIDENCE_VERIFICATION: {module.title}
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-sans">
            Review extracted values, confidence ratings, and source citations. Fields with confidence &lt; 90% require human verification.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onReExtract}
            disabled={isExtracting}
            className="flex items-center space-x-1.5 bg-[#1A1D23] hover:bg-[#2A2D35] text-gray-300 font-mono font-bold text-xs px-3 py-2 rounded border border-[#2A2D35] transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin text-blue-400' : ''}`} />
            <span>RE_RUN_EXTRACTION</span>
          </button>

          <button
            onClick={onProceedToRules}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs px-4 py-2 rounded shadow-lg shadow-blue-900/30 transition cursor-pointer"
          >
            <span>RUN_RULE_ENGINE</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Extraction Loading Banner */}
      {isExtracting && (
        <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-5 mb-6 shadow-lg font-mono animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-900/60 border border-blue-700/60 rounded-lg text-blue-400">
                <Brain className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <span>LLM_FIELD_EXTRACTION_IN_PROGRESS</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                </h4>
                <p className="text-[11px] text-blue-300 font-sans mt-0.5">
                  Chain-of-thought reasoning engine is actively searching uploaded evidence documents and extracting target audit schema fields...
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-2 text-[11px] text-blue-400 bg-blue-950 px-3 py-1.5 rounded border border-blue-800/50">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Text Streams</span>
            </div>
          </div>
        </div>
      )}

      {/* Low Confidence Warning Banner (only when not extracting) */}
      {!isExtracting && lowConfidenceCount > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4 mb-6 flex items-center justify-between text-amber-300 text-xs font-mono">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">HUMAN_IN_THE_LOOP_REVIEW:</span>{' '}
              Found {lowConfidenceCount} field(s) with confidence score &lt; 90%. Please review or edit values before evaluating rules.
            </div>
          </div>
        </div>
      )}

      {/* Extracted Fields Table */}
      <div className="bg-[#0F1117] rounded-xl border border-[#2A2D35] shadow-xl overflow-hidden mb-8 font-mono">
        <div className="px-6 py-4 bg-[#1A1D23] border-b border-[#2A2D35] flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            Target Audit Schema Fields ({fieldKeys.length})
          </h3>
          <span className="text-[11px] text-gray-500 font-mono">
            Source Document Page Citations Attached
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2A2D35] bg-[#1A1D23]/60 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-6">Field Name</th>
                <th className="py-3 px-6">Extracted Value</th>
                <th className="py-3 px-6">Confidence</th>
                <th className="py-3 px-6">Source Citation</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2D35] text-xs">
              {fieldKeys.map(schema => {
                const extracted: ExtractedField = extractedFields[schema.key] || {
                  key: schema.key,
                  label: schema.label,
                  value: 'Not Found',
                  confidence: 0.0,
                  sourceDocument: 'Unassigned',
                  sourcePage: 1
                };

                const isLowConfidence = extracted.confidence < 0.90 && !extracted.isUserVerified;
                const isEditing = editingKey === schema.key;

                return (
                  <React.Fragment key={schema.key}>
                  <tr 
                    className={`hover:bg-[#1A1D23]/60 transition ${
                      isLowConfidence ? 'bg-amber-950/20' : ''
                    }`}
                  >
                    {/* Label & Description */}
                    <td className="py-3.5 px-6 font-semibold text-white">
                      <div>{schema.label}</div>
                      <div className="text-[10px] text-gray-500 font-sans font-normal">
                        {schema.description}
                      </div>
                    </td>

                    {/* Value Field (Editable or Loading) */}
                    <td className="py-3.5 px-6 font-mono font-medium text-white">
                      {isExtracting ? (
                        <div className="flex items-center space-x-2 text-blue-400">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-[11px] font-normal text-blue-300 animate-pulse">Extracting Value...</span>
                        </div>
                      ) : isEditing ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            className="bg-[#1A1D23] border border-blue-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(schema.key)}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="text-white bg-[#1A1D23] px-2.5 py-1 rounded border border-[#2A2D35]">
                            {String(extracted.value ?? 'N/A')}
                          </span>
                          {extracted.isUserVerified && (
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50">
                              Verified
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Confidence Score Pill */}
                    <td className="py-3.5 px-6">
                      {isExtracting ? (
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-blue-950/50 text-blue-300 border border-blue-800/50 animate-pulse">
                          <Brain className="w-3 h-3 animate-spin" />
                          <span>Evaluating...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div className={`px-2.5 py-1 rounded text-[10px] font-bold border ${
                            extracted.confidence >= 0.90
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                              : 'bg-amber-950/40 text-amber-300 border-amber-800/50'
                          }`}>
                            {(extracted.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Citation Source Document & Page */}
                    <td className="py-3.5 px-6 text-gray-400">
                      {isExtracting ? (
                        <div className="text-[11px] text-gray-500 italic animate-pulse">
                          Scanning Evidence Documents...
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center space-x-1.5 text-gray-300">
                            <FileSearch className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="font-semibold text-white">{extracted.sourceDocument}</span>
                            <span className="text-[11px] text-gray-500">(Page {extracted.sourcePage})</span>
                          </div>
                          {extracted.rawSnippet && extracted.rawSnippet !== '' && !extracted.rawSnippet.startsWith('Extraction failed') && (
                            <div className="text-[10px] text-gray-500 font-sans italic max-w-[220px] truncate" title={extracted.rawSnippet}>
                              "{extracted.rawSnippet}"
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Edit + Reasoning Toggle Buttons */}
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {(extracted as any).field_reasoning && (
                          <button
                            onClick={() => toggleReasoning(schema.key)}
                            className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-[#1A1D23] rounded transition cursor-pointer"
                            title="View AI chain-of-thought reasoning"
                          >
                            {expandedReasoning.has(schema.key)
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <Brain className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {!isEditing && (
                          <button
                            onClick={() => handleStartEdit(extracted)}
                            className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-[#1A1D23] rounded transition cursor-pointer"
                            title="Edit extracted value"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Chain-of-Thought Reasoning Row */}
                  {expandedReasoning.has(schema.key) && (extracted as any).field_reasoning && (
                    <tr className="bg-purple-950/10 border-b border-purple-900/20">
                      <td colSpan={5} className="px-6 py-3">
                        <div className="flex items-start space-x-2">
                          <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">AI Chain-of-Thought Reasoning</span>
                            <p className="text-[11px] text-purple-200 font-sans mt-1 whitespace-pre-wrap leading-relaxed">
                              {(extracted as any).field_reasoning}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
