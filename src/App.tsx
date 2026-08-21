import React, { useState, useEffect } from 'react';
import {
  Header
} from './components/Header';
import {
  ModuleSelector
} from './components/ModuleSelector';
import {
  DocumentUploader
} from './components/DocumentUploader';
import {
  ExtractionReviewer
} from './components/ExtractionReviewer';
import {
  MissingEvidencePanel
} from './components/MissingEvidencePanel';
import {
  AuditRuleResults
} from './components/AuditRuleResults';
import {
  ReportGenerator
} from './components/ReportGenerator';
import {
  SystemConfigModal
} from './components/SystemConfigModal';

import { AUDIT_MODULES, getAuditModule, getModuleFields } from './config/auditModules';
import { SAMPLE_PACKS } from './config/samplePacks';
import {
  AuditModule,
  AuditSession,
  ExtractedFieldMap,
  MissingEvidenceItem,
  SystemConfig,
  UploadedDocument
} from './types/audit';
import { evaluateModuleRules, computeMissingEvidence, computeOverallRiskScore } from './services/ruleEngine';

export default function App() {
  // System Config State
  const [config, setConfig] = useState<SystemConfig>({
    llmProvider: 'gemini',
    llmBaseUrl: 'https://api.openai.com/v1',
    llmModelId: 'gemini-3.6-flash',
    llmApiKeyConfigured: false,
    ocrEngine: 'tesseract',
    databaseUrl: 'sqlite:./audit_os.db'
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Active Session State
  const [activeModule, setActiveModule] = useState<AuditModule | null>(null);
  const [currentStep, setCurrentStep] = useState<'module_select' | 'uploader' | 'extraction' | 'missing_evidence' | 'rules' | 'report'>('module_select');
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [extractedFields, setExtractedFields] = useState<ExtractedFieldMap>({});
  const [missingEvidenceList, setMissingEvidenceList] = useState<MissingEvidenceItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [auditSession, setAuditSession] = useState<AuditSession | null>(null);

  // Fetch initial config from server
  useEffect(() => {
    fetch('/api/system/config')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setConfig({
            llmProvider: data.llmProvider || 'gemini',
            llmBaseUrl: data.llmBaseUrl || 'https://api.openai.com/v1',
            llmModelId: data.llmModelId || 'gemini-3.6-flash',
            llmApiKeyConfigured: data.llmApiKeyConfigured || false,
            ocrEngine: data.ocrEngine || 'tesseract',
            databaseUrl: data.databaseUrl || 'sqlite:./audit_os.db'
          });
        }
      })
      .catch(err => console.warn('Config fetch warning:', err));
  }, []);

  // Handler to select audit module
  const handleSelectModule = (mod: AuditModule) => {
    setActiveModule(mod);
    setUploadedDocs([]);
    setExtractedFields({});
    setMissingEvidenceList(computeMissingEvidence(mod, []));
    setCurrentStep('uploader');
  };

  // Handler to load 1-click Demo Sample Batch
  const handleLoadSamplePack = (moduleId?: string) => {
    const targetModuleId = moduleId || activeModule?.id || 'expense_audit';
    const mod = getAuditModule(targetModuleId);
    if (!mod) return;

    const sample = SAMPLE_PACKS[targetModuleId] || SAMPLE_PACKS['expense_audit'];

    setActiveModule(mod);
    setUploadedDocs(sample.documents);
    setExtractedFields(sample.extractedFields);
    setMissingEvidenceList(computeMissingEvidence(mod, sample.documents));
    setCurrentStep('extraction');
  };

  const handleAddDocuments = (newDocs: UploadedDocument[]) => {
    setUploadedDocs(prev => {
      const updated = [...prev, ...newDocs];
      if (activeModule) {
        setMissingEvidenceList(computeMissingEvidence(activeModule, updated));
      }
      return updated;
    });
  };

  const handleAddDocument = (doc: UploadedDocument) => {
    handleAddDocuments([doc]);
  };


  const handleRemoveDocument = (docId: string) => {
    const updated = uploadedDocs.filter(d => d.id !== docId);
    setUploadedDocs(updated);
    if (activeModule) {
      setMissingEvidenceList(computeMissingEvidence(activeModule, updated));
    }
  };

  // Trigger LLM Extraction — Multi-Document Category Grouped
  const handleRunExtraction = async () => {
    if (!activeModule || uploadedDocs.length === 0) return;

    setIsExtracting(true);
    setExtractedFields({});
    setCurrentStep('extraction');

    try {
      // Group uploaded documents by classifiedType
      const categoriesMap = new Map<string, {
        categoryKey: string;
        categoryName: string;
        schema: any;
        documents: Array<{ id: string; filename: string; pageCount: number; rawText: string }>;
      }>();

      uploadedDocs.forEach(doc => {
        const catKey = doc.classifiedType || 'supporting_document';
        const reqDoc = activeModule.requiredDocuments.find(r => r.type === catKey);
        const schema = activeModule.documentFieldSchemas?.[catKey] || {
          type: 'object',
          title: reqDoc?.name || catKey,
          description: reqDoc?.description || '',
          properties: {}
        };

        if (!categoriesMap.has(catKey)) {
          categoriesMap.set(catKey, {
            categoryKey: catKey,
            categoryName: reqDoc?.name || catKey.replace(/_/g, ' '),
            schema: schema,
            documents: []
          });
        }

        categoriesMap.get(catKey)!.documents.push({
          id: doc.id,
          filename: doc.filename,
          pageCount: doc.pageCount || 1,
          rawText: doc.rawText || ''
        });
      });

      const res = await fetch('/api/audit/extract-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleTitle: activeModule.title,
          categories: Array.from(categoriesMap.values()),
        })
      });

      const data = await res.json();
      if (data.extractedFields) {
        setExtractedFields(data.extractedFields);
      }
      if (data.warnings) {
        console.warn('[Extraction warnings]', data.warnings);
      }
    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  // Field Manual Override Update (Supports flat key or deep object/array paths)
  const handleUpdateField = (key: string, newValue: any, path?: string[]) => {
    setExtractedFields(prev => {
      const updated = { ...prev };
      if (path && path.length > 1) {
        let curr: any = updated;
        for (let i = 0; i < path.length - 1; i++) {
          if (!curr[path[i]]) curr[path[i]] = {};
          curr = curr[path[i]];
        }
        const lastKey = path[path.length - 1];
        if (curr[lastKey] && typeof curr[lastKey] === 'object' && 'value' in curr[lastKey]) {
          curr[lastKey] = {
            ...curr[lastKey],
            value: newValue,
            is_user_verified: true,
            isUserVerified: true
          };
        } else {
          curr[lastKey] = newValue;
        }
      } else {
        const existing = updated[key] || {};
        updated[key] = {
          ...existing,
          value: newValue,
          is_user_verified: true,
          isUserVerified: true
        };
      }
      return updated;
    });
  };

  // Missing Evidence Waiver Update
  const handleUpdateMissingItem = (updatedItem: MissingEvidenceItem) => {
    setMissingEvidenceList(prev => prev.map(item =>
      item.documentType === updatedItem.documentType ? updatedItem : item
    ));
  };

  // Execute Deterministic Rule Engine
  const handleRunRules = () => {
    if (!activeModule) return;

    const findings = evaluateModuleRules(activeModule, extractedFields, uploadedDocs);
    const riskScore = computeOverallRiskScore(findings);

    const session: AuditSession = {
      id: `session_${Date.now()}`,
      moduleId: activeModule.id,
      moduleTitle: activeModule.title,
      category: activeModule.category,
      createdAt: new Date().toISOString(),
      status: 'rule_evaluation',
      documents: uploadedDocs,
      extractedFields: extractedFields,
      missingEvidence: missingEvidenceList,
      findings: findings,
      overallRiskScore: riskScore
    };

    setAuditSession(session);
    setCurrentStep('rules');
  };

  const handleResetSession = () => {
    setActiveModule(null);
    setUploadedDocs([]);
    setExtractedFields({});
    setMissingEvidenceList([]);
    setAuditSession(null);
    setCurrentStep('module_select');
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] font-sans text-[#E0E0E0] flex flex-col selection:bg-blue-500/30 selection:text-blue-200">
      {/* Header */}
      <Header
        config={config}
        activeModuleTitle={activeModule?.title}
        onOpenSettings={() => setIsConfigOpen(true)}
        onResetSession={handleResetSession}
        onSelectModuleClick={() => setCurrentStep('module_select')}
      />

      {/* Workflow Navigation Stepper Bar */}
      {activeModule && (
        <div className="bg-[#0F1117] border-b border-[#2A2D35] text-gray-300 py-3 shadow-md print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs overflow-x-auto">
            <div className="flex items-center space-x-2 sm:space-x-6 min-w-max">
              {[
                { id: 'module_select', label: '1. Select Module' },
                { id: 'uploader', label: '2. Upload Evidence' },
                { id: 'missing_evidence', label: '3. Missing Evidence' },
                { id: 'extraction', label: '4. Extracted Fields' },
                { id: 'rules', label: '5. Rule Engine' },
                { id: 'report', label: '6. Final Report' },
              ].map(step => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id as any)}
                  className={`flex items-center space-x-1.5 transition cursor-pointer font-mono ${currentStep === step.id
                      ? 'text-blue-400 font-bold border-b-2 border-blue-500 pb-0.5'
                      : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                  <span>{step.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Container Body */}
      <main className="flex-1">
        {currentStep === 'module_select' && (
          <ModuleSelector
            onSelectModule={handleSelectModule}
            onLoadSamplePack={handleLoadSamplePack}
          />
        )}

        {currentStep === 'uploader' && activeModule && (
          <DocumentUploader
            module={activeModule}
            uploadedDocs={uploadedDocs}
            onAddDocument={handleAddDocument}
            onAddDocuments={handleAddDocuments}
            onRemoveDocument={handleRemoveDocument}
            onProceedToExtraction={() => {
              const activeMissing = missingEvidenceList.filter(item => item.status === 'missing');
              if (activeMissing.length > 0) {
                setCurrentStep('missing_evidence');
              } else {
                handleRunExtraction();
              }
            }}
            onLoadSamplePack={() => handleLoadSamplePack(activeModule.id)}
          />
        )}

        {currentStep === 'missing_evidence' && activeModule && (
          <MissingEvidencePanel
            module={activeModule}
            uploadedDocs={uploadedDocs}
            missingEvidenceList={missingEvidenceList}
            onUpdateMissingItem={handleUpdateMissingItem}
            onProceedToRules={handleRunExtraction}
          />
        )}

        {currentStep === 'extraction' && activeModule && (
          <ExtractionReviewer
            module={activeModule}
            extractedFields={extractedFields}
            onUpdateField={handleUpdateField}
            onProceedToRules={handleRunRules}
            onReExtract={handleRunExtraction}
            isExtracting={isExtracting}
          />
        )}

        {currentStep === 'rules' && activeModule && auditSession && (
          <AuditRuleResults
            module={activeModule}
            findings={auditSession.findings}
            overallRiskScore={auditSession.overallRiskScore}
            onProceedToReport={() => setCurrentStep('report')}
          />
        )}

        {currentStep === 'report' && activeModule && auditSession && (
          <ReportGenerator
            session={auditSession}
            module={activeModule}
            onNewAudit={handleResetSession}
          />
        )}
      </main>

      {/* System Settings Modal */}
      <SystemConfigModal
        config={config}
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSaveConfig={(updated) => setConfig(updated)}
      />

      {/* Footer */}
      <footer className="bg-[#0F1117] text-gray-500 border-t border-[#2A2D35] text-[11px] font-mono py-4 mt-12 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 AI AUDIT OS • Deterministic Rules Engine & Evidence Verification Microservice</p>
          <div className="flex items-center space-x-4 text-[10px] text-gray-600">
            <span>LLM: Gemini 3.6 / GPT-4 Turbo</span>
            <span>OCR: Tesseract v5</span>
            <span>DB: PostgreSQL / SQLite</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
