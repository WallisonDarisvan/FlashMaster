import React, { useState, useEffect } from 'react';
import { VideoDropzone } from './components/VideoDropzone';
import { VideoPlayerPreview } from './components/VideoPlayerPreview';
import { AudioTrackSelector } from './components/AudioTrackSelector';
import { ConversionTerminal } from './components/ConversionTerminal';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { VideoMetadata } from './types';

export default function App() {
  const [currentVideo, setCurrentVideo] = useState<VideoMetadata | null>(null);

  // Estados de configuração de ganho e limiter com persistência local
  const [gainDb, setGainDb] = useState<number>(() => {
    const saved = localStorage.getItem('padrao_tvb_gain_db');
    return saved ? parseFloat(saved) : 7;
  });
  const [limitDb, setLimitDb] = useState<number>(() => {
    const saved = localStorage.getItem('padrao_tvb_limit_db');
    return saved ? parseFloat(saved) : -12;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Armazena picos reais de forma de onda por canal
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

  // Extrai as formas de onda REAIS de cada canal diretamente do arquivo com o FFmpeg
  useEffect(() => {
    if (!currentVideo || !currentVideo.filepath || !currentVideo.audio_channels || currentVideo.audio_channels.length === 0) {
      setWaveforms({});
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
            filePath: currentVideo.filepath!,
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
        setIsLoadingWaveforms(false);
      }
    };

    loadRealWaveforms();

    return () => {
      isMounted = false;
    };
  }, [currentVideo?.filepath]);

  const handleSaveSettings = (newGain: number, newLimit: number) => {
    setGainDb(newGain);
    setLimitDb(newLimit);
    localStorage.setItem('padrao_tvb_gain_db', newGain.toString());
    localStorage.setItem('padrao_tvb_limit_db', newLimit.toString());
  };

  // Manipulador para marcar / desmarcar canais individuais discretos
  const handleToggleChannel = (channelId: string) => {
    if (!currentVideo || !currentVideo.audio_channels) return;
    const updatedChannels = currentVideo.audio_channels.map((ch) => {
      if (ch.id === channelId) {
        return { ...ch, selected: !ch.selected };
      }
      return ch;
    });

    // Mantém sincronizado com audio_streams
    const updatedStreams = currentVideo.audio_streams.map((stream) => {
      const streamChannels = updatedChannels.filter((c) => c.streamIndex === stream.streamIndex);
      const anySelected = streamChannels.some((c) => c.selected);
      return { ...stream, selected: anySelected };
    });

    setCurrentVideo({
      ...currentVideo,
      audio_channels: updatedChannels,
      audio_streams: updatedStreams
    });
  };

  const handleSelectAllChannels = (select: boolean) => {
    if (!currentVideo || !currentVideo.audio_channels) return;
    const updatedChannels = currentVideo.audio_channels.map((ch) => ({
      ...ch,
      selected: select
    }));
    const updatedStreams = currentVideo.audio_streams.map((stream) => ({
      ...stream,
      selected: select
    }));
    setCurrentVideo({
      ...currentVideo,
      audio_channels: updatedChannels,
      audio_streams: updatedStreams
    });
  };

  // Manipulador para alterar a fonte de áudio de um canal (Clonar/Duplicar canais)
  const handleSetChannelSource = (channelId: string, sourceChannelId: string) => {
    if (!currentVideo || !currentVideo.audio_channels) return;
    const updatedChannels = currentVideo.audio_channels.map((ch) => {
      if (ch.id === channelId) {
        return { ...ch, sourceChannelId };
      }
      return ch;
    });

    setCurrentVideo({
      ...currentVideo,
      audio_channels: updatedChannels
    });
  };

  const selectedAudioIndices = currentVideo
    ? currentVideo.audio_streams.filter((s) => s.selected).map((s) => s.streamIndex)
    : [];

  return (
    <div className="h-screen bg-[#0F1112] text-[#E1E1E1] flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white overflow-hidden">
      {/* Main Content Area: 2-Column Split Dashboard (Zero Scroll) */}
      <main className="flex-1 min-h-0 p-3 sm:p-4 overflow-hidden w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        {/* Coluna Esquerda: Arquivo de Entrada & Mapeamento de Canais de Áudio */}
        <div className="lg:col-span-6 flex flex-col gap-3 min-h-0 overflow-hidden">
          <VideoDropzone
            currentVideo={currentVideo}
            onSelectVideo={setCurrentVideo}
            isProcessing={false}
          />
          <AudioTrackSelector
            audioChannels={currentVideo?.audio_channels || []}
            onToggleChannel={handleToggleChannel}
            onSetChannelSource={handleSetChannelSource}
            onSelectAll={handleSelectAllChannels}
            gainDb={gainDb}
            limitDb={limitDb}
            waveforms={waveforms}
            isLoadingWaveforms={isLoadingWaveforms}
          />
        </div>

        {/* Coluna Direita: Monitor de Vídeo Preview & Execução do Encoder MXF */}
        <div className="lg:col-span-6 flex flex-col gap-3 min-h-0 overflow-hidden">
          <VideoPlayerPreview
            video={currentVideo}
            gainDb={gainDb}
            limitDb={limitDb}
          />
          <ConversionTerminal
            video={currentVideo}
            selectedAudioIndices={selectedAudioIndices}
            gainDb={gainDb}
            limitDb={limitDb}
          />
        </div>
      </main>

      {/* Professional Polish Footer */}
      <footer className="h-7 bg-[#0F1112] border-t border-[#333] shrink-0 flex items-center px-4 justify-between text-[10px] text-gray-500 font-mono">
        <div className="flex items-center gap-3 truncate">
          <span className="text-blue-400 font-semibold">Flash Master by Flash Engine - Wallison Darisvan (83) 99901-0832</span>
          <span className="text-gray-700">&bull;</span>
          <span>XDCAM HD422 OP-1a</span>
          <span className="text-gray-700 hidden sm:inline">&bull;</span>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="text-gray-400 hover:text-blue-400 hover:underline cursor-pointer hidden sm:inline transition-colors"
            title="Clique para alterar o padrão de ganho e limiter (Atalho: Ctrl+, ou Window -> Configurações de Áudio)"
          >
            Linear Gain +{gainDb}dB &bull; Hard Limiter {limitDb}dBFS ⚙
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-emerald-400 font-medium">PRONTO</span>
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

