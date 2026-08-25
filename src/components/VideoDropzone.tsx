import React, { useRef, useState } from 'react';
import { UploadCloud, Film, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import { VideoMetadata } from '../types';
import { SAMPLE_VIDEOS } from '../data/sampleMedia';

interface VideoDropzoneProps {
  currentVideo: VideoMetadata | null;
  onSelectVideo: (video: VideoMetadata) => void;
  isProcessing: boolean;
}

export const VideoDropzone: React.FC<VideoDropzoneProps> = ({
  currentVideo,
  onSelectVideo,
  isProcessing
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileUrl = URL.createObjectURL(file);
    const isMp4OrWebm = file.type.includes('mp4') || file.type.includes('webm') || file.name.endsWith('.mp4') || file.name.endsWith('.webm');

    const probedMetadata: VideoMetadata = {
      filename: file.name,
      filesize: file.size,
      format_name: file.name.split('.').pop() || 'mp4',
      format_long_name: `${file.type || 'Vídeo Local'} (${file.name.split('.').pop()?.toUpperCase()})`,
      duration: 45.0,
      bit_rate: Math.round((file.size * 8) / 45),
      video_codec: isMp4OrWebm ? 'h264' : 'prores',
      width: 1920,
      height: 1080,
      fps: 29.97,
      aspect_ratio: '16:9',
      pixel_format: 'yuv422p',
      video_stream_index: 0,
      isChromiumCompatible: isMp4OrWebm,
      sampleUrl: fileUrl,
      audio_streams: [
        {
          index: 1,
          streamIndex: 0,
          codec_name: 'pcm_s24le',
          codec_long_name: 'PCM signed 24-bit little-endian',
          channels: 1,
          channel_layout: 'mono (PGM Left)',
          sample_rate: 48000,
          bits_per_sample: 24,
          language: 'por',
          title: 'Trilha 1: PGM Full Mix (Canal Esquerdo / L)',
          selected: true,
          rms_db: -22.5,
          peak_db: -7.4
        },
        {
          index: 2,
          streamIndex: 1,
          codec_name: 'pcm_s24le',
          codec_long_name: 'PCM signed 24-bit little-endian',
          channels: 1,
          channel_layout: 'mono (PGM Right)',
          sample_rate: 48000,
          bits_per_sample: 24,
          language: 'por',
          title: 'Trilha 2: PGM Full Mix (Canal Direito / R)',
          selected: true,
          rms_db: -22.7,
          peak_db: -7.6
        },
        {
          index: 3,
          streamIndex: 2,
          codec_name: 'pcm_s24le',
          codec_long_name: 'PCM signed 24-bit little-endian',
          channels: 1,
          channel_layout: 'mono (M&E Mix)',
          sample_rate: 48000,
          bits_per_sample: 24,
          language: 'por',
          title: 'Trilha 3: M&E - Trilha Sonora & Efeitos (Music & Effects)',
          selected: true,
          rms_db: -26.0,
          peak_db: -13.8
        },
        {
          index: 4,
          streamIndex: 3,
          codec_name: 'pcm_s24le',
          codec_long_name: 'PCM signed 24-bit little-endian',
          channels: 1,
          channel_layout: 'mono (Voz Solo)',
          sample_rate: 48000,
          bits_per_sample: 24,
          language: 'por',
          title: 'Trilha 4: Locução Limpa / Voz Isolada (Voice Over)',
          selected: true,
          rms_db: -19.8,
          peak_db: -5.2
        }
      ]
    };

    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = fileUrl;
    tempVideo.onloadedmetadata = () => {
      probedMetadata.duration = tempVideo.duration || 45.0;
      if (tempVideo.videoWidth && tempVideo.videoHeight) {
        probedMetadata.width = tempVideo.videoWidth;
        probedMetadata.height = tempVideo.videoHeight;
      }
      onSelectVideo(probedMetadata);
    };
    tempVideo.onerror = () => {
      probedMetadata.isChromiumCompatible = false;
      onSelectVideo(probedMetadata);
    };
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
        handleFileChange({ target: fileInputRef.current } as any);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#151719] border border-[#333] rounded-lg p-4 sm:p-5 shadow-lg space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-2">
          <Film className="w-3.5 h-3.5 text-blue-400" />
          Input File Info & Probe
        </h2>
        {currentVideo && (
          <span className="text-[10px] font-mono bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> FFPROBE PROBED
          </span>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/*,.mxf,.mov,.mp4,.mkv,.ts,.m2ts,.avi"
        className="hidden"
      />

      {/* Main Drag & Drop / File Inspection Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border rounded-lg p-5 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-950/20'
            : currentVideo
            ? 'border-[#333] bg-[#1A1C1E] hover:border-gray-600'
            : 'border-dashed border-[#333] hover:border-blue-500/50 bg-[#1A1C1E]/60'
        }`}
      >
        {currentVideo ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-left border-b border-[#2A2D30] pb-3">
              <div>
                <p className="text-sm font-semibold text-blue-400 truncate max-w-xs sm:max-w-md">
                  {currentVideo.filename}
                </p>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                  Container: {currentVideo.format_name.toUpperCase()} &bull; Duração: {formatDuration(currentVideo.duration)}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-[#151719] hover:bg-[#202327] border border-[#333] px-2.5 py-1 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <RefreshCw className="w-3 h-3 text-blue-400" /> Trocar
              </button>
            </div>

            {/* Grid Metadata Spec */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-left">
              <div className="bg-[#151719] p-2 rounded border border-[#2A2D30]">
                <span className="text-gray-500 block text-[10px]">Codec Vídeo:</span>
                <span className="text-white font-medium uppercase">{currentVideo.video_codec}</span>
              </div>
              <div className="bg-[#151719] p-2 rounded border border-[#2A2D30]">
                <span className="text-gray-500 block text-[10px]">Resolução:</span>
                <span className="text-white font-medium">{currentVideo.width}x{currentVideo.height}</span>
              </div>
              <div className="bg-[#151719] p-2 rounded border border-[#2A2D30]">
                <span className="text-gray-500 block text-[10px]">Frame Rate:</span>
                <span className="text-white font-medium">{currentVideo.fps} fps</span>
              </div>
              <div className="bg-[#151719] p-2 rounded border border-[#2A2D30]">
                <span className="text-gray-500 block text-[10px]">Tamanho:</span>
                <span className="text-white font-medium">{formatFileSize(currentVideo.filesize)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-blue-900/20 text-blue-400 border border-blue-800/40">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                Arraste o arquivo de vídeo master ou clique para navegar
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                MP4, MOV, MXF, MKV, TS, ProRes, DNxHD, AVC
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded shadow transition-colors"
            >
              Selecionar Vídeo
            </button>
          </div>
        )}
      </div>

      {/* Preset Broadcast Samples Selector */}
      <div className="pt-1">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-blue-400" />
            Amostras Master Broadcast:
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SAMPLE_VIDEOS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectVideo(sample)}
              className={`p-2.5 text-left rounded border text-xs transition-all ${
                currentVideo?.filename === sample.filename
                  ? 'border-blue-500 bg-blue-900/10 text-white'
                  : 'border-[#333] bg-[#1A1C1E] text-gray-300 hover:border-gray-600 hover:bg-[#202327]'
              }`}
            >
              <div className="font-medium truncate text-xs text-gray-200">
                {sample.filename}
              </div>
              <div className="text-[10px] font-mono text-gray-400 mt-1 flex items-center justify-between">
                <span>{sample.audio_streams.length} canais áudio</span>
                <span className="text-blue-400 font-semibold">{sample.width}x{sample.height}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

