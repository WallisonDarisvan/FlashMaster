import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { VideoDropzone } from './components/VideoDropzone';
import { VideoPlayerPreview } from './components/VideoPlayerPreview';
import { AudioTrackSelector } from './components/AudioTrackSelector';
import { AudioLimiterVisualizer } from './components/AudioLimiterVisualizer';
import { ConversionTerminal } from './components/ConversionTerminal';
import { CodeExplorer } from './components/CodeExplorer';
import { PackagingGuide } from './components/PackagingGuide';
import { SAMPLE_VIDEOS } from './data/sampleMedia';
import { VideoMetadata } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'converter' | 'code' | 'audio-filter' | 'packaging'>('converter');
  const [currentVideo, setCurrentVideo] = useState<VideoMetadata | null>(SAMPLE_VIDEOS[0]);

  // Manipuladores de trilhas de áudio
  const handleToggleTrack = (streamIndex: number) => {
    if (!currentVideo) return;
    const updatedStreams = currentVideo.audio_streams.map((stream) => {
      if (stream.streamIndex === streamIndex) {
        return { ...stream, selected: !stream.selected };
      }
      return stream;
    });
    setCurrentVideo({
      ...currentVideo,
      audio_streams: updatedStreams
    });
  };

  const handleSelectAllTracks = (select: boolean) => {
    if (!currentVideo) return;
    const updatedStreams = currentVideo.audio_streams.map((stream) => ({
      ...stream,
      selected: select
    }));
    setCurrentVideo({
      ...currentVideo,
      audio_streams: updatedStreams
    });
  };

  const handleAddTrack = () => {
    if (!currentVideo) return;
    const nextIdx = currentVideo.audio_streams.length;
    const nextStreamIndex = currentVideo.audio_streams.length > 0 
      ? Math.max(...currentVideo.audio_streams.map(s => s.streamIndex)) + 1 
      : 0;
    
    const newTrack = {
      index: nextIdx + 1,
      streamIndex: nextStreamIndex,
      codec_name: 'pcm_s24le',
      codec_long_name: 'PCM signed 24-bit little-endian',
      channels: 1,
      channel_layout: `mono (Ch ${nextIdx + 1})`,
      sample_rate: 48000,
      bits_per_sample: 24,
      language: 'por',
      title: `Trilha ${nextIdx + 1}: Canal Adicional / Auxiliar (Ch ${nextIdx + 1})`,
      selected: true,
      rms_db: -24.0,
      peak_db: -9.5
    };

    setCurrentVideo({
      ...currentVideo,
      audio_streams: [...currentVideo.audio_streams, newTrack]
    });
  };

  const handleRemoveTrack = (streamIndex: number) => {
    if (!currentVideo) return;
    const filtered = currentVideo.audio_streams.filter(s => s.streamIndex !== streamIndex);
    setCurrentVideo({
      ...currentVideo,
      audio_streams: filtered
    });
  };

  const handleSetPresetCount = (count: number) => {
    if (!currentVideo) return;
    const defaultLabels = [
      'Trilha 1: PGM Full Mix (Canal Esquerdo / L)',
      'Trilha 2: PGM Full Mix (Canal Direito / R)',
      'Trilha 3: M&E - Trilha Sonora & Efeitos (Music & Effects)',
      'Trilha 4: Locução Limpa / Voz Isolada (Voice Over)',
      'Trilha 5: Surround Central / Diálogo (C)',
      'Trilha 6: Subwoofer / Efeitos Graves (LFE)',
      'Trilha 7: Surround Traseiro Esquerdo (Ls)',
      'Trilha 8: Surround Traseiro Direito (Rs)'
    ];

    const newStreams = Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      streamIndex: i,
      codec_name: 'pcm_s24le',
      codec_long_name: 'PCM signed 24-bit little-endian',
      channels: 1,
      channel_layout: i < 2 ? (i === 0 ? 'mono (PGM L)' : 'mono (PGM R)') : `mono (Ch ${i + 1})`,
      sample_rate: 48000,
      bits_per_sample: 24,
      language: 'por',
      title: defaultLabels[i] || `Trilha ${i + 1}: Canal Auxiliar ${i + 1}`,
      selected: true,
      rms_db: -20 - (i * 2),
      peak_db: -6 - (i * 1.5)
    }));

    setCurrentVideo({
      ...currentVideo,
      audio_streams: newStreams
    });
  };

  const selectedAudioIndices = currentVideo
    ? currentVideo.audio_streams.filter((s) => s.selected).map((s) => s.streamIndex)
    : [];

  return (
    <div className="min-h-screen bg-[#0F1112] text-[#E1E1E1] flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {activeTab === 'converter' && (
          <div className="space-y-6">
            {/* Top Row: File Dropzone & Video Player Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VideoDropzone
                currentVideo={currentVideo}
                onSelectVideo={setCurrentVideo}
                isProcessing={false}
              />
              <VideoPlayerPreview video={currentVideo} />
            </div>

            {/* Audio Track Selector with Checkboxes */}
            <AudioTrackSelector
              audioStreams={currentVideo?.audio_streams || []}
              onToggleTrack={handleToggleTrack}
              onSelectAll={handleSelectAllTracks}
              onAddTrack={handleAddTrack}
              onRemoveTrack={handleRemoveTrack}
              onSetPresetCount={handleSetPresetCount}
            />

            {/* Audio Limiter & Leveling Specs */}
            <AudioLimiterVisualizer />

            {/* Conversion Terminal & FFmpeg Engine */}
            <ConversionTerminal
              video={currentVideo}
              selectedAudioIndices={selectedAudioIndices}
            />
          </div>
        )}

        {activeTab === 'code' && <CodeExplorer />}

        {activeTab === 'audio-filter' && (
          <div className="space-y-6">
            <AudioLimiterVisualizer />
            <PackagingGuide />
          </div>
        )}

        {activeTab === 'packaging' && <PackagingGuide />}
      </main>

      {/* Professional Polish Footer */}
      <footer className="h-9 bg-[#0F1112] border-t border-[#333] flex items-center px-4 sm:px-6 justify-between text-[11px] text-gray-500 font-mono">
        <div className="flex items-center gap-4 truncate">
          <span className="hidden sm:inline">PATH: /usr/local/bin/ffmpeg</span>
          <span className="text-gray-700 hidden sm:inline">&bull;</span>
          <span className="text-blue-400">STATUS: ENGINE_ACTIVE</span>
          <span className="text-gray-700 hidden md:inline">&bull;</span>
          <span className="hidden md:inline">PID: 49202</span>
          <span className="text-gray-700 hidden lg:inline">&bull;</span>
          <span className="text-gray-400 hidden lg:inline">SMPTE 377M &bull; -af "volume=7dB,alimiter=limit=-12dB"</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-emerald-400 font-medium">SYSTEM RESOURCES OPTIMAL</span>
        </div>
      </footer>
    </div>
  );
}

