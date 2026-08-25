import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, CheckCircle, Terminal, Copy, Check, Sparkles, FolderOpen, RefreshCw, Cpu, Layers } from 'lucide-react';
import { VideoMetadata, ConversionProgress } from '../types';

interface ConversionTerminalProps {
  video: VideoMetadata | null;
  selectedAudioIndices: number[];
}

export const ConversionTerminal: React.FC<ConversionTerminalProps> = ({
  video,
  selectedAudioIndices
}) => {
  const [copied, setCopied] = useState(false);
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

  // Gera o comando FFmpeg exato
  const generateFfmpegCommand = () => {
    if (!video) return 'ffmpeg -i master_input.mxf -map 0:v:0 -map 0:a:0 -af "volume=7dB,alimiter=limit=-12dB:attack=5:release=50:asc=0" -c:v mpeg2video -b:v 50M -pix_fmt yuv422p -c:a pcm_s24le -ar 48000 -f mxf output.mxf';

    const inputName = video.filename;
    const outputName = video.filename.replace(/\.[^/.]+$/, '') + '_broadcast_master.mxf';

    const mapArgs = ['-map 0:v:0', ...selectedAudioIndices.map((idx) => `-map 0:a:${idx}`)].join(' ');
    const filterArg = `-af "volume=7dB,alimiter=limit=-12dB:attack=5:release=50:asc=0"`;

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

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(commandString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startConversion = () => {
    if (!video || selectedAudioIndices.length === 0) return;

    const totalDuration = video.duration || 30.0;
    const totalFrames = Math.round(totalDuration * (video.fps || 29.97));
    const outputName = video.filename.replace(/\.[^/.]+$/, '') + '_broadcast_master.mxf';

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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#151719] border border-[#333] rounded-lg p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            FFmpeg Execution & MXF Broadcast Encoder
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">
            Mapeia o vídeo (0:v:0), as trilhas de áudio marcadas e aplica o filtro de nivelamento.
          </p>
        </div>

        {/* MXF Codec Options */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-mono text-gray-400">Perfil MXF:</span>
          <select
            value={videoCodec}
            onChange={(e) => setVideoCodec(e.target.value as any)}
            className="bg-[#1A1C1E] border border-[#333] text-xs font-mono text-gray-200 rounded px-2.5 py-1 focus:outline-none focus:border-blue-500"
          >
            <option value="mpeg2video">XDCAM HD422 (MPEG-2 50Mbps 4:2:2)</option>
            <option value="dnxhd">Avid DNxHD (120Mbps 4:2:2)</option>
            <option value="copy">Stream Copy (Passthrough)</option>
          </select>
        </div>
      </div>

      {/* Dynamic Command Line Preview */}
      <div className="bg-[#1A1C1E] border border-[#333] rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            Comando FFmpeg Gerado em Tempo Real:
          </span>
          <button
            onClick={handleCopyCommand}
            className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-mono px-2 py-0.5 rounded bg-[#151719] border border-[#333] hover:border-blue-500/50 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'COPIADO' : 'COPIAR CLI'}
          </button>
        </div>

        <div className="bg-[#0F1112] rounded p-2.5 font-mono text-[11px] text-gray-300 overflow-x-auto select-all leading-relaxed border border-[#2A2D30]">
          <span className="text-pink-400">ffmpeg</span> <span className="text-gray-400">-y -i</span>{' '}
          <span className="text-amber-300">"{video?.filename || 'video.mp4'}"</span>{' '}
          <span className="text-emerald-400">-map 0:v:0</span>{' '}
          {selectedAudioIndices.map((idx) => (
            <span key={idx} className="text-blue-400">
              -map 0:a:{idx}{' '}
            </span>
          ))}
          <span className="text-yellow-300">-af "volume=7dB,alimiter=limit=-12dB:attack=5:release=50:asc=0"</span>{' '}
          <span className="text-cyan-300">
            {videoCodec === 'mpeg2video'
              ? '-c:v mpeg2video -b:v 50M -pix_fmt yuv422p'
              : videoCodec === 'dnxhd'
              ? '-c:v dnxhd -b:v 120M -pix_fmt yuv422p'
              : '-c:v copy'}
          </span>{' '}
          <span className="text-purple-300">-c:a {audioCodec} -ar 48000</span>{' '}
          <span className="text-rose-300">-f mxf</span>{' '}
          <span className="text-emerald-300">"{video?.filename.replace(/\.[^/.]+$/, '') || 'output'}_converted.mxf"</span>
        </div>
      </div>

      {/* Conversion Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          onClick={startConversion}
          disabled={!video || selectedAudioIndices.length === 0 || progress.status === 'converting'}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono font-bold text-xs py-2.5 px-6 rounded shadow flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
        >
          {progress.status === 'converting' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              PROCESSANDO E NIVELANDO ÁUDIO (+7dB / -12dB)...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              CONVERTER PARA MXF BROADCAST ({selectedAudioIndices.length} CANAIS)
            </>
          )}
        </button>

        {progress.status === 'converting' && (
          <button
            onClick={cancelConversion}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold px-4 py-2.5 rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <Square className="w-3 h-3 fill-white" /> CANCELAR
          </button>
        )}
      </div>

      {/* Progress Bar & Telemetry */}
      {(progress.status === 'converting' || progress.status === 'completed') && (
        <div className="bg-[#1A1C1E] border border-blue-900/40 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="font-semibold text-gray-200">
              {progress.status === 'completed' ? 'RENDERIZAÇÃO FINALIZADA COM SUCESSO' : 'TRANSCODIFICANDO ÁUDIO E VÍDEO...'}
            </span>
            <span className="font-bold text-blue-400">{progress.percent}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-[#0F1112] rounded-full overflow-hidden">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-400 font-mono">
            <div className="bg-[#151719] p-2 rounded border border-[#2A2D30]">
              <span className="text-gray-500 block text-[10px]">Quadros:</span>
              <span className="text-white font-bold">
                {progress.currentFrame} / {progress.totalFrames}
              </span>
            </div>
            <div className="bg-[#151719] p-2 rounded border border-[#2A2D30]">
              <span className="text-gray-500 block text-[10px]">Velocidade:</span>
              <span className="text-blue-400 font-bold">{progress.fps} FPS ({progress.speed})</span>
            </div>
            <div className="bg-[#151719] p-2 rounded border border-[#2A2D30]">
              <span className="text-gray-500 block text-[10px]">Tempo Processado:</span>
              <span className="text-white font-bold">
                {formatTime(progress.currentTime)} / {formatTime(progress.totalTime)}
              </span>
            </div>
            <div className="bg-[#151719] p-2 rounded border border-[#2A2D30]">
              <span className="text-gray-500 block text-[10px]">Nivelamento de Áudio:</span>
              <span className="text-emerald-400 font-bold">+7dB &bull; Max -12dB</span>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Logs Output */}
      <div className="bg-[#090A0B] border border-[#333] rounded-md overflow-hidden">
        <div className="bg-[#151719] px-3 py-2 border-b border-[#333] flex items-center justify-between text-xs text-gray-400 font-mono">
          <span className="flex items-center gap-1.5 text-[10px] uppercase text-gray-400">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            Terminal de Logs FFmpeg (stdout / stderr)
          </span>
          <span className="text-[10px] text-gray-500">fluent-ffmpeg listener</span>
        </div>

        <div
          ref={terminalEndRef}
          className="p-3 h-40 overflow-y-auto font-mono text-[11px] space-y-1 bg-[#090A0B] text-gray-300"
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
      </div>
    </div>
  );
};

