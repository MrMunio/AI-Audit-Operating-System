import React from 'react';
import { 
  ShieldCheck, 
  Settings, 
  Cpu, 
  FileSearch, 
  PlusCircle, 
  Database,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { SystemConfig } from '../types/audit';

interface HeaderProps {
  config: SystemConfig;
  activeModuleTitle?: string;
  onOpenSettings: () => void;
  onResetSession: () => void;
  onSelectModuleClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  activeModuleTitle,
  onOpenSettings,
  onResetSession,
  onSelectModuleClick
}) => {
  return (
    <header className="bg-[#0F1117] border-b border-[#2A2D35] text-[#E0E0E0] sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-md">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold tracking-widest text-blue-400 font-mono">
                AUDIT_<span className="text-white">OS</span>
              </h1>
              <span className="text-[10px] text-gray-500 font-mono bg-[#1E2229] border border-[#2A2D35] px-2 py-0.5 rounded">
                v2.5.0-STABLE
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-mono hidden sm:block">
              Deterministic Rules Engine • Verified Extraction
            </p>
          </div>
        </div>

        {/* Active Module Indicator & Quick Actions */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          {activeModuleTitle && (
            <button
              onClick={onSelectModuleClick}
              className="hidden md:flex items-center space-x-2 bg-[#1E2229] hover:bg-[#2A2D35] text-gray-300 border border-[#2A2D35] px-3 py-1.5 rounded text-xs font-mono transition cursor-pointer"
            >
              <FileSearch className="w-3.5 h-3.5 text-blue-400" />
              <span>Module: <strong className="text-white">{activeModuleTitle}</strong></span>
            </button>
          )}

          {/* Engine Badges */}
          <div className="hidden lg:flex items-center space-x-3 text-xs font-mono">
            <button 
              onClick={onOpenSettings}
              className="flex items-center space-x-1.5 bg-[#1A1D23] hover:bg-[#2A2D35] text-gray-400 px-2.5 py-1 rounded text-[11px] border border-[#2A2D35] transition"
              title="Click to configure OCR & LLM parameters"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>OCR: <strong className="text-emerald-400 uppercase">{config.ocrEngine}</strong></span>
            </button>

            <button 
              onClick={onOpenSettings}
              className="flex items-center space-x-1.5 bg-[#1A1D23] hover:bg-[#2A2D35] text-gray-400 px-2.5 py-1 rounded text-[11px] border border-[#2A2D35] transition"
              title="Click to configure LLM Provider"
            >
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>LLM: <strong className="text-blue-400 capitalize">{config.llmProvider === 'gemini' ? 'Gemini 3.6' : 'OpenAI Compat'}</strong></span>
            </button>
          </div>

          {/* New Session Button */}
          <button
            onClick={onResetSession}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-mono font-bold shadow-lg shadow-blue-900/20 transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>NEW_AUDIT</span>
          </button>

          {/* System Config Button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-gray-400 hover:text-white bg-[#1E2229] hover:bg-[#2A2D35] border border-[#2A2D35] rounded transition cursor-pointer"
            title="System & .ENV Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
