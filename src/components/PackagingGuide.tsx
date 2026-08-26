import React from 'react';
import { BookOpen, ShieldCheck, Terminal, Layers, Cpu, CheckCircle2, AlertCircle, Code } from 'lucide-react';

export const PackagingGuide: React.FC = () => {
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Title Header */}
      <div className="bg-[#151719] border border-[#333] rounded-lg p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm uppercase font-bold text-gray-200 font-mono flex items-center gap-2 tracking-wider">
            <BookOpen className="w-4 h-4 text-blue-400" />
            Guia de Engenharia: Electron.js + Node.js + FFmpeg
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Arquitetura de software, isolamento de contexto (IPC), embarque de binários estáticos e empacotamento com electron-builder.
          </p>
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Section 1: Security & IPC Architecture */}
        <div className="bg-[#151719] border border-[#333] rounded-lg p-4 space-y-2.5">
          <div className="flex items-center space-x-2 text-blue-400 font-mono font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3>1. Arquitetura de Segurança & IPC</h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Seguindo as melhores práticas oficiais do Electron 28+, o renderer process executa com <code className="bg-[#0F1112] px-1.5 py-0.5 rounded border border-[#333] text-blue-300 font-mono">contextIsolation: true</code> e <code className="bg-[#0F1112] px-1.5 py-0.5 rounded border border-[#333] text-blue-300 font-mono">nodeIntegration: false</code>.
          </p>
          <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside">
            <li><strong className="text-gray-200">main.js:</strong> Executa o Node.js completo, gerencia janelas e orquestra subprocessos do FFmpeg.</li>
            <li><strong className="text-gray-200">preload.js:</strong> Usa <code className="text-blue-400 font-mono">contextBridge.exposeInMainWorld</code> para expor a API segura <code className="text-blue-300 font-mono">window.electronAPI</code>.</li>
            <li><strong className="text-gray-200">renderer.js:</strong> Manipula o DOM da interface e se comunica via <code className="text-gray-300 font-mono">ipcRenderer.invoke()</code> e <code className="text-gray-300 font-mono">ipcRenderer.on()</code>.</li>
          </ul>
        </div>

        {/* Section 2: FFmpeg Static Bundling */}
        <div className="bg-[#151719] border border-[#333] rounded-lg p-4 space-y-2.5">
          <div className="flex items-center space-x-2 text-blue-400 font-mono font-bold text-xs uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-blue-400" />
            <h3>2. Embarque de Binários FFmpeg / ffprobe</h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Para garantir que o usuário final não precise instalar o FFmpeg manualmente no sistema operacional, utilizamos <strong className="text-gray-100 font-mono">ffmpeg-static</strong> e <strong className="text-gray-100 font-mono">ffprobe-static</strong>.
          </p>
          <div className="bg-[#0F1112] p-2.5 rounded border border-[#2A2D30] font-mono text-[11px] text-gray-300 space-y-1">
            <div className="text-gray-500">// Resolução de caminho compatível com ASAR:</div>
            <div>const binPath = ffmpegStatic.replace('app.asar', 'app.asar.unpacked');</div>
            <div>ffmpeg.setFfmpegPath(binPath);</div>
          </div>
          <p className="text-[11px] text-gray-400">
            No <code className="text-gray-300 font-mono">package.json</code>, a chave <code className="text-blue-400 font-mono">"asarUnpack"</code> assegura que os executáveis binários fiquem fora do pacote compactado.
          </p>
        </div>

        {/* Section 3: Audio Filter Breakdown */}
        <div className="bg-[#151719] border border-[#333] rounded-lg p-4 space-y-2.5">
          <div className="flex items-center space-x-2 text-blue-400 font-mono font-bold text-xs uppercase tracking-wider">
            <Layers className="w-4 h-4 text-purple-400" />
            <h3>3. Filtro de Áudio: +7dB Ganho & Limiter -12dB</h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            A regra estrita de áudio é implementada via encadeamento no filtro de áudio (<code className="text-blue-400 font-mono">-af</code>):
          </p>
          <div className="bg-[#0F1112] p-2.5 rounded border border-[#2A2D30] font-mono text-[11px] text-yellow-300">
            -af "volume=7dB,alimiter=limit=-12dB:attack=5:release=50:asc=0"
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <div>&bull; <strong className="text-gray-200">volume=7dB:</strong> Eleva o sinal geral em 7 decibéis.</div>
            <div>&bull; <strong className="text-gray-200">alimiter:</strong> Limitador lookahead com controle de transientes.</div>
            <div>&bull; <strong className="text-gray-200">limit=-12dB:</strong> Garante que nenhum pico ultrapasse o teto de -12.0 dBFS.</div>
            <div>&bull; <strong className="text-gray-200">asc=0:</strong> Desativa auto-scaling para garantir conformidade estrita.</div>
          </div>
        </div>

        {/* Section 4: Channel Mapping & MXF */}
        <div className="bg-[#151719] border border-[#333] rounded-lg p-4 space-y-2.5">
          <div className="flex items-center space-x-2 text-blue-400 font-mono font-bold text-xs uppercase tracking-wider">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3>4. Mapeamento de Streams & Container MXF</h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            O FFmpeg mapeia o primeiro stream de vídeo e somente os canais de áudio marcados pelo operador:
          </p>
          <div className="bg-[#0F1112] p-2.5 rounded border border-[#2A2D30] font-mono text-[11px] text-gray-300 space-y-1">
            <div><span className="text-emerald-400">-map 0:v:0</span> <span className="text-gray-500">// Stream de Vídeo Principal</span></div>
            <div><span className="text-blue-400">-map 0:a:0 -map 0:a:1</span> <span className="text-gray-500">// Apenas áudios selecionados</span></div>
            <div><span className="text-purple-400">-c:a pcm_s24le -ar 48000</span> <span className="text-gray-500">// Broadcast Linear PCM</span></div>
            <div><span className="text-rose-400">-f mxf</span> <span className="text-gray-500">// SMPTE 377M OP-1a Container</span></div>
          </div>
        </div>
      </div>

      {/* Packaging & Build Commands Table */}
      <div className="bg-[#151719] border border-[#333] rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-2">
          <Code className="w-4 h-4 text-blue-400" />
          Comandos de Instalação e Geração de Instaladores
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
          <div className="bg-[#0F1112] p-3 rounded border border-[#333]">
            <span className="text-gray-400 text-xs block font-semibold uppercase text-[10px]">1. Instalação:</span>
            <code className="text-blue-400 text-xs font-mono block mt-1">npm install</code>
            <span className="text-[11px] text-gray-500 mt-1 block font-sans">Instala Electron e pacotes FFmpeg.</span>
          </div>

          <div className="bg-[#0F1112] p-3 rounded border border-[#333]">
            <span className="text-gray-400 text-xs block font-semibold uppercase text-[10px]">2. Execução Local:</span>
            <code className="text-emerald-400 text-xs font-mono block mt-1">npm start</code>
            <span className="text-[11px] text-gray-500 mt-1 block font-sans">Abre a janela desktop do app.</span>
          </div>

          <div className="bg-[#0F1112] p-3 rounded border border-[#333]">
            <span className="text-gray-400 text-xs block font-semibold uppercase text-[10px]">3. Windows Installer:</span>
            <code className="text-amber-400 text-xs font-mono block mt-1">npm run dist:win</code>
            <span className="text-[11px] text-gray-500 mt-1 block font-sans">Gera instalador executável .exe (NSIS).</span>
          </div>

          <div className="bg-[#0F1112] p-3 rounded border border-[#333]">
            <span className="text-gray-400 text-xs block font-semibold uppercase text-[10px]">4. Mac / Linux:</span>
            <code className="text-purple-400 text-xs font-mono block mt-1">npm run dist:mac</code>
            <span className="text-[11px] text-gray-500 mt-1 block font-sans">Gera pacote .dmg / .AppImage.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

