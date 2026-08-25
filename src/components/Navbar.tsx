import React from 'react';
import { Download, Film, Code, Sliders, BookOpen, Layers, Terminal, Sparkles } from 'lucide-react';
import { downloadElectronProjectZip } from '../utils/zipExporter';

interface NavbarProps {
  activeTab: 'converter' | 'code' | 'audio-filter' | 'packaging';
  setActiveTab: (tab: 'converter' | 'code' | 'audio-filter' | 'packaging') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const handleDownload = async () => {
    await downloadElectronProjectZip();
  };

  return (
    <header className="h-14 bg-[#1A1C1E] border-b border-[#333] sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Engine Brand & Version */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-md shadow-blue-600/30">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-white flex items-center">
              MXF Master Engine
              <span className="text-[10px] font-mono font-normal text-gray-400 ml-2 hidden md:inline px-1.5 py-0.5 bg-[#0F1112] rounded border border-[#333]">
                v2.4.0-build.82
              </span>
            </h1>
          </div>
          <p className="text-[10px] text-gray-400 hidden xl:block">
            Mapeamento de Canais &bull; Ganho +7dB &bull; Hard Limiter -12dB True Peak
          </p>
        </div>
      </div>

      {/* Center: Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-[#151719] p-1 rounded-lg border border-[#333]">
        <button
          onClick={() => setActiveTab('converter')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === 'converter'
              ? 'bg-blue-600 text-white shadow-sm font-semibold'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1A1C1E]'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Conversor</span>
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === 'code'
              ? 'bg-blue-600 text-white shadow-sm font-semibold'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1A1C1E]'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Código Electron</span>
          <span className="sm:hidden">Código</span>
        </button>

        <button
          onClick={() => setActiveTab('audio-filter')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === 'audio-filter'
              ? 'bg-blue-600 text-white shadow-sm font-semibold'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1A1C1E]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Filtro Áudio (+7dB/-12dB)</span>
          <span className="md:hidden">Áudio</span>
        </button>

        <button
          onClick={() => setActiveTab('packaging')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === 'packaging'
              ? 'bg-blue-600 text-white shadow-sm font-semibold'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1A1C1E]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Guia & FFmpeg</span>
          <span className="lg:hidden">Guia</span>
        </button>
      </nav>

      {/* Right: Engine Telemetry & Export */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono">
          <span className="text-blue-400">ELECTRON 28.2</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400 uppercase tracking-wider text-[10px]">FFMPEG x64 STATIC</span>
        </div>

        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 bg-[#151719] hover:bg-[#202327] border border-[#333] hover:border-blue-500/50 text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded text-xs font-medium transition-all shadow-sm active:scale-95"
          title="Baixar todos os arquivos do projeto Electron (.zip)"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Baixar Projeto (.zip)</span>
          <span className="sm:hidden">.ZIP</span>
        </button>
      </div>
    </header>
  );
};

