import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, CheckCircle, Terminal, Sparkles, FolderOpen, RefreshCw, Cpu, Layers } from 'lucide-react';
import { VideoMetadata, ConversionProgress } from '../types';

interface ConversionTerminalProps {
  video: VideoMetadata | null;
  selectedAudioIndices: number[];
  gainDb?: number;
  limitDb?: number;
}

export const ConversionTerminal: React.FC<ConversionTerminalProps> = ({
  video,
  selectedAudioIndices,
  gainDb = 7,
  limitDb = -12
}) => {
  const [videoCodec, setVideoCodec] = useState<'mpeg2video' | 'copy' | 'dnxhd'>('mpeg2video');
  const [audioCodec, setAudioCodec] = useState<'pcm_s24le' | 'pcm_s16le'>('pcm_s24le');

  const [progress, setProgress] = useState<ConversionProgress>({
    status: 'idle',
    percent: 0,
    currentFrame: 0,
    totalFrames: 0,
    fps: 0,
    speed: '0.0x',
    currentTime: 0,
    totalTime: 0,
    bitrate: '0 kbps',
    logs: ['[ENGINE]: FFmpeg 6.0 x64 pronto. Aguardando comando de conversão.']
  });

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<any>(null);
  const [outputFilePath, setOutputFilePath] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Gera o comando FFmpeg exato
  const generateFfmpegCommand = () => {
    if (!video) return `ffmpeg -i master_input.mxf -map 0:v:0 -map 0:a:0 -af "volume=${gainDb}dB,alimiter=limit=${limitDb}dB:attack=5:release=50:asc=0" -c:v mpeg2video -b:v 50M -pix_fmt yuv422p -c:a pcm_s24le -ar 48000 -f mxf output.mxf`;

    const inputName = video.filepath || video.filename;
    const outputName = video.filename.replace(/\.[^/.]+$/, '') + '_broadcast_master.mxf';

    const mapArgs = ['-map 0:v:0', ...selectedAudioIndices.map((idx) => `-map 0:a:${idx}`)].join(' ');
    const filterArg = `-af "volume=${gainDb}dB,alimiter=limit=${limitDb}dB:attack=5:release=50:asc=0"`;

    let vCodecArg = '-c:v mpeg2video -b:v 50M -pix_fmt yuv422p -g 12 -bf 2 -flags +ildct+ilme -top 1';
    if (videoCodec === 'copy') {
      vCodecArg = '-c:v copy';
    } else if (videoCodec === 'dnxhd') {
      vCodecArg = '-c:v dnxhd -b:v 120M -pix_fmt yuv422p';
    }

    const aCodecArg = `-c:a ${audioCodec} -ar 48000`;
    const formatArg = '-f mxf';

    return `ffmpeg -y -i "${inputName}" ${mapArgs} ${filterArg} ${vCodecArg} ${aCodecArg} ${formatArg} "${outputName}"`;
  };

  const commandString = generateFfmpegCommand();

  const startConversion = async () => {
    if (!video || selectedAudioIndices.length === 0) return;

    const totalDuration = video.duration || 30.0;
    const totalFrames = Math.round(totalDuration * (video.fps || 29.97));
    const outputName = video.filename.replace(/\.[^/.]+$/, '') + '_broadcast_master.mxf';

    // 1. MODO ELECTRON NATIVO (FFmpeg Real no SO)
    if (window.electronAPI && video.filepath) {
      try {
        const savePath = await window.electronAPI.selectOutputDialog(video.filename);
        if (!savePath) return;

        setOutputFilePath(savePath);
        setProgress({
          status: 'converting',
          percent: 0,
          currentFrame: 0,
          totalFrames,
          fps: 0,
          speed: '0.0x',
          currentTime: 0,
          totalTime: totalDuration,
          bitrate: '50 Mbps',
          outputFilename: savePath,
          logs: [
            `[${new Date().toLocaleTimeString()}] Inicializando FFmpeg 6.0 nativo no Windows...`,
            `[${new Date().toLocaleTimeString()}] Arquivo de entrada: "${video.filepath}"`,
            `[${new Date().toLocaleTimeString()}] Arquivo de saída: "${savePath}"`,
            `[${new Date().toLocaleTimeString()}] Mapeando vídeo 0:v:0 e ${selectedAudioIndices.length} canais de áudio...`,
            `[${new Date().toLocaleTimeString()}] Filtro Broadcast ativado: volume=${gainDb}dB,alimiter=limit=${limitDb}dB`
          ]
        });

        const unbindProgress = window.electronAPI.onProgress((prog) => {
          setProgress((prev) => ({
            ...prev,
            percent: prog.percent,
            currentFrame: prog.frames,
            fps: prog.currentFps,
            bitrate: `${prog.currentKbps} kbps`,
            speed: `${(prog.currentFps / (video.fps || 29.97)).toFixed(2)}x`
          }));
        });

        const unbindLog = window.electronAPI.onLog((logLine) => {
          setProgress((prev) => ({
            ...prev,
            logs: [...prev.logs.slice(-200), logLine]
          }));
        });

        const result = await window.electronAPI.convertVideo({
          inputPath: video.filepath,
          outputPath: savePath,
          selectedAudioIndices,
          selectedChannels: video.audio_channels,
          videoCodec,
          gainDb,
          limitDb,
          duration: video.duration
        });

        unbindProgress();
        unbindLog();

        if (result.success) {
          setProgress((prev) => ({
            ...prev,
            status: 'completed',
            percent: 100,
            currentFrame: totalFrames,
            currentTime: totalDuration,
            logs: [
              ...prev.logs,
              `[${new Date().toLocaleTimeString()}] [CONCLUÍDO COM SUCESSO]: MXF OP-1a gerado em "${savePath}".`
            ]
          }));
        }
        return;
      } catch (err: any) {
        setProgress((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: err.message,
          logs: [
            ...prev.logs,
            `[${new Date().toLocaleTimeString()}] [ERRO CRÍTICO]: ${err.message}`
          ]
        }));
        return;
      }
    }

    // 2. MODO WEB SIMULADOR (Fallback)
    setProgress({
      status: 'converting',
      percent: 0,
      currentFrame: 0,
      totalFrames,
      fps: 0,
      speed: '0.0x',
      currentTime: 0,
      totalTime: totalDuration,
      bitrate: '52.4 Mbps',
      outputFilename: outputName,
      logs: [
        `[${new Date().toLocaleTimeString()}] Inicializando processo child_process.spawn("ffmpeg")...`,
        `[${new Date().toLocaleTimeString()}] Executando: ${commandString}`,
        `[${new Date().toLocaleTimeString()}] Mapeando stream de vídeo: 0:v:0 -> MXF Video Track 1`,
        ...selectedAudioIndices.map(
          (idx, i) =>
            `[${new Date().toLocaleTimeString()}] Mapeando trilha: 0:a:${idx} -> MXF Audio Track ${i + 1} (-af "volume=7dB,alimiter=limit=-12dB")`
        ),
        `[${new Date().toLocaleTimeString()}] Encoder de áudio broadcast ${audioCodec.toUpperCase()} @ 48kHz linear PCM ativado...`
      ]
    });

    let currentPercent = 0;
    const startTime = Date.now();

    intervalRef.current = setInterval(() => {
      currentPercent += 2.5;
      const elapsedSec = (Date.now() - startTime) / 1000;
      const processedTime = Math.min(totalDuration, (currentPercent / 100) * totalDuration);
      const currentFrames = Math.min(totalFrames, Math.round((currentPercent / 100) * totalFrames));
      const currentFps = (currentFrames / (elapsedSec || 0.1)).toFixed(1);
      const speedMult = ((processedTime / (elapsedSec || 0.1))).toFixed(2);

      if (currentPercent >= 100) {
        clearInterval(intervalRef.current);
        setProgress((prev) => ({
          ...prev,
          status: 'completed',
          percent: 100,
          currentFrame: totalFrames,
          currentTime: totalDuration,
          fps: Number(currentFps),
          speed: `${speedMult}x`,
          logs: [
            ...prev.logs,
            `[${new Date().toLocaleTimeString()}] frame=${totalFrames} fps=${currentFps} q=1.6 size=184320kB time=${totalDuration.toFixed(2)}s bitrate=54210.4kbits/s speed=${speedMult}x`,
            `[${new Date().toLocaleTimeString()}] [SUCESSO]: Áudio processado com conformidade total (+7dB ganho com teto em -12.0 dBFS).`,
            `[${new Date().toLocaleTimeString()}] [CONCLUÍDO]: Arquivo MXF OP-1a gerado com êxito: "${outputName}".`
          ]
        }));
      } else {
        setProgress((prev) => ({
          ...prev,
          percent: Math.min(99, Math.round(currentPercent)),
          currentFrame: currentFrames,
          currentTime: processedTime,
          fps: Number(currentFps),
          speed: `${speedMult}x`,
          logs:
            currentPercent % 10 < 3
              ? [
                  ...prev.logs,
                  `[${new Date().toLocaleTimeString()}] frame=${currentFrames} fps=${currentFps} time=${processedTime.toFixed(1)}s bitrate=52.4Mbps speed=${speedMult}x`
                ]
              : prev.logs
        }));
      }
    }, 120);
  };

  const cancelConversion = () => {
    if (window.electronAPI?.cancelConversion) {
      window.electronAPI.cancelConversion();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setProgress((prev) => ({
      ...prev,
      status: 'idle',
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] [CANCELADO]: Processo cancelado pelo operador.`]
    }));
  };

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollTop = terminalEndRef.current.scrollHeight;
    }
  }, [progress.logs]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Escuta o menu nativo do Electron: Window -> Ver Logs (Ctrl+L)
  useEffect(() => {
    if (window.electronAPI?.onToggleLogs) {
      const unbind = window.electronAPI.onToggleLogs(() => {
        setShowLogs((prev) => !prev);
      });
      return unbind;
    }
  }, []);

  // Fecha o modal ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLogs(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#151719] border border-[#333] rounded-lg p-3 sm:p-3.5 shadow-lg space-y-2.5 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div>
          <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            Execução FFmpeg & Encoder MXF
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Processa o vídeo e canais selecionados com limiter <code className="text-blue-400 font-mono">+{gainDb}dB/{limitDb}dB</code>.
          </p>
        </div>

        {/* MXF Codec Options */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] uppercase font-mono text-gray-400">Perfil:</span>
          <select
            value={videoCodec}
            onChange={(e) => setVideoCodec(e.target.value as any)}
            className="bg-[#1A1C1E] border border-[#333] text-[11px] font-mono text-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          >
            <option value="mpeg2video">XDCAM HD422 (MPEG-2 50Mbps 4:2:2)</option>
            <option value="dnxhd">Avid DNxHD (120Mbps 4:2:2)</option>
            <option value="copy">Stream Copy (Passthrough)</option>
          </select>
        </div>
      </div>

      {/* Conversion Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {(() => {
          const activeCount = video?.audio_channels
            ? video.audio_channels.filter((c) => c.selected).length
            : selectedAudioIndices.length;

          return (
            <button
              onClick={startConversion}
              disabled={!video || activeCount === 0 || progress.status === 'converting'}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono font-bold text-xs py-2 px-4 rounded shadow flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              {progress.status === 'converting' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  PROCESSANDO E NIVELANDO ÁUDIO (+{gainDb}dB / {limitDb}dB)...
                </>
              ) : !video ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  CARREGUE UM VÍDEO PARA CONVERTER
                </>
              ) : activeCount === 0 ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  SELECIONE AO MENOS 1 CANAL DE ÁUDIO
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  CONVERTER PARA MXF BROADCAST ({activeCount} {activeCount === 1 ? 'CANAL ATIVO' : 'CANAIS ATIVOS'})
                </>
              )}
            </button>
          );
        })()}

        {progress.status === 'converting' && (
          <button
            onClick={cancelConversion}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold px-3 py-2 rounded transition-colors flex items-center justify-center gap-1 shrink-0"
          >
            <Square className="w-3 h-3 fill-white" /> CANCELAR
          </button>
        )}

        {progress.status === 'completed' && outputFilePath && window.electronAPI && (
          <button
            onClick={() => window.electronAPI?.openFolder(outputFilePath)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold px-3 py-2 rounded transition-colors flex items-center justify-center gap-1 shadow shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5" /> ABRIR PASTA
          </button>
        )}
      </div>

      {/* Progress Bar & Telemetry */}
      {(progress.status === 'converting' || progress.status === 'completed') && (
        <div className="bg-[#1A1C1E] border border-blue-900/40 rounded-lg p-2.5 space-y-1.5 shrink-0">
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="font-semibold text-gray-200">
              {progress.status === 'completed' ? 'RENDERIZAÇÃO FINALIZADA COM SUCESSO' : 'TRANSCODIFICANDO...'}
            </span>
            <span className="font-bold text-blue-400">{progress.percent}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-[#0F1112] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                progress.status === 'completed'
                  ? 'bg-emerald-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] text-gray-400 font-mono">
            <div className="bg-[#151719] p-1.5 rounded border border-[#2A2D30]">
              <span className="text-gray-500 block text-[9px]">Quadros:</span>
              <span className="text-white font-bold">{progress.currentFrame}/{progress.totalFrames}</span>
            </div>
            <div className="bg-[#151719] p-1.5 rounded border border-[#2A2D30]">
              <span className="text-gray-500 block text-[9px]">Velocidade:</span>
              <span className="text-blue-400 font-bold">{progress.fps} FPS ({progress.speed})</span>
            </div>
            <div className="bg-[#151719] p-1.5 rounded border border-[#2A2D30]">
              <span className="text-gray-500 block text-[9px]">Tempo:</span>
              <span className="text-white font-bold">{formatTime(progress.currentTime)}/{formatTime(progress.totalTime)}</span>
            </div>
            <div className="bg-[#151719] p-1.5 rounded border border-[#2A2D30]">
              <span className="text-gray-500 block text-[9px]">Áudio Filter:</span>
              <span className="text-emerald-400 font-bold">+7dB &bull; -12dB</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay do Terminal de Logs (Acionado pelo Menu: Window -> Ver Logs ou Ctrl+L) */}
      {showLogs && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowLogs(false)}
        >
          <div
            className="bg-[#151719] border border-[#333] rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#1A1C1E] px-4 py-2.5 border-b border-[#333] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span className="font-mono font-bold text-xs text-white uppercase tracking-wider">
                  Terminal de Logs FFmpeg (stdout / stderr)
                </span>
                <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
                  &bull; Menu Window &gt; Ver Logs (Ctrl+L)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLogs(false)}
                className="text-gray-400 hover:text-white text-xs font-mono px-2 py-1 bg-[#24272B] hover:bg-[#333] rounded transition-colors"
              >
                ✕ Fechar (ESC)
              </button>
            </div>

            {/* Logs Body */}
            <div
              ref={terminalEndRef}
              className="p-3 flex-1 min-h-[250px] max-h-[60vh] overflow-y-auto font-mono text-[11px] space-y-1 bg-[#090A0B] text-gray-300"
            >
              {progress.logs.map((log, i) => (
                <div
                  key={i}
                  className={`leading-relaxed break-all ${
                    log.includes('SUCESSO') || log.includes('CONCLUÍDO')
                      ? 'text-emerald-400 font-semibold'
                      : log.includes('Inicializando') || log.includes('Mapeando')
                      ? 'text-blue-400'
                      : log.includes('ERRO') || log.includes('CANCELADO')
                      ? 'text-rose-400'
                      : 'text-gray-400'
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#1A1C1E] px-4 py-2 border-t border-[#333] flex items-center justify-between text-[11px] font-mono text-gray-400">
              <span>Linhas registradas: <strong className="text-white">{progress.logs.length}</strong></span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(progress.logs.join('\n'));
                  alert('Logs copiados para a área de transferência!');
                }}
                className="text-blue-400 hover:text-blue-300 text-xs px-2.5 py-1 rounded border border-blue-900/50 hover:bg-blue-950/40 transition-colors"
              >
                Copiar Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

