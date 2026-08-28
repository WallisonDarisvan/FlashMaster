import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, AlertTriangle, CheckCircle, Info, MonitorPlay, RotateCcw, RotateCw } from 'lucide-react';
import { VideoMetadata } from '../types';
import { AudioVuMeter } from './AudioVuMeter';

interface VideoPlayerPreviewProps {
  video: VideoMetadata | null;
  gainDb?: number;
  limitDb?: number;
}

export const VideoPlayerPreview: React.FC<VideoPlayerPreviewProps> = ({
  video,
  gainDb = 7,
  limitDb = -12
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioMode, setAudioMode] = useState<'original' | 'corrected'>('corrected');

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const mergerRef = useRef<ChannelMergerNode | null>(null);
  const gainNodesRef = useRef<{ [chIndex: number]: GainNode }>({});
  const processGainNodesRef = useRef<{ [chIndex: number]: GainNode }>({});
  const limiterNodesRef = useRef<{ [chIndex: number]: DynamicsCompressorNode }>({});
  const analysersRef = useRef<{ [chIndex: number]: AnalyserNode }>({});

  const initAudioGraph = () => {
    if (!videoRef.current || audioContextRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaElementSource(videoRef.current);
      sourceNodeRef.current = source;

      // Cria splitter e merger para canais discretos
      const numChannels = Math.max(2, video?.audio_channels?.length || 2);
      const splitter = ctx.createChannelSplitter(numChannels);
      const merger = ctx.createChannelMerger(numChannels);

      splitterRef.current = splitter;
      mergerRef.current = merger;
      source.connect(splitter);

      const gains: { [chIndex: number]: GainNode } = {};
      const processGains: { [chIndex: number]: GainNode } = {};
      const limiters: { [chIndex: number]: DynamicsCompressorNode } = {};
      const analysers: { [chIndex: number]: AnalyserNode } = {};

      const isCorrected = audioMode === 'corrected';

      for (let i = 0; i < numChannels; i++) {
        // Controle de seleção/mudo
        const gainNode = ctx.createGain();

        // Ganho linear (+gainDb ou 1.0)
        const processGain = ctx.createGain();
        processGain.gain.setValueAtTime(
          isCorrected ? Math.pow(10, gainDb / 20) : 1.0,
          ctx.currentTime
        );

        // Limitador (limitDb hard limiter ou bypass)
        const limiter = ctx.createDynamicsCompressor();
        if (isCorrected) {
          limiter.threshold.setValueAtTime(limitDb, ctx.currentTime);
          limiter.knee.setValueAtTime(0, ctx.currentTime);
          limiter.ratio.setValueAtTime(20, ctx.currentTime);
          limiter.attack.setValueAtTime(0.005, ctx.currentTime);
          limiter.release.setValueAtTime(0.050, ctx.currentTime);
        } else {
          limiter.threshold.setValueAtTime(0, ctx.currentTime);
          limiter.ratio.setValueAtTime(1, ctx.currentTime);
        }

        // AnalyserNode para medir modulação broadcast pós-processada
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;

        // Conexão em cascata
        gainNode.connect(processGain);
        processGain.connect(limiter);
        limiter.connect(merger, 0, i);
        limiter.connect(analyser);

        gains[i] = gainNode;
        processGains[i] = processGain;
        limiters[i] = limiter;
        analysers[i] = analyser;
      }

      merger.connect(ctx.destination);
      gainNodesRef.current = gains;
      processGainNodesRef.current = processGains;
      limiterNodesRef.current = limiters;
      analysersRef.current = analysers;
    } catch (e) {
      console.warn('[WebAudio] Inicialização do splitter:', e);
    }
  };

  // Alternância A/B em tempo real (Original vs Corrigido) e atualização de parâmetros
  useEffect(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const isCorrected = audioMode === 'corrected';
    const gainVal = isCorrected ? Math.pow(10, gainDb / 20) : 1.0;

    Object.values(processGainNodesRef.current).forEach((pGain: GainNode) => {
      pGain.gain.setValueAtTime(gainVal, ctx.currentTime);
    });

    Object.values(limiterNodesRef.current).forEach((limiter: DynamicsCompressorNode) => {
      if (isCorrected) {
        limiter.threshold.setValueAtTime(limitDb, ctx.currentTime);
        limiter.knee.setValueAtTime(0, ctx.currentTime);
        limiter.ratio.setValueAtTime(20, ctx.currentTime);
        limiter.attack.setValueAtTime(0.005, ctx.currentTime);
        limiter.release.setValueAtTime(0.050, ctx.currentTime);
      } else {
        limiter.threshold.setValueAtTime(0, ctx.currentTime);
        limiter.ratio.setValueAtTime(1, ctx.currentTime);
      }
    });
  }, [audioMode, gainDb, limitDb]);

  // Muta/desmuta e roteia canais (clonagem de áudio) em tempo real
  useEffect(() => {
    if (!video?.audio_channels) return;
    initAudioGraph();

    if (splitterRef.current && audioContextRef.current) {
      try {
        splitterRef.current.disconnect();

        video.audio_channels.forEach((ch) => {
          const destIdx = ch.channelIndex;
          const sourceCh = video.audio_channels?.find((c) => c.id === ch.sourceChannelId) || ch;
          const srcIdx = sourceCh.channelIndex;
          const gainNode = gainNodesRef.current[destIdx];

          if (gainNode && splitterRef.current) {
            splitterRef.current.connect(gainNode, srcIdx);
            gainNode.gain.setValueAtTime(ch.selected ? 1.0 : 0.0, audioContextRef.current!.currentTime);
          }
        });
      } catch (err) {
        console.warn('[WebAudio] Erro ao reconectar roteamento:', err);
      }
    }
  }, [video?.audio_channels]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [video?.filename]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    initAudioGraph();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || video?.duration || 0);
    }
  };

  const seek = (targetTime: number) => {
    if (!videoRef.current) return;
    const maxDur = duration || video?.duration || 0;
    const clamped = Math.max(0, Math.min(maxDur, targetTime));
    videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    seek(videoRef.current.currentTime + seconds);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const maxDur = duration || video?.duration || 0;
    if (maxDur > 0 && videoRef.current) {
      const target = ratio * maxDur;
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const frames = Math.floor((secs % 1) * 30);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#151719] border border-[#333] rounded-lg overflow-hidden shadow-lg flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#333] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <MonitorPlay className="w-3.5 h-3.5 text-blue-400" />
          <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
            Monitor de Vídeo
          </h3>
        </div>
        <div className="flex items-center space-x-2 font-mono">
          {/* Botão de Comparação A/B: Original vs Corrigido (+7dB / -12dB) */}
          {video && (
            <div className="flex items-center bg-[#090A0B] p-0.5 rounded border border-[#333]">
              <button
                type="button"
                onClick={() => setAudioMode('original')}
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                  audioMode === 'original'
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/60 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Ouvir áudio original bruto do arquivo (sem ganho e sem limiter)"
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => setAudioMode('corrected')}
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all flex items-center gap-1 ${
                  audioMode === 'corrected'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title={`Ouvir áudio processado no padrão (+${gainDb}dB ganho e corte em ${limitDb}dBFS)`}
              >
                <span>⚡</span> Corrigido (+{gainDb}dB/{limitDb}dB)
              </button>
            </div>
          )}

          {video && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border ${
                video.isChromiumCompatible
                  ? 'bg-blue-900/30 text-blue-400 border-blue-800'
                  : 'bg-amber-900/30 text-amber-400 border-amber-800'
              }`}
            >
              {video.isChromiumCompatible ? 'H.264 PREVIEW' : 'FFMPEG MASTER'}
            </span>
          )}
        </div>
      </div>

      {/* Video Monitor Stage */}
      <div className="relative bg-[#090A0B] flex-1 min-h-0 aspect-video flex items-center justify-center overflow-hidden">
        {/* Telemetry Overlays on Monitor */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 font-mono text-[9px]">
          <span className="bg-black/80 px-2 py-0.5 rounded border border-white/10 text-gray-300">
            MONITOR
          </span>
          {video ? (
            <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              PROBE OK
            </span>
          ) : (
            <span className="bg-[#151719] text-gray-500 border border-[#333] px-2 py-0.5 rounded">
              STANDBY
            </span>
          )}
        </div>

        {video ? (
          video.isChromiumCompatible && video.sampleUrl ? (
            <>
              <video
                ref={videoRef}
                src={video.sampleUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
                playsInline
              />

              {/* Scrubber & Floating Controls Bar */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 flex flex-col gap-2">
                {/* Timeline bar (clicável e interativa) */}
                <div
                  onClick={handleTimelineClick}
                  className="w-full py-1.5 cursor-pointer group flex items-center"
                  title="Clique para definir o ponto de reprodução"
                >
                  <div className="w-full h-1 group-hover:h-1.5 bg-white/20 rounded-full relative overflow-hidden transition-all">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(duration || video.duration || 0) > 0 ? (currentTime / (duration || video.duration || 1)) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-white text-xs">
                  <div className="flex items-center space-x-2">
                    {/* Retroceder 5s */}
                    <button
                      type="button"
                      onClick={() => skip(-5)}
                      title="Voltar 5 segundos"
                      className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-all active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {/* Play/Pause */}
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="w-7 h-7 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-transform active:scale-95 shadow"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>

                    {/* Avançar 5s */}
                    <button
                      type="button"
                      onClick={() => skip(5)}
                      title="Avançar 5 segundos"
                      className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-all active:scale-95"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    {/* Mute */}
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="text-gray-400 hover:text-white ml-1"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <span className="font-mono text-blue-400 text-[11px] ml-1">
                      {formatTime(currentTime)} / {formatTime(duration || video.duration)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">
                    {video.width}x{video.height} &bull; {video.fps} fps
                  </span>
                </div>
              </div>
            </>
          ) : (
            /* Fallback Card for Chromium non-playable broadcast containers/codecs */
            <div className="p-6 text-center max-w-md space-y-3 font-sans">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-blue-900/20 text-blue-400 border border-blue-800/40">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Container Broadcast {video.format_name.toUpperCase()} / {video.video_codec.toUpperCase()}
                </h4>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  O Chromium não decodifica este codec nativo via GPU no navegador, mas o pipeline do <strong>FFmpeg x64 nativo</strong> o processará e remapeará os canais perfeitamente.
                </p>
              </div>
              <div className="bg-[#1A1C1E] border border-[#333] rounded p-2.5 text-left text-[11px] font-mono text-gray-300">
                <div className="text-blue-400 font-semibold mb-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  Status da Pipeline FFmpeg:
                </div>
                <div className="text-gray-400 text-[10px]">
                  &gt; Decodificação: ffmpeg -i "{video.filename}"<br />
                  &gt; Filtro Áudio: volume=7dB,alimiter=limit=-12dB<br />
                  &gt; Encapsulamento: SMPTE 377M OP-1a MXF
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="text-center p-8 text-gray-600 text-xs font-mono">
            <Info className="w-6 h-6 mx-auto mb-2 text-gray-700" />
            AGUARDANDO SINAL DE VÍDEO
          </div>
        )}
      </div>

      {/* Medidores de Nível e Modulação de Áudio (VU Meters Broadcast) */}
      {video && (video.audio_channels?.length || 0) > 0 && (
        <AudioVuMeter
          audioChannels={video.audio_channels || []}
          analysersRef={analysersRef}
          isPlaying={isPlaying}
          audioMode={audioMode}
          gainDb={gainDb}
          limitDb={limitDb}
        />
      )}
    </div>
  );
};

