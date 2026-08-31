import React, { useState, useEffect } from 'react';
import { VideoDropzone } from './components/VideoDropzone';
import { VideoPlayerPreview } from './components/VideoPlayerPreview';
import { AudioTrackSelector } from './components/AudioTrackSelector';
import { ConversionTerminal } from './components/ConversionTerminal';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { VideoMetadata } from './types';
import { Sliders } from 'lucide-react';

export default function App() {
  // Lista de múltiplos vídeos carregados na fila
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  // Índice do vídeo selecionado para visualização e edição de áudio (null quando nenhum arquivo clicado)
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);

  const currentVideo = selectedVideoIndex !== null && videos[selectedVideoIndex] ? videos[selectedVideoIndex] : null;

  // Estados de configuração de ganho e limiter com persistência local
  const [gainDb, setGainDb] = useState<number>(() => {
    const saved = localStorage.getItem('padrao_tvb_gain_db');
    return saved ? parseFloat(saved) : 0;
  });
  const [limitDb, setLimitDb] = useState<number>(() => {
    const saved = localStorage.getItem('padrao_tvb_limit_db');
    return saved ? parseFloat(saved) : 0;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Cache inteligente de formas de onda em memória indexado pelo caminho do arquivo
  const [waveformsCache, setWaveformsCache] = useState<{ [filePath: string]: { [channelId: string]: number[] } }>({});
  // Picos ativos para o vídeo atualmente selecionado
  const [waveforms, setWaveforms] = useState<{ [channelId: string]: number[] }>({});
  const [isLoadingWaveforms, setIsLoadingWaveforms] = useState(false);

  // Escuta o menu nativo do Electron: Window -> Configurações de Áudio (Ctrl+,)
  useEffect(() => {
    if (window.electronAPI?.onOpenAudioSettings) {
      const unbind = window.electronAPI.onOpenAudioSettings(() => {
        setIsSettingsOpen(true);
      });
      return unbind;
    }
  }, []);

  // Extrai ou recupera do cache as formas de onda REAIS de cada canal diretamente do arquivo selecionado
  useEffect(() => {
    if (!currentVideo || !currentVideo.filepath || !currentVideo.audio_channels || currentVideo.audio_channels.length === 0) {
      setWaveforms({});
      return;
    }

    const filePath = currentVideo.filepath;

    // 1. Se já está no cache, aplica instantaneamente (0ms de espera)
    if (waveformsCache[filePath]) {
      setWaveforms(waveformsCache[filePath]);
      setIsLoadingWaveforms(false);
      return;
    }

    if (!window.electronAPI?.getChannelWaveform) return;

    let isMounted = true;
    setIsLoadingWaveforms(true);

    const loadRealWaveforms = async () => {
      const results: { [channelId: string]: number[] } = {};
      const channels = currentVideo.audio_channels || [];

      for (const ch of channels) {
        try {
          const peaks = await window.electronAPI!.getChannelWaveform!({
            filePath: filePath,
            streamIndex: ch.streamIndex,
            channelIndex: ch.channelIndex,
            numBars: 120
          });
          if (peaks && peaks.length > 0) {
            results[ch.id] = peaks;
          }
        } catch (err) {
          console.warn(`[Waveform] Erro ao extrair canal ${ch.id}:`, err);
        }
      }

      if (isMounted) {
        setWaveforms(results);
        // Salva no cache para este arquivo
        setWaveformsCache((prev) => ({
          ...prev,
          [filePath]: results
        }));
        setIsLoadingWaveforms(false);
      }
    };

    loadRealWaveforms();

    return () => {
      isMounted = false;
    };
  }, [currentVideo?.filepath, waveformsCache]);

  const handleSaveSettings = (newGain: number, newLimit: number) => {
    setGainDb(newGain);
    setLimitDb(newLimit);
    localStorage.setItem('padrao_tvb_gain_db', newGain.toString());
    localStorage.setItem('padrao_tvb_limit_db', newLimit.toString());
  };

  // Adiciona novos vídeos à fila
  const handleAddVideos = (newVideos: VideoMetadata[]) => {
    setVideos((prev) => {
      const existingPaths = new Set(prev.map((v) => v.filepath || v.filename));
      const filtered = newVideos.filter((v) => !existingPaths.has(v.filepath || v.filename));
      return [...prev, ...filtered];
    });
  };

  // Alterna o checkbox de renderização em lote de um vídeo específico
  const handleToggleBatchCheck = (index: number) => {
    setVideos((prev) =>
      prev.map((v, i) => (i === index ? { ...v, isBatchChecked: v.isBatchChecked === false ? true : false } : v))
    );
  };

  // Marca ou desmarca todos os vídeos para a renderização em lote
  const handleToggleAllBatchChecks = (check: boolean) => {
    setVideos((prev) => prev.map((v) => ({ ...v, isBatchChecked: check })));
  };

  // Remove um vídeo da fila e apaga imediatamente o seu cache de memória
  const handleRemoveVideo = (index: number) => {
    const videoToRemove = videos[index];
    if (videoToRemove && videoToRemove.filepath) {
      setWaveformsCache((prev) => {
        const next = { ...prev };
        delete next[videoToRemove.filepath!];
        return next;
      });
    }

    setVideos((prev) => prev.filter((_, i) => i !== index));
    if (selectedVideoIndex === index) {
      setSelectedVideoIndex(null);
      setWaveforms({});
    } else if (selectedVideoIndex !== null && selectedVideoIndex > index) {
      setSelectedVideoIndex(selectedVideoIndex - 1);
    }
  };

  // Limpa todos os vídeos da fila e zera o cache completamente
  const handleClearAllVideos = () => {
    setVideos([]);
    setSelectedVideoIndex(null);
    setWaveforms({});
    setWaveformsCache({});
  };

  // Manipulador para marcar / desmarcar canais individuais discretos do vídeo ativo
  const handleToggleChannel = (channelId: string) => {
    if (selectedVideoIndex === null || !videos[selectedVideoIndex]) return;
    const active = videos[selectedVideoIndex];
    if (!active.audio_channels) return;

    const updatedChannels = active.audio_channels.map((ch) => {
      if (ch.id === channelId) {
        return { ...ch, selected: !ch.selected };
      }
      return ch;
    });

    const updatedStreams = active.audio_streams.map((stream) => {
      const streamChannels = updatedChannels.filter((c) => c.streamIndex === stream.streamIndex);
      const anySelected = streamChannels.some((c) => c.selected);
      return { ...stream, selected: anySelected };
    });

    const updatedVideo: VideoMetadata = {
      ...active,
      audio_channels: updatedChannels,
      audio_streams: updatedStreams,
      isEdited: true // Marca como editado
    };

    setVideos((prev) => prev.map((v, i) => (i === selectedVideoIndex ? updatedVideo : v)));
  };

  const handleSelectAllChannels = (select: boolean) => {
    if (selectedVideoIndex === null || !videos[selectedVideoIndex]) return;
    const active = videos[selectedVideoIndex];
    if (!active.audio_channels) return;

    const updatedChannels = active.audio_channels.map((ch) => ({
      ...ch,
      selected: select
    }));
    const updatedStreams = active.audio_streams.map((stream) => ({
      ...stream,
      selected: select
    }));

    const updatedVideo: VideoMetadata = {
      ...active,
      audio_channels: updatedChannels,
      audio_streams: updatedStreams,
      isEdited: true // Marca como editado
    };

    setVideos((prev) => prev.map((v, i) => (i === selectedVideoIndex ? updatedVideo : v)));
  };

  // Manipulador para alterar a fonte de áudio de um canal (Clonar/Duplicar canais)
  const handleSetChannelSource = (channelId: string, sourceChannelId: string) => {
    if (selectedVideoIndex === null || !videos[selectedVideoIndex]) return;
    const active = videos[selectedVideoIndex];
    if (!active.audio_channels) return;

    const updatedChannels = active.audio_channels.map((ch) => {
      if (ch.id === channelId) {
        return { ...ch, sourceChannelId };
      }
      return ch;
    });

    const updatedVideo: VideoMetadata = {
      ...active,
      audio_channels: updatedChannels,
      isEdited: true // Marca como editado
    };

    setVideos((prev) => prev.map((v, i) => (i === selectedVideoIndex ? updatedVideo : v)));
  };

  const selectedAudioIndices = currentVideo
    ? currentVideo.audio_streams.filter((s) => s.selected).map((s) => s.streamIndex)
    : [];

  // Atualiza o status de renderização de um vídeo na lista (idle, rendering, completed, error)
  const handleUpdateVideoRenderStatus = (filepath: string, status: 'idle' | 'rendering' | 'completed' | 'error') => {
    setVideos((prev) =>
      prev.map((v) => (v.filepath === filepath ? { ...v, renderStatus: status } : v))
    );
  };

  return (
    <div className="h-screen bg-[#0F1112] text-[#E1E1E1] flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white overflow-hidden">
      {/* Main Content Area: 2-Column Split Dashboard (Zero Scroll) */}
      <main className="flex-1 min-h-0 p-3 sm:p-4 overflow-hidden w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        {/* Coluna Esquerda: Fila de Arquivos & Mapeamento de Canais de Áudio */}
        <div className="lg:col-span-6 flex flex-col gap-3 min-h-0 overflow-hidden">
          <VideoDropzone
            videos={videos}
            selectedVideoIndex={selectedVideoIndex}
            onSelectVideoIndex={setSelectedVideoIndex}
            onToggleBatchCheck={handleToggleBatchCheck}
            onToggleAllBatchChecks={handleToggleAllBatchChecks}
            onAddVideos={handleAddVideos}
            onRemoveVideo={handleRemoveVideo}
            onClearAllVideos={handleClearAllVideos}
            isProcessing={false}
          />

          {/* O bloco de canais individuais de áudio só é exibido quando um arquivo é clicado/selecionado */}
          {currentVideo ? (
            <AudioTrackSelector
              videoName={currentVideo.filename}
              audioChannels={currentVideo.audio_channels || []}
              onToggleChannel={handleToggleChannel}
              onSetChannelSource={handleSetChannelSource}
              onSelectAll={handleSelectAllChannels}
              gainDb={gainDb}
              limitDb={limitDb}
              waveforms={waveforms}
              isLoadingWaveforms={isLoadingWaveforms}
            />
          ) : videos.length > 0 ? (
            <div className="bg-[#151719] border border-dashed border-[#2A2D30] rounded-lg p-5 text-center flex-1 min-h-0 flex flex-col items-center justify-center space-y-2 text-gray-500">
              <div className="w-8 h-8 rounded-full bg-[#1A1C1E] border border-[#333] flex items-center justify-center text-gray-400">
                <Sliders className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-xs font-semibold text-gray-300">Nenhum vídeo selecionado para edição</p>
              <p className="text-[11px] text-gray-500 max-w-xs">
                Clique em qualquer arquivo na fila acima para abrir e configurar os seus canais de áudio individuais.
              </p>
            </div>
          ) : null}
        </div>

        {/* Coluna Direita: Monitor de Vídeo Preview & Execução do Encoder MXF */}
        <div className="lg:col-span-6 flex flex-col gap-3 min-h-0 overflow-hidden">
          <VideoPlayerPreview
            video={currentVideo}
            gainDb={gainDb}
            limitDb={limitDb}
          />
          <ConversionTerminal
            videos={videos}
            currentVideo={currentVideo}
            selectedAudioIndices={selectedAudioIndices}
            gainDb={gainDb}
            limitDb={limitDb}
            onUpdateVideoRenderStatus={handleUpdateVideoRenderStatus}
          />
        </div>
      </main>

      {/* Professional Polish Footer */}
      <footer className="h-7 bg-[#0F1112] border-t border-[#333] shrink-0 flex items-center px-4 justify-between text-[10px] text-gray-500 font-mono">
        <div className="flex items-center gap-3 truncate">
          <span className="text-blue-400 font-semibold">Flash Master v1.0.2 by Flash Engine - Wallison Darisvan (83) 99901-0832</span>
          <span className="text-gray-700">&bull;</span>
          <span>XDCAM HD422 OP-1a</span>
          <span className="text-gray-700 hidden sm:inline">&bull;</span>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="text-gray-400 hover:text-blue-400 hover:underline cursor-pointer hidden sm:inline transition-colors"
            title="Clique para alterar o padrão de ganho e limiter (Atalho: Ctrl+, ou Window -> Configurações de Áudio)"
          >
            Linear Gain {gainDb >= 0 ? '+' : ''}{gainDb.toFixed(1)}dB &bull; Hard Limiter {limitDb >= 0 ? '+' : ''}{limitDb.toFixed(1)}dBFS ⚙
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-emerald-400 font-medium">
            {videos.length > 0 ? `${videos.length} NA FILA` : 'PRONTO'}
          </span>
        </div>
      </footer>

      {/* Janela Modal de Configurações de Padrão de Áudio */}
      <AudioSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        gainDb={gainDb}
        limitDb={limitDb}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
