import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  FileCheck2, 
  AlertCircle, 
  Sparkles, 
  Trash2, 
  ArrowRight,
  ShieldCheck,
  FileCode,
  Zap,
  Info
} from 'lucide-react';
import { AuditModule, UploadedDocument } from '../types/audit';

interface DocumentUploaderProps {
  module: AuditModule;
  uploadedDocs: UploadedDocument[];
  onAddDocument: (doc: UploadedDocument, text: string) => void;
  onAddDocuments: (docs: UploadedDocument[]) => void;
  onRemoveDocument: (docId: string) => void;
  onProceedToExtraction: () => void;
  onLoadSamplePack: () => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  module,
  uploadedDocs,
  onAddDocument,
  onAddDocuments,
  onRemoveDocument,
  onProceedToExtraction,
  onLoadSamplePack
}) => {

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processSingleFile = (file: File): Promise<UploadedDocument> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Content = (e.target?.result as string).split(',')[1];

          // 1. Parse document
          const parseRes = await fetch('/api/document/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type || 'application/pdf',
              base64Data: base64Content
            })
          });
          const parseData = await parseRes.json();

          // 2. Classify document
          const classifyRes = await fetch('/api/document/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              sampleText: parseData.extractedText || '',
              targetDocuments: module.requiredDocuments || [],
              maxWords: 5000
            })
          });
          const classifyData = await classifyRes.json();

          const newDoc: UploadedDocument = {
            id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/pdf',
            classifiedType: classifyData.classifiedType || 'supporting_document',
            classificationConfidence: classifyData.confidence || 0.90,
            pageCount: parseData.pageCount || 1,
            isDigitalPdfBypassedOcr: parseData.isDigitalPdfBypassedOcr || false,
            rawText: parseData.extractedText,
            uploadedAt: new Date().toISOString()
          };

          resolve(newDoc);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const processFilesBatch = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setUploadMessage(`Processing ${files.length} evidence document(s)...`);

    try {
      const newDocs: UploadedDocument[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadMessage(`Parsing & Classifying (${i + 1}/${files.length}): ${file.name}`);
        const doc = await processSingleFile(file);
        newDocs.push(doc);
      }
      onAddDocuments(newDocs);
    } catch (err: any) {
      console.error('Batch file processing error:', err);
    } finally {
      setIsProcessing(false);
      setUploadMessage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      processFilesBatch(files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      processFilesBatch(files);
    }
  };


  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0F1117] border border-[#2A2D35] rounded-xl p-6 shadow-xl mb-8">
        <div>
          <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-950/60 border border-blue-800/50 px-2.5 py-1 rounded uppercase tracking-wider">
            {module.category.replace('_', ' ')} Pack
          </span>
          <h2 className="text-xl font-mono font-bold text-white mt-2">
            EVIDENCE_UPLOAD: {module.title}
          </h2>
          <p className="text-xs font-mono text-gray-400 mt-1">
            Upload PDFs, scanned images, receipts, or spreadsheets. Digital text PDFs bypass OCR automatically.
          </p>
        </div>

        {/* Load Sample Demo Batch */}
        <button
          onClick={onLoadSamplePack}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs px-4 py-2.5 rounded shadow-lg shadow-blue-900/30 transition cursor-pointer self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4 text-blue-200" />
          <span>LOAD_DEMO_SAMPLE_PACK</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Portal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[220px] font-mono ${
              isDragging
                ? 'border-blue-500 bg-blue-950/20'
                : 'border-[#2A2D35] hover:border-blue-500/50 bg-[#0F1117] hover:bg-[#1A1D23]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-4 bg-blue-950/50 border border-blue-800/40 rounded-xl text-blue-400 mb-3">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-white font-mono">
              DRAG & DROP EVIDENCE DOCUMENTS
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Supports Tax Invoices, POs, Bank Statements, Ledger CSVs, and Receipt scans (PDF, PNG, JPG, CSV).
            </p>
            <div className="mt-4 inline-flex items-center space-x-2 text-[11px] text-gray-400 bg-[#1A1D23] border border-[#2A2D35] px-3 py-1 rounded">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>Native PDF Text Parser active (Bypasses OCR if digital)</span>
            </div>
          </div>

          {isProcessing && (
            <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-4 flex items-center space-x-3 text-xs text-blue-300 font-mono animate-pulse">
              <FileCheck2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span>{uploadMessage || 'Processing document & classifying evidence...'}</span>
            </div>
          )}

          {/* Uploaded Files Table */}
          <div className="bg-[#0F1117] rounded-xl border border-[#2A2D35] shadow-lg overflow-hidden font-mono">
            <div className="px-5 py-3.5 bg-[#1A1D23] border-b border-[#2A2D35] flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                Uploaded Evidence Files ({uploadedDocs.length})
              </h4>
              <span className="text-[11px] text-gray-500">
                Ready for Extraction
              </span>
            </div>

            {uploadedDocs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                No documents uploaded yet. Upload PDFs or click "LOAD_DEMO_SAMPLE_PACK" to test instantly.
              </div>
            ) : (
              <div className="divide-y divide-[#2A2D35]">
                {uploadedDocs.map(doc => (
                  <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-[#1A1D23]/60 transition">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="p-2 bg-[#1A1D23] border border-[#2A2D35] rounded-lg text-blue-400 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-white truncate">
                          {doc.filename}
                        </h5>
                        <div className="flex items-center space-x-2 text-[11px] text-gray-400 mt-0.5">
                          <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{doc.pageCount} {doc.pageCount === 1 ? 'Page' : 'Pages'}</span>
                          <span>•</span>
                          <span className="font-bold text-blue-400 capitalize">
                            Classified: {doc.classifiedType.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      {/* OCR Bypass Badge */}
                      {doc.isDigitalPdfBypassedOcr ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 px-2.5 py-1 rounded font-medium" title="Digital text extracted directly without OCR noise">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>OCR Bypassed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] bg-indigo-950/50 text-indigo-400 border border-indigo-800/50 px-2.5 py-1 rounded font-medium">
                          OCR Processed
                        </span>
                      )}

                      <button
                        onClick={() => onRemoveDocument(doc.id)}
                        className="p-1.5 text-gray-500 hover:text-rose-400 rounded transition cursor-pointer"
                        title="Remove document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Module Evidence Checklist Panel */}
        <div className="space-y-6">
          <div className="bg-[#0F1117] rounded-xl border border-[#2A2D35] p-5 shadow-lg font-mono">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Required Module Evidence</span>
            </h4>

            <div className="space-y-3">
              {module.requiredDocuments.map(req => {
                const matchingDocs = uploadedDocs.filter(d => d.classifiedType === req.type);
                const isUploaded = matchingDocs.length > 0;

                return (
                  <div
                    key={req.type}
                    className={`p-3 rounded border transition ${
                      isUploaded
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                        : req.isMandatory
                        ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                        : 'bg-[#1A1D23] border-[#2A2D35] text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <span className="text-xs font-bold truncate">{req.name}</span>
                        {req.allowMultiple && (
                          <span className="text-[9px] bg-blue-950/80 text-blue-300 border border-blue-800/60 px-1.5 py-0.2 rounded shrink-0">
                            Multi-File
                          </span>
                        )}
                      </div>
                      {isUploaded ? (
                        <span className="text-[10px] font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded flex items-center space-x-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{matchingDocs.length > 1 ? `${matchingDocs.length} Uploaded` : 'Uploaded'}</span>
                        </span>
                      ) : req.isMandatory ? (
                        <span className="text-[10px] font-semibold bg-rose-900/60 text-rose-300 border border-rose-700/50 px-2 py-0.5 rounded shrink-0">
                          Required
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium bg-[#2A2D35] text-gray-400 px-2 py-0.5 rounded shrink-0">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-80 mt-1 font-sans">
                      {req.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Next Step Button */}
            <button
              onClick={onProceedToExtraction}
              disabled={uploadedDocs.length === 0}
              className={`w-full mt-6 py-3 px-4 rounded font-mono font-bold text-xs transition shadow-md flex items-center justify-center space-x-2 cursor-pointer ${
                uploadedDocs.length > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-[#1A1D23] text-gray-600 border border-[#2A2D35] cursor-not-allowed'
              }`}
            >
              <span>EXTRACT_FIELDS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
