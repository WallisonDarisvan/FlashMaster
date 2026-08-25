import React, { useState } from 'react';
import { FileCode, Copy, Check, Download, Folder, FileJson, FileText, File, Sparkles } from 'lucide-react';
import { ELECTRON_CODE_FILES } from '../data/electronCodeFiles';
import { downloadElectronProjectZip } from '../utils/zipExporter';

export const CodeExplorer: React.FC = () => {
  const [selectedFileName, setSelectedFileName] = useState<string>('main.js');
  const [copied, setCopied] = useState(false);

  const selectedFile = ELECTRON_CODE_FILES.find((f) => f.name === selectedFileName) || ELECTRON_CODE_FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (name: string) => {
    if (name.endsWith('.json')) return <FileJson className="w-4 h-4 text-amber-400" />;
    if (name.endsWith('.js')) return <FileCode className="w-4 h-4 text-blue-400" />;
    if (name.endsWith('.html')) return <FileCode className="w-4 h-4 text-orange-400" />;
    if (name.endsWith('.css')) return <FileCode className="w-4 h-4 text-sky-400" />;
    if (name.endsWith('.md')) return <FileText className="w-4 h-4 text-emerald-400" />;
    return <File className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="bg-[#151719] border border-[#333] rounded-lg overflow-hidden shadow-lg flex flex-col h-[750px]">
      {/* Top Bar */}
      <div className="bg-[#0F1112] px-5 py-3 border-b border-[#333] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-gray-400">
            <Folder className="w-4 h-4 text-blue-400" />
            <span className="text-gray-200 font-semibold font-mono">electron-mxf-converter</span>
            <span className="text-gray-600">/</span>
            <span className="text-blue-400 font-mono font-medium">{selectedFile.name}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-mono text-gray-300 hover:text-white bg-[#1A1C1E] hover:bg-[#25282B] border border-[#333] transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'COPIADO' : 'COPIAR ARQUIVO'}</span>
          </button>

          <button
            onClick={downloadElectronProjectZip}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded text-xs font-mono font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>BAIXAR PROJETO (.ZIP)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: File Tree + Code Viewer */}
      <div className="grid grid-cols-1 md:grid-cols-4 flex-1 min-h-0">
        {/* Left File Tree */}
        <div className="bg-[#0F1112] border-r border-[#333] p-3 flex flex-col overflow-y-auto">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 py-1 mb-2 font-mono">
            Arquivos do Projeto Electron
          </div>

          <div className="space-y-1">
            {ELECTRON_CODE_FILES.map((file) => {
              const isSelected = file.name === selectedFileName;
              return (
                <button
                  key={file.name}
                  onClick={() => setSelectedFileName(file.name)}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs font-mono text-left transition-all ${
                    isSelected
                      ? 'bg-blue-900/20 text-blue-400 border border-blue-800 shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1A1C1E]'
                  }`}
                >
                  {getFileIcon(file.name)}
                  <span className="truncate flex-1">{file.name}</span>
                </button>
              );
            })}
          </div>

          {/* Quick instructions in sidebar */}
          <div className="mt-auto pt-4 border-t border-[#333] text-[11px] text-gray-400 space-y-2 p-2 font-mono">
            <div className="font-semibold text-gray-300 flex items-center gap-1 text-[10px] uppercase">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Execução Local:
            </div>
            <div className="bg-[#151719] p-2 rounded border border-[#2A2D30] text-[10px] text-blue-300 space-y-1">
              <div>$ npm install</div>
              <div>$ npm start</div>
            </div>
          </div>
        </div>

        {/* Right Code Display */}
        <div className="md:col-span-3 flex flex-col bg-[#151719] overflow-hidden">
          {/* File description banner */}
          <div className="bg-[#1A1C1E] px-4 py-2 border-b border-[#333] flex items-center justify-between text-xs font-mono">
            <div className="text-gray-300 text-xs">
              <strong className="text-blue-400">{selectedFile.name}</strong>: {selectedFile.description}
            </div>
            <span className="text-[10px] text-gray-500 uppercase bg-[#0F1112] px-2 py-0.5 rounded border border-[#333]">
              {selectedFile.code.split('\n').length} LINHAS
            </span>
          </div>

          {/* Code Text with Line Numbers */}
          <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed bg-[#090A0B] text-gray-200 select-text">
            <pre className="flex">
              {/* Line numbers */}
              <div className="select-none text-gray-600 text-right pr-4 border-r border-[#2A2D30] mr-4 font-mono">
                {selectedFile.code.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              {/* Code lines */}
              <code className="flex-1 overflow-x-auto whitespace-pre font-mono text-gray-200">
                {selectedFile.code}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

