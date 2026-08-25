import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, AlertTriangle, CheckCircle, Info, MonitorPlay } from 'lucide-react';
import { VideoMetadata } from '../types';

interface VideoPlayerPreviewProps {
  video: VideoMetadata | null;
}

export const VideoPlayerPreview: React.FC<VideoPlayerPreviewProps> = ({ video }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [video?.filename]);

  const togglePlay = () => {
    if (!videoRef.current) return;
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const frames = Math.floor((secs % 1) * 30);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#151719] border border-[#333] rounded-lg overflow-hidden shadow-lg flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MonitorPlay className="w-3.5 h-3.5 text-blue-400" />
          <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
            Preview Monitor
          </h3>
        </div>
        <div className="flex items-center space-x-2 font-mono">
          {video && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded border ${
                video.isChromiumCompatible
                  ? 'bg-blue-900/30 text-blue-400 border-blue-800'
                  : 'bg-amber-900/30 text-amber-400 border-amber-800'
              }`}
            >
              {video.isChromiumCompatible ? 'CHROMIUM H.264 NATIVE' : 'BROADCAST CONTAINER (FFMPEG PROBE)'}
            </span>
          )}
        </div>
      </div>

      {/* Video Monitor Stage */}
      <div className="relative bg-[#090A0B] aspect-video flex items-center justify-center overflow-hidden border-b border-[#2A2D30]">
        {/* Telemetry Overlays on Monitor */}
        <div className="absolute top-3 left-3 flex items-center gap-2 z-10 font-mono text-[10px]">
          <span className="bg-black/80 px-2 py-0.5 rounded border border-white/10 text-gray-300">
            CH 1-2 MONITOR
          </span>
          <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            PROBE OK
          </span>
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
                {/* Timeline bar */}
                <div className="w-full h-1 bg-white/20 rounded-full relative overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-white text-xs">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={togglePlay}
                      className="w-7 h-7 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-transform active:scale-95 shadow"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                    <button
                      onClick={toggleMute}
                      className="text-gray-400 hover:text-white"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <span className="font-mono text-blue-400 text-[11px]">
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
    </div>
  );
};

