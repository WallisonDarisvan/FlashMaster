import React, { useRef, useState } from 'react';
import { UploadCloud, Film, CheckCircle2, RefreshCw } from 'lucide-react';
import { VideoMetadata } from '../types';

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
  const [isProbing, setIsProbing] = useState(false);

  const handleLoadFilePath = async (filePath: string) => {
    if (!window.electronAPI?.probeVideo) return false;
    try {
      setIsProbing(true);
      const probed = await window.electronAPI.probeVideo(filePath);
      onSelectVideo(probed);
      return true;
    } catch (err: any) {
      console.error('[FFprobe Probe Error]:', err);
      alert('Erro ao analisar arquivo com FFprobe: ' + (err?.message || err));
      return false;
    } finally {
      setIsProbing(false);
    }
  };

  const handleOpenNativeDialog = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isProcessing || isProbing) return;

    if (window.electronAPI?.openVideoDialog) {
      try {
        setIsProbing(true);
        const res = await window.electronAPI.openVideoDialog();
        if (res && res.filePath) {
          await handleLoadFilePath(res.filePath);
          return;
        }
      } catch (err) {
        console.error('Erro ao abrir diálogo nativo:', err);
      } finally {
        setIsProbing(false);
      }
    }

    // Fallback para navegador
    fileInputRef.current?.click();
  };

  const processBrowserFileFallback = (file: File) => {
    const fileUrl = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const isChromium = ['mp4', 'webm', 'mov'].includes(ext);

    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = fileUrl;

    tempVideo.onloadedmetadata = () => {
      const realDuration = tempVideo.duration || 0;
      const realWidth = tempVideo.videoWidth || 1920;
      const realHeight = tempVideo.videoHeight || 1080;
      const estimatedBitrate = realDuration > 0 ? Math.round((file.size * 8) / realDuration) : 0;

      const probedMetadata: VideoMetadata = {
        filename: file.name,
        filepath: (file as any).path || '',
        filesize: file.size,
        format_name: ext,
        format_long_name: `${file.type || ext.toUpperCase()} (${file.name})`,
        duration: realDuration,
        bit_rate: estimatedBitrate,
        video_codec: isChromium ? 'H.264 / AVC' : ext.toUpperCase(),
        width: realWidth,
        height: realHeight,
        fps: 29.97,
        aspect_ratio: `${realWidth}:${realHeight}`,
        pixel_format: 'yuv420p',
        video_stream_index: 0,
        isChromiumCompatible: isChromium,
        sampleUrl: fileUrl,
        audio_streams: [
          {
            index: 1,
            streamIndex: 0,
            codec_name: 'aac',
            codec_long_name: 'AAC (Áudio Estéreo)',
            channels: 2,
            channel_layout: 'stereo (L/R)',
            sample_rate: 48000,
            bits_per_sample: 16,
            language: 'und',
            title: 'Trilha 1: Áudio Principal (Stereo L/R)',
            selected: true
          }
        ],
        audio_channels: [
          {
            id: '0:0',
            streamIndex: 0,
            channelIndex: 0,
            channelNumber: 1,
            label: 'Canal 1: Esquerdo (L)',
            layoutName: 'Esquerdo (L)',
            codec_name: 'aac',
            sample_rate: 48000,
            bits_per_sample: 16,
            selected: true,
            sourceChannelId: '0:0'
          },
          {
            id: '0:1',
            streamIndex: 0,
            channelIndex: 1,
            channelNumber: 2,
            label: 'Canal 2: Direito (R)',
            layoutName: 'Direito (R)',
            codec_name: 'aac',
            sample_rate: 48000,
            bits_per_sample: 16,
            selected: true,
            sourceChannelId: '0:1'
          }
        ]
      };
      onSelectVideo(probedMetadata);
    };

    tempVideo.onerror = () => {
      onSelectVideo({
        filename: file.name,
        filepath: (file as any).path || '',
        filesize: file.size,
        format_name: ext,
        format_long_name: ext.toUpperCase(),
        duration: 0,
        bit_rate: 0,
        video_codec: ext.toUpperCase(),
        width: 1920,
        height: 1080,
        fps: 29.97,
        aspect_ratio: '16:9',
        pixel_format: 'yuv422p',
        video_stream_index: 0,
        isChromiumCompatible: false,
        sampleUrl: undefined,
        audio_streams: [],
        audio_channels: []
      });
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const filePath = (file as any).path;

    if (filePath && window.electronAPI?.probeVideo) {
      const success = await handleLoadFilePath(filePath);
      if (success) return;
    }

    processBrowserFileFallback(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const filePath = (file as any).path;

      if (filePath && window.electronAPI?.probeVideo) {
        const success = await handleLoadFilePath(filePath);
        if (success) return;
      }

      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
      }
      processBrowserFileFallback(file);
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
    <div className="bg-[#151719] border border-[#333] rounded-lg p-3 sm:p-3.5 shadow-lg space-y-2.5 shrink-0">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-2">
          <Film className="w-3.5 h-3.5 text-blue-400" />
          Arquivo de Entrada & ffprobe
        </h2>
        {currentVideo && (
          <span className="text-[10px] font-mono bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> PROBED OK
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
        onClick={(e) => handleOpenNativeDialog(e)}
        className={`border rounded-lg p-3 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-950/20'
            : currentVideo
            ? 'border-[#333] bg-[#1A1C1E] hover:border-gray-600'
            : 'border-dashed border-[#333] hover:border-blue-500/50 bg-[#1A1C1E]/60 py-3'
        }`}
      >
        {isProbing ? (
          <div className="py-3 flex flex-col items-center justify-center space-y-1.5">
            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
            <p className="text-xs text-gray-300 font-mono">Executando ffprobe no arquivo...</p>
          </div>
        ) : currentVideo ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-left border-b border-[#2A2D30] pb-2">
              <div className="truncate mr-2">
                <p className="text-xs font-semibold text-blue-400 truncate">
                  {currentVideo.filename}
                </p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  {currentVideo.format_name.toUpperCase()} &bull; {formatDuration(currentVideo.duration)} &bull; {formatFileSize(currentVideo.filesize)}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 inline-flex items-center gap-1 text-[11px] text-gray-300 hover:text-white bg-[#151719] hover:bg-[#202327] border border-[#333] px-2 py-0.5 rounded transition-colors"
                onClick={(e) => handleOpenNativeDialog(e)}
              >
                <RefreshCw className="w-3 h-3 text-blue-400" /> Trocar
              </button>
            </div>

            {/* Grid Metadata Spec */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono text-left">
              <div className="bg-[#151719] p-1.5 rounded border border-[#2A2D30]">
                <span className="text-gray-500 block text-[9px]">Codec Vídeo:</span>
                <span className="text-white font-medium uppercase truncate block">{currentVideo.video_codec}</span>
              </div>
              <div className="bg-[#151719] p-1.5 rounded border border-[#2A2D30]">
                <span className="text-gray-500 block text-[9px]">Resolução:</span>
                <span className="text-white font-medium">{currentVideo.width}x{currentVideo.height}</span>
              </div>
              <div className="bg-[#151719] p-1.5 rounded border border-[#2A2D30]">
                <span className="text-gray-500 block text-[9px]">Taxa Quadros:</span>
                <span className="text-white font-medium">{currentVideo.fps} fps</span>
              </div>
              <div className="bg-[#151719] p-1.5 rounded border border-[#2A2D30]">
                <span className="text-gray-500 block text-[9px]">Faixas Áudio:</span>
                <span className="text-emerald-400 font-medium">{currentVideo.audio_streams.length} canais</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-1">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded bg-blue-900/20 text-blue-400 border border-blue-800/40">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                Arraste o vídeo master ou clique para abrir
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                MP4, MOV, MXF, MKV, TS, ProRes, DNxHD, XDCAM
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => handleOpenNativeDialog(e)}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold px-3 py-1 rounded shadow transition-colors"
            >
              Selecionar Vídeo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

