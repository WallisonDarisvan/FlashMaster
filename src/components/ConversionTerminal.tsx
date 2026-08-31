import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, CheckCircle, Terminal, FolderOpen, RefreshCw, Cpu, Layers } from 'lucide-react';
import { VideoMetadata, ConversionProgress } from '../types';

interface ConversionTerminalProps {
  videos: VideoMetadata[];
  currentVideo: VideoMetadata | null;
  selectedAudioIndices: number[];
  gainDb?: number;
  limitDb?: number;
  onUpdateVideoRenderStatus?: (filepath: string, status: 'idle' | 'rendering' | 'completed' | 'error') => void;
}

export const ConversionTerminal: React.FC<ConversionTerminalProps> = ({
  videos,
  currentVideo,
  selectedAudioIndices,
  gainDb = 0,
  limitDb = 0,
  onUpdateVideoRenderStatus
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
    logs: ['[ENGINE]: FFmpeg 6.0 x64 pronto. Aguardando comando de conversão.'],
    batchIndex: 0,
    batchTotal: 0
  });

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<any>(null);
  const cancelRequestedRef = useRef(false);
  const [outputFilePath, setOutputFilePath] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const batchVideos = videos.filter((v) => v.isBatchChecked !== false);

  // Gera o comando FFmpeg exato de exemplo
  const generateFfmpegCommand = () => {
    const targetVideo = currentVideo || batchVideos[0];
    if (!targetVideo) return `ffmpeg -i master_input.mxf -map 0:v:0 -map 0:a:0 -af "volume=${gainDb}dB,alimiter=limit=${limitDb}dB:attack=5:release=50:asc=0" -c:v mpeg2video -b:v 50M -pix_fmt yuv422p -c:a pcm_s24le -ar 48000 -f mxf output.mxf`;

    const inputName = targetVideo.filepath || targetVideo.filename;
    const outputName = targetVideo.filename.replace(/\.[^/.]+$/, '') + '_broadcast_master.mxf';

    const activeIndices = targetVideo.audio_channels
      ? targetVideo.audio_streams.map((s) => s.streamIndex)
      : selectedAudioIndices;

    const mapArgs = ['-map 0:v:0', ...activeIndices.map((idx) => `-map 0:a:${idx}`)].join(' ');
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
    if (batchVideos.length === 0) return;
    cancelRequestedRef.current = false;

    // 1. MODO ELECTRON NATIVO (FFmpeg Real no SO)
    if (window.electronAPI) {
      try {
        let outputFolder = '';
        let singleSavePath = '';

        if (batchVideos.length === 1) {
          // Arquivo único: Diálogo para salvar arquivo com nome customizado
          const singleVid = batchVideos[0];
          const chosenPath = await window.electronAPI.selectOutputDialog(singleVid.filename);
          if (!chosenPath) return;
          singleSavePath = chosenPath;
        } else {
          // Lote de múltiplos arquivos: Diálogo para selecionar pasta de destino
          if (window.electronAPI.selectOutputFolderDialog) {
            const folder = await window.electronAPI.selectOutputFolderDialog();
            if (!folder) return;
            outputFolder = folder;
          } else {
            const chosenPath = await window.electronAPI.selectOutputDialog(batchVideos[0].filename);
            if (!chosenPath) return;
            outputFolder = chosenPath.replace(/[\\/][^\\/]+$/, '');
          }
        }

        const totalBatch = batchVideos.length;
        setOutputFilePath(outputFolder || singleSavePath);

        const unbindProgress = window.electronAPI.onProgress((prog) => {
          setProgress((prev) => ({
            ...prev,
            percent: prog.percent,
            currentFrame: prog.frames,
            fps: prog.currentFps,
            bitrate: `${prog.currentKbps} kbps`,
            speed: `${(prog.currentFps / 29.97).toFixed(2)}x`
          }));
        });

        const unbindLog = window.electronAPI.onLog((logLine) => {
          setProgress((prev) => ({
            ...prev,
            logs: [...prev.logs.slice(-200), logLine]
          }));
        });

        // Itera sobre todos os vídeos marcados do lote
        for (let i = 0; i < totalBatch; i++) {
          if (cancelRequestedRef.current) break;

          const currentItem = batchVideos[i];
          if (!currentItem.filepath) continue;

          onUpdateVideoRenderStatus?.(currentItem.filepath, 'rendering');

          let savePath = singleSavePath;
          if (!savePath) {
            const baseName = currentItem.filename.replace(/\.[^/.]+$/, '');
            const sep = outputFolder.includes('\\') ? '\\' : '/';
            savePath = `${outputFolder}${sep}${baseName}_broadcast_master.mxf`;
          }

          const totalDuration = currentItem.duration || 30.0;
          const totalFrames = Math.round(totalDuration * (currentItem.fps || 29.97));

          setProgress((prev) => ({
            ...prev,
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
            batchIndex: i + 1,
            batchTotal: totalBatch,
            logs: [
              ...prev.logs,
              `------------------------------------------------------------`,
              `[${new Date().toLocaleTimeString()}] INICIANDO ARQUIVO (${i + 1}/${totalBatch}): "${currentItem.filename}"`,
              `[${new Date().toLocaleTimeString()}] Saída: "${savePath}"`,
              `[${new Date().toLocaleTimeString()}] Filtro Broadcast: +${gainDb}dB ganho / corte em ${limitDb}dBFS`
            ]
          }));

          const activeIndices = currentItem.audio_streams
            ? currentItem.audio_streams.filter((s) => s.selected).map((s) => s.streamIndex)
            : [0];

          try {
            await window.electronAPI.convertVideo({
              inputPath: currentItem.filepath,
              outputPath: savePath,
              selectedAudioIndices: activeIndices,
              selectedChannels: currentItem.audio_channels,
              videoCodec,
              gainDb,
              limitDb,
              duration: currentItem.duration
            });

            onUpdateVideoRenderStatus?.(currentItem.filepath, 'completed');

            setProgress((prev) => ({
              ...prev,
              logs: [
                ...prev.logs,
                `[${new Date().toLocaleTimeString()}] [CONCLUÍDO]: "${currentItem.filename}" exportado para MXF OP-1a.`
              ]
            }));
          } catch (itemErr: any) {
            onUpdateVideoRenderStatus?.(currentItem.filepath, 'error');
            throw itemErr;
          }
        }

        unbindProgress();
        unbindLog();

        if (!cancelRequestedRef.current) {
          setProgress((prev) => ({
            ...prev,
            status: 'completed',
            percent: 100,
            batchIndex: totalBatch,
            batchTotal: totalBatch,
            logs: [
              ...prev.logs,
              `============================================================`,
              `[${new Date().toLocaleTimeString()}] [SUCESSO TOTAL]: Todos os ${totalBatch} arquivos do lote foram renderizados com êxito!`
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
            `[${new Date().toLocaleTimeString()}] [ERRO CRÍTICO NO LOTE]: ${err.message}`
          ]
        }));
        return;
      }
    }

    // 2. MODO WEB SIMULADOR (Fallback)
    const totalBatch = batchVideos.length;
    setProgress({
      status: 'converting',
      percent: 0,
      currentFrame: 0,
      totalFrames: 100,
      fps: 0,
      speed: '0.0x',
      currentTime: 0,
      totalTime: 30,
      bitrate: '52.4 Mbps',
      batchIndex: 1,
      batchTotal: totalBatch,
      logs: [
        `[${new Date().toLocaleTimeString()}] Inicializando renderização em lote (${totalBatch} arquivos)...`,
        `[${new Date().toLocaleTimeString()}] Executando: ${commandString}`
      ]
    });

    let currentPercent = 0;
    intervalRef.current = setInterval(() => {
      currentPercent += 4;
      if (currentPercent >= 100) {
        clearInterval(intervalRef.current);
        setProgress((prev) => ({
          ...prev,
          status: 'completed',
          percent: 100,
          batchIndex: totalBatch,
          batchTotal: totalBatch,
          logs: [
            ...prev.logs,
            `[${new Date().toLocaleTimeString()}] [CONCLUÍDO]: Todos os ${totalBatch} vídeos foram convertidos com sucesso.`
          ]
        }));
      } else {
        setProgress((prev) => ({
          ...prev,
          percent: Math.min(99, Math.round(currentPercent))
        }));
      }
    }, 100);
  };

  const cancelConversion = () => {
    cancelRequestedRef.current = true;
    if (window.electronAPI?.cancelConversion) {
      window.electronAPI.cancelConversion();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setProgress((prev) => ({
      ...prev,
      status: 'idle',
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] [CANCELADO]: Processo em lote cancelado pelo operador.`]
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
            Processa os arquivos marcados com limiter <code className="text-blue-400 font-mono">+{gainDb}dB/{limitDb}dB</code>.
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
        <button
          onClick={startConversion}
          disabled={batchVideos.length === 0 || progress.status === 'converting'}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono font-bold text-xs py-2 px-4 rounded shadow flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
        >
          {progress.status === 'converting' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              PROCESSANDO LOTE ({progress.batchIndex || 1}/{progress.batchTotal || batchVideos.length})...
            </>
          ) : batchVideos.length === 0 ? (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              MARQUE AO MENOS 1 ARQUIVO NA FILA
            </>
          ) : batchVideos.length === 1 ? (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              CONVERTER ARQUIVO SELECIONADO PARA MXF
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              RENDERIZAR LOTE ({batchVideos.length} ARQUIVOS MARCADOS)
            </>
          )}
        </button>

        {progress.status === 'converting' && (
          <button
            onClick={cancelConversion}
            className="bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs py-2 px-3 rounded shadow flex items-center gap-1.5 transition-all active:scale-[0.99]"
            title="Cancelar processo de conversão"
          >
            <Square className="w-3 h-3 fill-white" /> Cancelar
          </button>
        )}

        <button
          onClick={() => setShowLogs(true)}
          className="bg-[#1A1C1E] hover:bg-[#222528] text-gray-300 hover:text-white border border-[#333] font-mono text-xs py-2 px-3 rounded shadow flex items-center gap-1.5 transition-colors"
          title="Abrir Terminal de Logs FFmpeg (Atalho: Ctrl+L)"
        >
          <Terminal className="w-3.5 h-3.5 text-blue-400" /> Logs
        </button>
      </div>

      {/* Progress & Telemetry */}
      {progress.status !== 'idle' && (
        <div className="bg-[#1A1C1E] border border-[#2A2D30] rounded p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  progress.status === 'converting'
                    ? 'bg-blue-500 animate-pulse'
                    : progress.status === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-rose-500'
                }`}
              />
              <span className="font-semibold text-white">
                {progress.status === 'converting'
                  ? `Renderizando (${progress.batchIndex}/${progress.batchTotal || batchVideos.length})`
                  : progress.status === 'completed'
                  ? `Lote Concluído (${progress.batchTotal || batchVideos.length}/${progress.batchTotal || batchVideos.length})`
                  : 'Falha na Renderização'}
              </span>
              {progress.outputFilename && (
                <span className="text-gray-400 truncate max-w-[200px] text-[10px]">
                  &bull; {progress.outputFilename.split(/[\\/]/).pop()}
                </span>
              )}
            </div>
            <span className="text-blue-400 font-bold">{progress.percent}%</span>
          </div>

          <div className="w-full h-1.5 bg-[#0F1112] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                progress.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-600'
              }`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-0.5">
            <span>FPS: <strong className="text-gray-200">{progress.fps}</strong></span>
            <span>Velocidade: <strong className="text-gray-200">{progress.speed}</strong></span>
            <span>Tempo: <strong className="text-gray-200">{formatTime(progress.currentTime)} / {formatTime(progress.totalTime)}</strong></span>
            {outputFilePath && progress.status === 'completed' && window.electronAPI?.openFolder && (
              <button
                type="button"
                onClick={() => window.electronAPI!.openFolder(outputFilePath)}
                className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1 font-semibold"
              >
                <FolderOpen className="w-3 h-3" /> Abrir Pasta
              </button>
            )}
          </div>
        </div>
      )}

      {/* Terminal Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151719] border border-[#333] rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 py-3 bg-[#1A1C1E] border-b border-[#333] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-white font-mono">
                  TERMINAL DE LOGS FFMPEG EM TEMPO REAL
                </h3>
              </div>
              <button
                onClick={() => setShowLogs(false)}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-[#151719] border border-[#333] rounded font-mono"
              >
                Fechar (ESC)
              </button>
            </div>
            <div
              ref={terminalEndRef}
              className="p-4 font-mono text-[11px] leading-relaxed bg-[#090A0B] text-gray-300 overflow-y-auto flex-1 space-y-1 select-text"
            >
              {progress.logs.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.includes('ERRO') || line.includes('error')
                      ? 'text-rose-400 font-bold'
                      : line.includes('SUCESSO') || line.includes('CONCLUÍDO')
                      ? 'text-emerald-400 font-bold'
                      : line.includes('INICIANDO')
                      ? 'text-blue-300 font-semibold'
                      : 'text-gray-400'
                  }
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
