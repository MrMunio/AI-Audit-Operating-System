import React, { useState } from 'react';
import { 
  Receipt, 
  Landmark, 
  ShoppingBag, 
  ShieldAlert, 
  Users, 
  TrendingUp, 
  Boxes, 
  FileCheck, 
  Lock, 
  CreditCard, 
  BadgeDollarSign, 
  Building, 
  DollarSign, 
  ReceiptText, 
  BookOpenCheck,
  Search,
  Sparkles,
  ArrowRight,
  CheckCircle,
  FileText
} from 'lucide-react';
import { AUDIT_MODULES } from '../config/auditModules';
import { AuditCategory, AuditModule } from '../types/audit';

interface ModuleSelectorProps {
  onSelectModule: (module: AuditModule) => void;
  onLoadSamplePack: (moduleId: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Receipt: <Receipt className="w-5 h-5 text-blue-500" />,
  BuildingLibrary: <Landmark className="w-5 h-5 text-indigo-500" />,
  ShoppingBag: <ShoppingBag className="w-5 h-5 text-emerald-500" />,
  ShieldAlert: <ShieldAlert className="w-5 h-5 text-rose-500" />,
  Users: <Users className="w-5 h-5 text-amber-500" />,
  TrendingUp: <TrendingUp className="w-5 h-5 text-purple-500" />,
  Boxes: <Boxes className="w-5 h-5 text-orange-500" />,
  FileCheck: <FileCheck className="w-5 h-5 text-teal-500" />,
  Lock: <Lock className="w-5 h-5 text-red-500" />,
  CreditCard: <CreditCard className="w-5 h-5 text-cyan-500" />,
  BadgeDollarSign: <BadgeDollarSign className="w-5 h-5 text-green-500" />,
  Building: <Building className="w-5 h-5 text-slate-500" />,
  DollarSign: <DollarSign className="w-5 h-5 text-blue-600" />,
  ReceiptText: <ReceiptText className="w-5 h-5 text-yellow-500" />,
  BookOpenCheck: <BookOpenCheck className="w-5 h-5 text-indigo-600" />
};

export const ModuleSelector: React.FC<ModuleSelectorProps> = ({
  onSelectModule,
  onLoadSamplePack
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredModules = AUDIT_MODULES.filter(m => {
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner */}
      <div className="bg-[#0F1117] rounded-xl p-6 sm:p-8 text-[#E0E0E0] shadow-xl mb-8 border border-[#2A2D35] relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 bg-blue-900/40 text-blue-300 border border-blue-500/30 px-3 py-1 rounded text-xs font-mono mb-4">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>DETERMINISTIC_RULES_ENGINE • 0% LLM DECISION HALLUCINATION</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3 text-white font-mono">
            SELECT AUDIT MODULE
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            The platform ingests documents, classifies evidence, extracts structured records using OCR & LLM bridges, and evaluates <strong className="text-gray-200">deterministic audit rules</strong> with exact page number citations.
          </p>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        {/* Category Filters */}
        <div className="flex items-center space-x-1.5 bg-[#0F1117] p-1.5 rounded-lg border border-[#2A2D35] overflow-x-auto">
          {[
            { id: 'all', label: 'All Modules (15)' },
            { id: 'financial', label: 'Financial Audit' },
            { id: 'operational', label: 'Operational Audit' },
            { id: 'compliance', label: 'Tax & Compliance' },
            { id: 'fraud_controls', label: 'Fraud & Controls' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition whitespace-nowrap cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-blue-600 text-white font-bold shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-[#1A1D23]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit module..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0F1117] border border-[#2A2D35] rounded-lg text-xs text-[#E0E0E0] placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono shadow-inner"
          />
        </div>
      </div>

      {/* Audit Module Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredModules.map(module => {
          const icon = ICON_MAP[module.iconName] || <FileText className="w-5 h-5 text-blue-500" />;

          return (
            <div
              key={module.id}
              className="bg-[#0F1117] rounded-xl border border-[#2A2D35] p-5 shadow-lg hover:border-blue-500/50 transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-[#1A1D23] border border-[#2A2D35] rounded-lg group-hover:border-blue-500/40 transition">
                      {icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition font-mono">
                        {module.title}
                      </h3>
                      <span className="text-[11px] font-mono text-gray-500 capitalize">
                        {module.category.replace('_', ' & ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                  {module.description}
                </p>

                {/* Required Documents Badge List */}
                <div className="mb-4">
                  <div className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Required Evidence ({module.requiredDocuments.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {module.requiredDocuments.map((doc, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center text-[10px] bg-[#1A1D23] text-gray-300 px-2 py-0.5 rounded border border-[#2A2D35] font-mono"
                      >
                        {doc.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-[#2A2D35] flex items-center justify-between gap-2">
                {module.samplePackName ? (
                  <button
                    onClick={() => onLoadSamplePack(module.id)}
                    className="flex items-center space-x-1 text-[11px] font-mono font-semibold text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-900/60 px-2.5 py-1.5 rounded transition border border-blue-800/50 cursor-pointer"
                    title="Load pre-configured sample document batch for 1-click test"
                  >
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    <span>Demo Pack</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-500 font-mono">
                    {module.rules.length} Rules Engine
                  </span>
                )}

                <button
                  onClick={() => onSelectModule(module)}
                  className="flex items-center space-x-1.5 text-xs font-mono font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition shadow cursor-pointer ml-auto"
                >
                  <span>START_AUDIT</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
