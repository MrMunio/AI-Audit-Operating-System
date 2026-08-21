import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Check,
  X,
  ArrowRight,
  FileSearch,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Brain,
  Search,
  FileText,
  Layers,
  Table,
  CheckCircle,
  HelpCircle,
  Quote,
  ShieldCheck,
  ExternalLink,
  SlidersHorizontal,
  FolderOpen
} from 'lucide-react';
import {
  AuditModule,
  ExtractedFieldMap,
  ExtractedFieldNode,
  ExtractionStatus,
  FieldEvidence,
  FieldSchemaProperty,
  DocumentFieldSchema
} from '../types/audit';

interface ExtractionReviewerProps {
  module: AuditModule;
  extractedFields: ExtractedFieldMap;
  onUpdateField: (key: string, newValue: any, path?: string[]) => void;
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
  // Selected category tab ('all' or document category key)
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // CoT & Evidence Inspection Modals/Drawers
  const [activeCoT, setActiveCoT] = useState<{ fieldName: string; text: string; confidence?: number; status: string } | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<{ fieldName: string; evidences: FieldEvidence[] } | null>(null);

  // Active inline editing state
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Categories defined in module
  const categories = useMemo(() => {
    return Object.entries(module.documentFieldSchemas || {}).map(([key, schema]: [string, DocumentFieldSchema]) => {
      const reqDoc = module.requiredDocuments.find(r => r.type === key);
      return {
        key,
        name: reqDoc?.name || schema.title || key.replace(/_/g, ' '),
        description: schema.description || reqDoc?.description || '',
        schema,
        allowMultiple: reqDoc?.allowMultiple
      };
    });
  }, [module]);

  // Helper to extract or fallback an ExtractedFieldNode
  const getFieldNode = (key: string, fallbackSchema?: FieldSchemaProperty): ExtractedFieldNode => {
    const node = extractedFields[key];
    if (node && typeof node === 'object' && ('value' in node || 'extraction_status' in node)) {
      return node as ExtractedFieldNode;
    }
    // If raw value
    if (node !== undefined && node !== null) {
      return {
        field_key: key,
        field_label: fallbackSchema?.title || fallbackSchema?.label || key,
        value: node,
        extraction_status: 'success',
        evidences: [],
        confidence: 0.95
      };
    }
    return {
      field_key: key,
      field_label: fallbackSchema?.title || fallbackSchema?.label || key,
      value: null,
      extraction_status: 'data_not_found',
      evidences: [],
      confidence: 0.0
    };
  };

  // Compute summary stats across all schemas
  const summaryStats = useMemo(() => {
    let total = 0;
    let success = 0;
    let notFound = 0;
    let verified = 0;

    categories.forEach(cat => {
      if (cat.schema?.properties) {
        Object.keys(cat.schema.properties).forEach(propK => {
          total++;
          const node = getFieldNode(propK, cat.schema.properties[propK] as FieldSchemaProperty);
          if (node.is_user_verified) verified++;
          if (node.extraction_status === 'success') success++;
          else if (node.extraction_status === 'data_not_found' || node.value === null) notFound++;
        });
      }
    });

    return { total, success, notFound, verified };
  }, [categories, extractedFields]);

  const handleStartEdit = (pathKey: string, currentVal: any) => {
    setEditingPath(pathKey);
    setEditValue(currentVal !== null && currentVal !== undefined ? String(currentVal) : '');
  };

  const handleSaveEdit = (key: string, path?: string[]) => {
    let parsedVal: any = editValue;
    if (editValue.trim() === '') {
      parsedVal = null;
    } else if (!isNaN(Number(editValue)) && editValue.trim() !== '') {
      parsedVal = Number(editValue);
    } else if (editValue.toLowerCase() === 'true') {
      parsedVal = true;
    } else if (editValue.toLowerCase() === 'false') {
      parsedVal = false;
    }

    onUpdateField(key, parsedVal, path);
    setEditingPath(null);
  };

  const renderStatusBadge = (status: ExtractionStatus, confidence?: number) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
            <CheckCircle2 className="w-3 h-3" />
            <span>Success {confidence !== undefined ? `(${(confidence * 100).toFixed(0)}%)` : ''}</span>
          </span>
        );
      case 'partial':
      case 'uncertain':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
            <AlertTriangle className="w-3 h-3" />
            <span>{status.toUpperCase()}</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/50">
            <X className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case 'data_not_found':
      default:
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700">
            <HelpCircle className="w-3 h-3" />
            <span>Not Found</span>
          </span>
        );
    }
  };

  // Recursive Schema Property Node Renderer
  const renderFieldProperty = (
    propKey: string,
    propSchema: FieldSchemaProperty,
    path: string[] = [propKey],
    categoryKey?: string
  ) => {
    const fullPathKey = path.join('.');
    const fieldNode = getFieldNode(path[0], propSchema);

    // If matching search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchKey = propKey.toLowerCase().includes(q);
      const matchLabel = (propSchema.title || propSchema.label || '').toLowerCase().includes(q);
      const matchDesc = (propSchema.description || '').toLowerCase().includes(q);
      const matchVal = String(fieldNode.value || '').toLowerCase().includes(q);
      if (!matchKey && !matchLabel && !matchDesc && !matchVal) return null;
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'success' && fieldNode.extraction_status !== 'success') return null;
      if (statusFilter === 'missing' && fieldNode.extraction_status !== 'data_not_found') return null;
      if (statusFilter === 'verified' && !fieldNode.is_user_verified) return null;
    }

    const isEditing = editingPath === fullPathKey;
    const isVerified = Boolean(fieldNode.is_user_verified);

    // 1. NESTED OBJECT SCHEMA (Dictionary)
    if (propSchema.type === 'object' && propSchema.properties) {
      const nestedObjVal = typeof fieldNode.value === 'object' && fieldNode.value !== null ? fieldNode.value : {};

      return (
        <div key={fullPathKey} className="bg-[#12141C] border border-[#2A2D35] rounded-xl p-4 my-3 shadow-md">
          <div className="flex items-center justify-between border-b border-[#2A2D35] pb-2 mb-3">
            <div className="flex items-center space-x-2">
              <FolderOpen className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {propSchema.title || propSchema.label || propKey}
              </h4>
              <span className="text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800/40">
                Object ({Object.keys(propSchema.properties).length} fields)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {fieldNode.chain_of_thought && (
                <button
                  onClick={() => setActiveCoT({ fieldName: propSchema.title || propKey, text: fieldNode.chain_of_thought!, confidence: fieldNode.confidence, status: fieldNode.extraction_status })}
                  className="p-1 text-purple-400 hover:bg-purple-950/40 rounded transition"
                  title="View AI Chain of Thought"
                >
                  <Brain className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {propSchema.description && (
            <p className="text-[11px] text-gray-400 mb-3 font-sans">{propSchema.description}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(propSchema.properties).map(([subK, subSchema]) =>
              renderFieldProperty(subK, subSchema, [...path, subK], categoryKey)
            )}
          </div>
        </div>
      );
    }

    // 2. ARRAY SCHEMA (List of Records or Items)
    if (propSchema.type === 'array' && propSchema.items) {
      const arrayItems = Array.isArray(fieldNode.value) ? fieldNode.value : [];
      const itemSchema = propSchema.items;

      const fallbackDoc = categories.find(c => c.key === categoryKey)?.name || (categoryKey ? `${categoryKey}.pdf` : 'Evidence Document');
      const arrayEvidences = (fieldNode.evidences && fieldNode.evidences.length > 0)
        ? fieldNode.evidences
        : (arrayItems.length > 0 ? [{
            document_name: fieldNode.sourceDocument || fallbackDoc,
            page_number: fieldNode.sourcePage || 1,
            evidence_text: `Extracted ${arrayItems.length} transaction / record entries from document table.`
          }] : []);

      const hasArrayEvidences = arrayEvidences.length > 0;
      const hasCoT = Boolean(fieldNode.chain_of_thought);

      return (
        <div key={fullPathKey} className="bg-[#12141C] border border-[#2A2D35] rounded-xl p-4 my-3 shadow-md">
          <div className="flex items-center justify-between border-b border-[#2A2D35] pb-2 mb-3">
            <div className="flex items-center space-x-2">
              <Table className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {propSchema.title || propSchema.label || propKey}
              </h4>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/40">
                {arrayItems.length} Record{arrayItems.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {propSchema.description && (
            <p className="text-[11px] text-gray-400 mb-3 font-sans">{propSchema.description}</p>
          )}

          {arrayItems.length === 0 ? (
            <div className="text-xs text-gray-500 italic p-3 bg-[#1A1D23] rounded text-center">
              No list items extracted.
            </div>
          ) : itemSchema.type === 'object' && itemSchema.properties ? (
            <div className="overflow-x-auto rounded border border-[#2A2D35] mb-3">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2A2D35] text-[10px] text-gray-400 uppercase bg-[#1A1D23]">
                    <th className="py-2 px-3">#</th>
                    {Object.entries(itemSchema.properties).map(([k, s]) => (
                      <th key={k} className="py-2 px-3">{s.title || k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2D35]">
                  {arrayItems.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#1A1D23]/60 transition">
                      <td className="py-2 px-3 text-gray-500 font-mono">{idx + 1}</td>
                      {Object.keys(itemSchema.properties || {}).map(subK => {
                        const cellVal = item[subK] !== undefined ? (typeof item[subK] === 'object' && item[subK]?.value !== undefined ? item[subK].value : item[subK]) : '-';
                        return (
                          <td key={subK} className="py-2 px-3 font-mono text-white">
                            {String(cellVal ?? '-')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-3">
              {arrayItems.map((item: any, idx: number) => (
                <span key={idx} className="bg-[#1A1D23] border border-[#2A2D35] px-2.5 py-1 rounded text-xs font-mono text-white">
                  {String(item)}
                </span>
              ))}
            </div>
          )}

          {/* Array Footer Actions: Status, CoT, Evidence Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#1F222A]">
            <div className="flex items-center space-x-2">
              {renderStatusBadge(fieldNode.extraction_status, fieldNode.confidence)}
            </div>

            <div className="flex items-center space-x-2">
              {/* Chain of Thought Button */}
              {hasCoT && (
                <button
                  onClick={() => setActiveCoT({
                    fieldName: propSchema.title || propKey,
                    text: fieldNode.chain_of_thought!,
                    confidence: fieldNode.confidence,
                    status: fieldNode.extraction_status
                  })}
                  className="inline-flex items-center space-x-1.5 text-[11px] text-purple-300 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/50 px-2.5 py-1 rounded transition cursor-pointer"
                  title="Inspect AI reasoning and chain of thought"
                >
                  <Brain className="w-3.5 h-3.5 text-purple-400" />
                  <span>Chain of Thought</span>
                </button>
              )}

              {/* Evidence Citation Button */}
              {hasArrayEvidences && (
                <button
                  onClick={() => setActiveEvidence({
                    fieldName: propSchema.title || propKey,
                    evidences: arrayEvidences
                  })}
                  className="inline-flex items-center space-x-1.5 text-[11px] text-blue-300 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/50 px-2.5 py-1 rounded transition cursor-pointer"
                  title="View document evidence and source snippets"
                >
                  <FileSearch className="w-3.5 h-3.5 text-blue-400" />
                  <span>View Evidence ({arrayEvidences.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 3. SCALAR PRIMITIVES (number, string, boolean, date)
    const evidences = fieldNode.evidences || [];
    const hasEvidences = evidences.length > 0;
    const hasCoT = Boolean(fieldNode.chain_of_thought);

    return (
      <div
        key={fullPathKey}
        className={`bg-[#0F1117] border rounded-xl p-4 transition ${
          fieldNode.extraction_status === 'data_not_found' || fieldNode.value === null
            ? 'border-rose-900/30 hover:border-rose-800/50'
            : isVerified
            ? 'border-emerald-800/40 bg-emerald-950/10'
            : 'border-[#2A2D35] hover:border-blue-500/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          {/* Label & Description */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <h5 className="text-xs font-bold text-white truncate">
                {propSchema.title || propSchema.label || propKey}
              </h5>
              <span className="text-[9px] font-mono text-gray-500 uppercase bg-[#1A1D23] px-1.5 py-0.5 rounded border border-[#2A2D35]">
                {propSchema.type}
              </span>
              {isVerified && (
                <span className="inline-flex items-center space-x-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.2 rounded">
                  <Check className="w-2.5 h-2.5" />
                  <span>Verified</span>
                </span>
              )}
            </div>
            {propSchema.description && (
              <p className="text-[11px] text-gray-400 font-sans mt-0.5 line-clamp-2">
                {propSchema.description}
              </p>
            )}
          </div>

          {/* Value Display / Edit Input */}
          <div className="flex items-center space-x-2 shrink-0">
            {isEditing ? (
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="bg-[#1A1D23] border border-blue-500 rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none w-36 sm:w-48"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveEdit(path[0], path);
                    if (e.key === 'Escape') setEditingPath(null);
                  }}
                />
                <button
                  onClick={() => handleSaveEdit(path[0], path)}
                  className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                  title="Save changes"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingPath(null)}
                  className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded cursor-pointer"
                  title="Cancel edit"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-1 rounded font-mono text-xs font-semibold border ${
                  fieldNode.value !== null && fieldNode.value !== undefined
                    ? 'bg-[#1A1D23] text-white border-[#2A2D35]'
                    : 'bg-rose-950/30 text-rose-300 border-rose-800/40'
                }`}>
                  {fieldNode.value !== null && fieldNode.value !== undefined
                    ? (typeof fieldNode.value === 'number' && propSchema.format === 'currency'
                        ? `$${fieldNode.value.toLocaleString()}`
                        : String(fieldNode.value))
                    : 'Not Found'}
                </span>

                <button
                  onClick={() => handleStartEdit(fullPathKey, fieldNode.value)}
                  className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#1A1D23] rounded transition cursor-pointer"
                  title="Edit value"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions: Status, CoT Button, Evidence Button */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#1F222A]">
          <div className="flex items-center space-x-2">
            {renderStatusBadge(fieldNode.extraction_status, fieldNode.confidence)}
          </div>

          <div className="flex items-center space-x-2">
            {/* Chain of Thought Button */}
            {hasCoT && (
              <button
                onClick={() => setActiveCoT({
                  fieldName: propSchema.title || propKey,
                  text: fieldNode.chain_of_thought!,
                  confidence: fieldNode.confidence,
                  status: fieldNode.extraction_status
                })}
                className="inline-flex items-center space-x-1.5 text-[11px] text-purple-300 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/50 px-2.5 py-1 rounded transition cursor-pointer"
                title="Inspect AI reasoning and chain of thought"
              >
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span>Chain of Thought</span>
              </button>
            )}

            {/* Evidence Citation Button */}
            {hasEvidences && (
              <button
                onClick={() => setActiveEvidence({
                  fieldName: propSchema.title || propKey,
                  evidences
                })}
                className="inline-flex items-center space-x-1.5 text-[11px] text-blue-300 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/50 px-2.5 py-1 rounded transition cursor-pointer"
                title="Inspect source document text citations"
              >
                <Quote className="w-3 h-3 text-blue-400" />
                <span>Evidence ({evidences.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-mono">
      {/* Top Banner */}
      <div className="bg-[#0F1117] border border-[#2A2D35] rounded-xl p-6 shadow-xl mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-400 bg-blue-950/60 border border-blue-800/50 px-2.5 py-1 rounded mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>DYNAMIC_HIERARCHICAL_EXTRACTION_ENGINE</span>
          </div>
          <h2 className="text-xl font-bold text-white">
            EVIDENCE_VERIFICATION: {module.title}
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-sans">
            Review structured hierarchical schemas, AI Chain of Thought, and multi-document evidence citations.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onReExtract}
            disabled={isExtracting}
            className="flex items-center space-x-1.5 bg-[#1A1D23] hover:bg-[#2A2D35] text-gray-300 font-bold text-xs px-3 py-2 rounded border border-[#2A2D35] transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin text-blue-400' : ''}`} />
            <span>RE_RUN_EXTRACTION</span>
          </button>

          <button
            onClick={onProceedToRules}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded shadow-lg shadow-blue-900/30 transition cursor-pointer"
          >
            <span>RUN_RULE_ENGINE</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0F1117] border border-[#2A2D35] rounded-xl p-3.5">
          <span className="text-[10px] text-gray-400 uppercase">Schema Fields</span>
          <div className="text-lg font-bold text-white mt-0.5">{summaryStats.total}</div>
        </div>
        <div className="bg-[#0F1117] border border-[#2A2D35] rounded-xl p-3.5">
          <span className="text-[10px] text-emerald-400 uppercase">Extracted OK</span>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">{summaryStats.success}</div>
        </div>
        <div className="bg-[#0F1117] border border-[#2A2D35] rounded-xl p-3.5">
          <span className="text-[10px] text-rose-400 uppercase">Exceptions / Missing</span>
          <div className="text-lg font-bold text-rose-400 mt-0.5">{summaryStats.notFound}</div>
        </div>
        <div className="bg-[#0F1117] border border-[#2A2D35] rounded-xl p-3.5">
          <span className="text-[10px] text-blue-400 uppercase">Human Verified</span>
          <div className="text-lg font-bold text-blue-400 mt-0.5">{summaryStats.verified}</div>
        </div>
      </div>

      {/* Extraction In Progress Notification */}
      {isExtracting && (
        <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-4 mb-6 shadow-lg animate-pulse flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="w-5 h-5 text-blue-400 animate-spin" />
            <div>
              <span className="text-xs font-bold text-white uppercase">LLM_HIERARCHICAL_EXTRACTION_ACTIVE</span>
              <p className="text-[11px] text-blue-300 font-sans mt-0.5">
                Executing multi-document reasoning and structured JSON Schema extraction across evidence files...
              </p>
            </div>
          </div>
          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
        </div>
      )}

      {/* Category Tabs & Filter Header */}
      <div className="bg-[#0F1117] border border-[#2A2D35] rounded-xl p-4 mb-6 space-y-4">
        {/* Document Category Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-[#1A1D23] text-gray-400 hover:text-white'
            }`}
          >
            All Categories ({summaryStats.total})
          </button>
          {categories.map(cat => {
            const propCount = cat.schema?.properties ? Object.keys(cat.schema.properties).length : 0;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  selectedCategory === cat.key
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-[#1A1D23] text-gray-400 hover:text-white'
                }`}
              >
                <span>{cat.name}</span>
                <span className="text-[10px] opacity-75">({propCount})</span>
                {cat.allowMultiple && (
                  <span className="text-[9px] bg-blue-900/60 px-1 py-0.2 rounded text-blue-200">
                    Multi
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#1F222A]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter fields by name, key, or value..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#1A1D23] border border-[#2A2D35] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-[#1A1D23] p-1 rounded-lg border border-[#2A2D35]">
            {[
              { id: 'all', label: 'All' },
              { id: 'success', label: 'Success' },
              { id: 'missing', label: 'Exceptions' },
              { id: 'verified', label: 'Verified' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded text-[11px] transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Render Schema Fields per Selected Category */}
      <div className="space-y-6">
        {categories
          .filter(cat => selectedCategory === 'all' || selectedCategory === cat.key)
          .map(cat => {
            const props = cat.schema?.properties || {};
            const propEntries = Object.entries(props);

            if (propEntries.length === 0) return null;

            return (
              <div key={cat.key} className="bg-[#0F1117] border border-[#2A2D35] rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#2A2D35] pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      {cat.name}
                    </h3>
                    <span className="text-[10px] text-gray-400 bg-[#1A1D23] px-2 py-0.5 rounded border border-[#2A2D35]">
                      {propEntries.length} Schema Properties
                    </span>
                  </div>
                  {cat.allowMultiple && (
                    <span className="text-[10px] text-blue-300 bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 rounded">
                      Multi-File Extraction Enabled
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {propEntries.map(([propK, propDef]) =>
                    renderFieldProperty(propK, propDef as FieldSchemaProperty, [propK], cat.key)
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* CHAIN OF THOUGHT MODAL / POPOVER */}
      {activeCoT && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F1117] border border-purple-800/60 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2D35] pb-3">
              <div className="flex items-center space-x-2 text-purple-400">
                <Brain className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  AI Chain-of-Thought Reasoning
                </h4>
              </div>
              <button
                onClick={() => setActiveCoT(null)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-gray-400">Target Field:</span>
              <div className="text-xs font-bold text-white font-mono bg-[#1A1D23] px-3 py-1.5 rounded border border-[#2A2D35]">
                {activeCoT.fieldName}
              </div>
            </div>

            <div className="bg-purple-950/20 border border-purple-900/40 rounded-xl p-4">
              <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">
                Step-by-Step Observation & Deduction
              </span>
              <p className="text-xs text-purple-100 font-sans mt-2 whitespace-pre-wrap leading-relaxed">
                {activeCoT.text}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveCoT(null)}
                className="px-4 py-1.5 bg-[#1A1D23] hover:bg-[#2A2D35] text-white text-xs font-bold rounded border border-[#2A2D35] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVIDENCE CITATIONS MODAL / DRAWER */}
      {activeEvidence && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F1117] border border-blue-800/60 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2A2D35] pb-3 shrink-0">
              <div className="flex items-center space-x-2 text-blue-400">
                <FileSearch className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Document Evidence Citations ({activeEvidence.evidences.length})
                </h4>
              </div>
              <button
                onClick={() => setActiveEvidence(null)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="shrink-0">
              <span className="text-xs text-gray-400">Target Field:</span>
              <div className="text-xs font-bold text-white font-mono bg-[#1A1D23] px-3 py-1.5 rounded border border-[#2A2D35] mt-1">
                {activeEvidence.fieldName}
              </div>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {activeEvidence.evidences.map((ev, idx) => (
                <div key={idx} className="bg-[#1A1D23] border border-[#2A2D35] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-blue-300">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="font-bold">{ev.document_name || 'Evidence Document'}</span>
                    </div>
                    <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded font-mono">
                      Page {ev.page_number || 1}
                    </span>
                  </div>

                  <div className="bg-[#0F1117] border border-[#2A2D35] rounded p-3 text-xs text-gray-300 font-sans italic">
                    "{ev.evidence_text}"
                  </div>

                  <div className="text-[10px] text-gray-500 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    <span>Exact raw snippet captured from document OCR / digital text stream</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#2A2D35] shrink-0">
              <button
                onClick={() => setActiveEvidence(null)}
                className="px-4 py-1.5 bg-[#1A1D23] hover:bg-[#2A2D35] text-white text-xs font-bold rounded border border-[#2A2D35] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
