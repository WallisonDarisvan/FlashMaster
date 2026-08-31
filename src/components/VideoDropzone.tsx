import React, { useRef, useState } from 'react';
import { UploadCloud, Film, RefreshCw, Plus, Trash2, CheckCircle2, Music2, Edit3, CheckSquare, Square } from 'lucide-react';
import { VideoMetadata } from '../types';

interface VideoDropzoneProps {
  videos: VideoMetadata[];
  selectedVideoIndex: number | null;
  onSelectVideoIndex: (index: number | null) => void;
  onToggleBatchCheck: (index: number) => void;
  onToggleAllBatchChecks: (check: boolean) => void;
  onAddVideos: (newVideos: VideoMetadata[]) => void;
  onRemoveVideo: (index: number) => void;
  onClearAllVideos: () => void;
  isProcessing: boolean;
}

export const VideoDropzone: React.FC<VideoDropzoneProps> = ({
  videos,
  selectedVideoIndex,
  onSelectVideoIndex,
  onToggleBatchCheck,
  onToggleAllBatchChecks,
  onAddVideos,
  onRemoveVideo,
  onClearAllVideos,
  isProcessing
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [probingProgress, setProbingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const batchCheckedCount = videos.filter((v) => v.isBatchChecked !== false).length;
  const allBatchChecked = videos.length > 0 && batchCheckedCount === videos.length;

  const handleLoadFilePaths = async (filePaths: string[]) => {
    if (!window.electronAPI?.probeVideo || filePaths.length === 0) return;
    try {
      setIsProbing(true);
      setProbingProgress({ current: 0, total: filePaths.length });
      const probedList: VideoMetadata[] = [];

      for (let i = 0; i < filePaths.length; i++) {
        setProbingProgress({ current: i + 1, total: filePaths.length });
        const filePath = filePaths[i];
        try {
          const probed = await window.electronAPI.probeVideo(filePath);
          if (probed) {
            probedList.push({
              ...probed,
              isBatchChecked: true,
              isEdited: false
            });
          }
        } catch (err: any) {
          console.error(`[FFprobe Probe Error] em ${filePath}:`, err);
        }
      }

      if (probedList.length > 0) {
        onAddVideos(probedList);
      }
    } catch (err: any) {
      console.error('[FFprobe Batch Error]:', err);
      alert('Erro ao analisar arquivos com FFprobe: ' + (err?.message || err));
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
        if (res) {
          if (res.files && res.files.length > 0) {
            await handleLoadFilePaths(res.files.map((f) => f.filePath));
            return;
          } else if (res.filePath) {
            await handleLoadFilePaths([res.filePath]);
            return;
          }
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

  const processBrowserFilesFallback = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const probedList: VideoMetadata[] = [];
    let processed = 0;

    fileList.forEach((file) => {
      const fileUrl = URL.createObjectURL(file);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const isChromium = ['mp4', 'webm', 'mov'].includes(ext);

      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = fileUrl;

      const finishOne = (metadata: VideoMetadata) => {
        probedList.push({
          ...metadata,
          isBatchChecked: true,
          isEdited: false
        });
        processed++;
        if (processed === fileList.length) {
          onAddVideos(probedList);
        }
      };

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
        finishOne(probedMetadata);
      };

      tempVideo.onerror = () => {
        finishOne({
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
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filePaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const p = (files[i] as any).path;
      if (p) filePaths.push(p);
    }

    if (filePaths.length > 0 && window.electronAPI?.probeVideo) {
      await handleLoadFilePaths(filePaths);
      return;
    }

    processBrowserFilesFallback(files);
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
      const files = e.dataTransfer.files;
      const filePaths: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const p = (files[i] as any).path;
        if (p) filePaths.push(p);
      }

      if (filePaths.length > 0 && window.electronAPI?.probeVideo) {
        await handleLoadFilePaths(filePaths);
        return;
      }

      processBrowserFilesFallback(files);
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
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-[#151719] border rounded-lg p-3 sm:p-3.5 shadow-lg space-y-2.5 flex flex-col transition-all ${
        isDragging ? 'border-blue-500 bg-blue-950/20' : 'border-[#333]'
      }`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-blue-400" />
            {videos.length === 0
              ? 'Arquivos de Entrada & ffprobe'
              : `Fila de Arquivos (${videos.length} ${videos.length === 1 ? 'VÍDEO' : 'VÍDEOS'})`}
          </h2>
          {videos.length > 0 && (
            <span className="text-[9px] bg-blue-950/40 text-blue-400 border border-blue-800/60 font-mono px-1.5 py-0.2 rounded font-semibold">
              {batchCheckedCount}/{videos.length} no lote
            </span>
          )}
        </div>

        {videos.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleAllBatchChecks(!allBatchChecked)}
              className="text-[10px] font-mono text-gray-300 hover:text-white bg-[#1A1C1E] hover:bg-[#202327] px-2 py-0.5 rounded border border-[#333] flex items-center gap-1 transition-colors"
              title="Marcar ou desmarcar todos para a renderização em lote"
            >
              {allBatchChecked ? (
                <>
                  <CheckSquare className="w-3 h-3 text-blue-400" /> Desmarcar Todos
                </>
              ) : (
                <>
                  <Square className="w-3 h-3 text-gray-400" /> Marcar Todos
                </>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => handleOpenNativeDialog(e)}
              className="text-[10px] font-mono bg-blue-900/30 hover:bg-blue-800/40 text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1 transition-colors"
              title="Adicionar mais vídeos à fila"
            >
              <Plus className="w-3 h-3" /> Adicionar
            </button>
            <button
              type="button"
              onClick={onClearAllVideos}
              className="text-[10px] font-mono bg-rose-900/20 hover:bg-rose-900/30 text-rose-400 px-2 py-0.5 rounded border border-rose-900/40 flex items-center gap-1 transition-colors"
              title="Limpar todos os vídeos da fila"
            >
              <Trash2 className="w-3 h-3" /> Limpar
            </button>
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/*,.mxf,.mov,.mp4,.mkv,.ts,.m2ts,.avi"
        multiple
        className="hidden"
      />

      {isProbing ? (
        <div className="py-6 flex flex-col items-center justify-center space-y-2 border border-dashed border-blue-500/50 bg-blue-950/20 rounded-lg">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
          <p className="text-xs text-gray-200 font-mono">
            Executando ffprobe nos arquivos...{' '}
            {probingProgress.total > 0 && `(${probingProgress.current}/${probingProgress.total})`}
          </p>
        </div>
      ) : videos.length === 0 ? (
        /* Empty State Dropzone */
        <div
          onClick={(e) => handleOpenNativeDialog(e)}
          className="border-dashed border border-[#333] hover:border-blue-500/50 bg-[#1A1C1E]/60 rounded-lg p-5 text-center cursor-pointer transition-all space-y-2 py-6"
        >
          <div className="inline-flex items-center justify-center w-9 h-9 rounded bg-blue-900/20 text-blue-400 border border-blue-800/40">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">
              Arraste múltiplos vídeos ou clique para abrir
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Suporta vários arquivos simultâneos (MP4, MOV, MXF, MKV, TS, ProRes, DNxHD, XDCAM)
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => handleOpenNativeDialog(e)}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold px-3 py-1.5 rounded shadow transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Selecionar Arquivos (Lote)
          </button>
        </div>
      ) : (
        /* List / Queue of Loaded Videos */
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {videos.map((vid, idx) => {
            const isSelected = selectedVideoIndex === idx;
            const isChecked = vid.isBatchChecked !== false;

            return (
              <div
                key={vid.filepath || `${vid.filename}-${idx}`}
                onClick={() => onSelectVideoIndex(isSelected ? null : idx)}
                className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-950/30 shadow-md ring-1 ring-blue-500/40'
                    : isChecked
                    ? 'border-[#2A2D30] bg-[#1A1C1E] hover:border-gray-600 hover:bg-[#202327]'
                    : 'border-[#2A2D30]/60 bg-[#141517] opacity-60 hover:opacity-90 hover:border-gray-600'
                }`}
              >
                {/* Checkbox de Renderização em Lote */}
                <div
                  className="pt-0.5 pl-0.5 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBatchCheck(idx);
                  }}
                  title={isChecked ? 'Marcado para renderizar em lote' : 'Desmarcado (não será renderizado no lote)'}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 accent-blue-500 rounded bg-[#0F1112] border-[#333] cursor-pointer block"
                  />
                </div>

                <div className="truncate min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate">
                    {/* Tags de Status de Renderização ao lado esquerdo */}
                    {vid.renderStatus === 'rendering' && (
                      <span className="bg-blue-600/30 text-blue-300 font-mono text-[9px] px-1.5 py-0.2 rounded border border-blue-500/60 shrink-0 font-bold flex items-center gap-1 animate-pulse shadow-sm">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> RENDERIZANDO...
                      </span>
                    )}
                    {vid.renderStatus === 'completed' && (
                      <span className="bg-emerald-950/60 text-emerald-400 font-mono text-[9px] px-1.5 py-0.2 rounded border border-emerald-800/80 shrink-0 font-bold flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> RENDERIZADO
                      </span>
                    )}
                    {vid.renderStatus === 'error' && (
                      <span className="bg-rose-950/60 text-rose-400 font-mono text-[9px] px-1.5 py-0.2 rounded border border-rose-800/80 shrink-0 font-bold flex items-center gap-1 shadow-sm">
                        ERRO
                      </span>
                    )}

                    {/* Tag [EDITADO] ao lado esquerdo do nome */}
                    {vid.isEdited && (
                      <span className="bg-amber-500/20 text-amber-300 font-mono text-[9px] px-1.5 py-0.2 rounded border border-amber-500/50 shrink-0 font-bold flex items-center gap-0.5 shadow-sm">
                        <Edit3 className="w-2.5 h-2.5" /> EDITADO
                      </span>
                    )}

                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-400 font-bold' : isChecked ? 'text-gray-200' : 'text-gray-400'}`}>
                      {vid.filename}
                    </p>

                    {isSelected ? (
                      <span className="bg-blue-600 text-white font-mono text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 flex items-center gap-1">
                        <Music2 className="w-2.5 h-2.5" /> EDITANDO ÁUDIO
                      </span>
                    ) : (
                      <span className="text-gray-500 text-[9px] font-mono bg-[#0F1112] px-1 py-0.2 rounded border border-[#333] shrink-0 hidden sm:inline">
                        Clique para configurar áudio
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono mt-0.5 flex-wrap">
                    <span className="text-white font-medium uppercase">{vid.video_codec}</span>
                    <span>&bull;</span>
                    <span className="text-gray-200">{vid.width}x{vid.height}</span>
                    <span>&bull;</span>
                    <span className="text-gray-200">{vid.fps} fps</span>
                    <span>&bull;</span>
                    <span className="text-emerald-400 font-medium">
                      {vid.audio_channels?.length || vid.audio_streams.length}{' '}
                      {(vid.audio_channels?.length || vid.audio_streams.length) === 1 ? 'canal' : 'canais'}
                    </span>
                    <span>&bull;</span>
                    <span className="text-gray-400">{formatDuration(vid.duration)}</span>
                    <span>&bull;</span>
                    <span className="text-gray-400">{formatFileSize(vid.filesize)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveVideo(idx);
                    }}
                    className="text-gray-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/30 transition-colors"
                    title="Remover este arquivo da fila"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
