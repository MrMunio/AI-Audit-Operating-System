import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Check, 
  Database, 
  Cpu, 
  Key, 
  Globe, 
  Sparkles,
  ShieldCheck,
  Server
} from 'lucide-react';
import { SystemConfig } from '../types/audit';

interface SystemConfigModalProps {
  config: SystemConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (updated: SystemConfig) => void;
}

export const SystemConfigModal: React.FC<SystemConfigModalProps> = ({
  config,
  isOpen,
  onClose,
  onSaveConfig
}) => {
  if (!isOpen) return null;

  const [llmProvider, setLlmProvider] = useState(config.llmProvider);
  const [llmBaseUrl, setLlmBaseUrl] = useState(config.llmBaseUrl);
  const [llmModelId, setLlmModelId] = useState(config.llmModelId);
  const [llmApiKey, setLlmApiKey] = useState('');
  const [ocrEngine, setOcrEngine] = useState(config.ocrEngine);
  const [databaseUrl, setDatabaseUrl] = useState(config.databaseUrl);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async () => {
    const updated: SystemConfig = {
      llmProvider,
      llmBaseUrl,
      llmModelId,
      llmApiKeyConfigured: Boolean(llmApiKey) || config.llmApiKeyConfigured,
      ocrEngine,
      databaseUrl
    };

    // Save to backend
    await fetch('/api/system/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        llmProvider,
        llmBaseUrl,
        llmModelId,
        llmApiKey,
        ocrEngine,
        databaseUrl
      })
    });

    onSaveConfig(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-mono">
      <div className="bg-[#0F1117] rounded-xl shadow-2xl border border-[#2A2D35] max-w-xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#1A1D23] text-white p-5 flex items-center justify-between border-b border-[#2A2D35]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600 rounded">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">SYSTEM_CONFIGURATION</h3>
              <p className="text-xs text-gray-400 font-sans">Configure LLM API Provider, OCR Engine, and Database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2A2D35] rounded transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs text-gray-300 max-h-[75vh] overflow-y-auto">
          {savedSuccess && (
            <div className="bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 p-3 rounded flex items-center space-x-2 font-semibold">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Configuration parameters successfully updated!</span>
            </div>
          )}

          {/* 1. LLM Provider Options */}
          <div className="bg-[#1A1D23] p-4 rounded-lg border border-[#2A2D35] space-y-3">
            <div className="font-bold text-white flex items-center space-x-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>LLM Provider Selection</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className={`p-3 rounded border cursor-pointer flex items-center space-x-2 transition ${
                llmProvider === 'gemini' ? 'bg-blue-950/60 border-blue-500 text-blue-300 font-bold' : 'bg-[#0F1117] border-[#2A2D35] text-gray-300'
              }`}>
                <input
                  type="radio"
                  name="provider"
                  value="gemini"
                  checked={llmProvider === 'gemini'}
                  onChange={() => setLlmProvider('gemini')}
                  className="text-blue-600"
                />
                <span>Gemini API (Server-side)</span>
              </label>

              <label className={`p-3 rounded border cursor-pointer flex items-center space-x-2 transition ${
                llmProvider === 'openai_compatible' ? 'bg-blue-950/60 border-blue-500 text-blue-300 font-bold' : 'bg-[#0F1117] border-[#2A2D35] text-gray-300'
              }`}>
                <input
                  type="radio"
                  name="provider"
                  value="openai_compatible"
                  checked={llmProvider === 'openai_compatible'}
                  onChange={() => setLlmProvider('openai_compatible')}
                  className="text-blue-600"
                />
                <span>OpenAI Compatible API</span>
              </label>
            </div>

            {/* OpenAI Compatible Fields */}
            {llmProvider === 'openai_compatible' && (
              <div className="space-y-3 pt-2 font-sans">
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-gray-300 mb-1">
                    OpenAI Compatible Base URL
                  </label>
                  <input
                    type="text"
                    value={llmBaseUrl}
                    onChange={(e) => setLlmBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full text-xs p-2 bg-[#0F1117] border border-[#2A2D35] text-white rounded focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-semibold text-gray-300 mb-1">
                    Model ID
                  </label>
                  <input
                    type="text"
                    value={llmModelId}
                    onChange={(e) => setLlmModelId(e.target.value)}
                    placeholder="gpt-4o or custom model ID"
                    className="w-full text-xs p-2 bg-[#0F1117] border border-[#2A2D35] text-white rounded focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-semibold text-gray-300 mb-1">
                    LLM API Key
                  </label>
                  <input
                    type="password"
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                    placeholder={config.llmApiKeyConfigured ? '••••••••••••••••' : 'Enter API Key...'}
                    className="w-full text-xs p-2 bg-[#0F1117] border border-[#2A2D35] text-white rounded focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. OCR Engine Selection */}
          <div className="bg-[#1A1D23] p-4 rounded-lg border border-[#2A2D35] space-y-3">
            <div className="font-bold text-white flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>OCR & Document Text Extraction Engine</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'tesseract', label: 'Tesseract OCR (Default / Free)' },
                { id: 'vlm', label: 'VLM Multimodal Engine' },
                { id: 'document_intelligence', label: 'Document Intelligence' },
              ].map(engine => (
                <button
                  key={engine.id}
                  onClick={() => setOcrEngine(engine.id as any)}
                  className={`p-2.5 rounded border text-[11px] font-semibold transition text-left cursor-pointer ${
                    ocrEngine === engine.id
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                      : 'bg-[#0F1117] border-[#2A2D35] text-gray-400 hover:text-white'
                  }`}
                >
                  {engine.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 italic font-sans">
              Note: Digital text PDFs automatically bypass OCR to preserve native document characters and page coordinates.
            </p>
          </div>

          {/* 3. Database Connection */}
          <div className="bg-[#1A1D23] p-4 rounded-lg border border-[#2A2D35] space-y-2">
            <div className="font-bold text-white flex items-center space-x-2">
              <Server className="w-4 h-4 text-blue-400" />
              <span>Database Connection URL</span>
            </div>
            <input
              type="text"
              value={databaseUrl}
              onChange={(e) => setDatabaseUrl(e.target.value)}
              placeholder="sqlite:./audit_os.db or postgresql://user:pass@localhost:5432/audit_db"
              className="w-full text-xs p-2 bg-[#0F1117] border border-[#2A2D35] text-white rounded focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#1A1D23] border-t border-[#2A2D35] flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 font-semibold text-xs text-gray-400 hover:text-white hover:bg-[#2A2D35] rounded transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 font-mono font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg shadow-blue-900/30 transition cursor-pointer"
          >
            SAVE_CONFIGURATION
          </button>
        </div>
      </div>
    </div>
  );
};
