import React from 'react';
import { Sliders, Layers, Volume2, VolumeX, Copy } from 'lucide-react';
import { AudioChannelInfo } from '../types';
import { ChannelWaveform } from './ChannelWaveform';

interface AudioTrackSelectorProps {
  videoName?: string;
  audioChannels: AudioChannelInfo[];
  onToggleChannel: (channelId: string) => void;
  onSetChannelSource: (channelId: string, sourceChannelId: string) => void;
  onSelectAll: (select: boolean) => void;
  gainDb?: number;
  limitDb?: number;
  waveforms?: { [channelId: string]: number[] };
  isLoadingWaveforms?: boolean;
}

export const AudioTrackSelector: React.FC<AudioTrackSelectorProps> = ({
  videoName,
  audioChannels,
  onToggleChannel,
  onSetChannelSource,
  onSelectAll,
  gainDb = 7,
  limitDb = -12,
  waveforms,
  isLoadingWaveforms
}) => {
  const selectedCount = audioChannels.filter((c) => c.selected).length;
  const allSelected = audioChannels.length > 0 && selectedCount === audioChannels.length;

  return (
    <div className="bg-[#151719] border border-[#333] rounded-lg p-3 sm:p-3.5 shadow-lg space-y-2 flex-1 min-h-0 flex flex-col">
      {/* Header with Select All / Deselect All */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              Canais de Áudio {videoName ? `• ${videoName}` : `(${audioChannels.length} ${audioChannels.length === 1 ? 'CANAL' : 'CANAIS'})`}
            </h3>
            {audioChannels.length > 0 ? (
              <span className="text-[9px] bg-emerald-900/30 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-800 font-mono font-bold">
                {audioChannels.length} {audioChannels.length === 1 ? 'CANAL' : 'CANAIS'}
              </span>
            ) : (
              <span className="text-[9px] bg-[#1A1C1E] text-gray-500 px-1.5 py-0.2 rounded border border-[#333] font-mono">
                STANDBY
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {audioChannels.length > 0
              ? `Configure a fonte e marque os canais a exportar para este arquivo:`
              : 'Clique em um arquivo acima para configurar seus canais discretos.'}
          </p>
        </div>

        {/* Action Controls */}
        {audioChannels.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectAll(!allSelected)}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-mono font-medium px-2 py-0.5 rounded bg-[#1A1C1E] border border-[#333] hover:border-blue-500/50 transition-colors"
            >
              {allSelected ? 'DESMARCAR TODOS' : 'MARCAR TODOS'}
            </button>
          </div>
        )}
      </div>

      {/* Channel List with Internal Scrollbar */}
      <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
        {audioChannels.length === 0 ? (
          <div className="border border-dashed border-[#333] rounded-lg p-4 text-center text-xs text-gray-400 font-mono space-y-1 my-auto">
            <div className="text-gray-300 font-medium text-[11px]">NENHUM VÍDEO CARREGADO</div>
            <p className="text-[10px] text-gray-500 max-w-sm mx-auto">
              Carregue um arquivo para que os canais de áudio sejam divididos individualmente (L, R, etc.).
            </p>
          </div>
        ) : (
          audioChannels.map((ch) => {
            const isSelected = ch.selected;
            const isCloned = ch.sourceChannelId && ch.sourceChannelId !== ch.id;
            const sourceChannel = audioChannels.find((c) => c.id === ch.sourceChannelId);

            return (
              <div
                key={ch.id}
                onClick={() => onToggleChannel(ch.id)}
                className={`p-2.5 rounded border transition-all cursor-pointer flex items-center gap-2.5 ${
                  isSelected
                    ? isCloned
                      ? 'bg-blue-950/30 border-blue-500/70 shadow-sm'
                      : 'bg-blue-900/15 border-blue-500/60 shadow-sm'
                    : 'bg-[#1A1C1E] border-[#2A2D30] opacity-60 hover:opacity-90 hover:border-gray-600'
                }`}
              >
                {/* Checkbox */}
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 accent-blue-500 rounded bg-[#0F1112] border-[#333] cursor-pointer"
                  />
                </div>

                {/* Channel Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className={`text-[11px] font-bold tracking-wide truncate ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                        {ch.label}
                      </span>
                      <span className="bg-[#0F1112] text-blue-400 font-mono text-[9px] px-1 py-0.2 rounded border border-[#333] shrink-0">
                        {ch.layoutName}
                      </span>
                      {isCloned && (
                        <span className="bg-blue-600/30 text-blue-300 font-mono text-[9px] px-1.5 py-0.2 rounded border border-blue-500/60 shrink-0 font-semibold flex items-center gap-1">
                          <Copy className="w-2.5 h-2.5" /> CLONADO
                        </span>
                      )}
                    </div>

                    {/* Controles da Direita: Seletor de Fonte + Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Seletor de Roteamento de Fonte (Opção A) */}
                      <div
                        className="flex items-center gap-1 bg-[#0F1112] px-1.5 py-0.5 rounded border border-[#333] hover:border-blue-500/50 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        title="Escolha a fonte deste canal: use o som próprio ou duplique/clone de outro canal"
                      >
                        <span className="text-[9px] text-gray-400 font-mono">Fonte:</span>
                        <select
                          value={ch.sourceChannelId || ch.id}
                          onChange={(e) => onSetChannelSource(ch.id, e.target.value)}
                          className="bg-transparent text-[9px] font-mono text-blue-300 font-bold focus:outline-none cursor-pointer"
                        >
                          {audioChannels.map((src) => (
                            <option key={src.id} value={src.id} className="bg-[#1A1C1E] text-gray-200">
                              {src.id === ch.id ? `${src.label} (Original)` : `Clonar do ${src.label}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold flex items-center gap-1 ${
                        isSelected
                          ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
                          : 'bg-rose-900/20 text-rose-400 border-rose-900/40'
                      }`}>
                        {isSelected ? (
                          <>
                            <Volume2 className="w-2.5 h-2.5" />
                            EXPORTAR (+{gainDb}dB/{limitDb}dB)
                          </>
                        ) : (
                          <>
                            <VolumeX className="w-2.5 h-2.5" />
                            EXCLUÍDO DO MXF
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Forma de Onda do Canal (Broadcast Waveform Strip) */}
                  <div className="mt-1.5 h-5 bg-[#090A0B] rounded border border-[#222528] overflow-hidden px-1.5 py-0.5 flex items-center">
                    <ChannelWaveform
                      channelId={ch.id}
                      sourceChannelId={ch.sourceChannelId || ch.id}
                      isSelected={isSelected}
                      realPeaks={waveforms ? waveforms[ch.sourceChannelId || ch.id] : undefined}
                      isLoading={isLoadingWaveforms}
                    />
                  </div>

                  {/* Channel Specs */}
                  <div className="mt-1 flex items-center gap-2 text-[9px] font-mono text-gray-400 flex-wrap">
                    <span className="text-gray-300">Codec Origem: <strong className="text-white uppercase">{ch.codec_name}</strong></span>
                    <span>&bull;</span>
                    <span>Destino: <strong className="text-blue-300">PCM 24-bit</strong></span>
                    <span>&bull;</span>
                    <span>Amostragem: <strong className="text-gray-200">{ch.sample_rate ? ch.sample_rate.toLocaleString() : '48.000'} Hz</strong></span>
                    {ch.bit_rate ? (
                      <>
                        <span>&bull;</span>
                        <span>Bitrate: <strong className="text-gray-200">{Math.round(ch.bit_rate / 1000)} kbps</strong></span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary Badge */}
      {audioChannels.length > 0 && (
        <div className="p-2 bg-blue-900/10 border border-blue-900/30 rounded flex items-center justify-between gap-2 text-[10px] font-mono shrink-0 mt-auto">
          <div className="flex items-center space-x-1.5 text-gray-300">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>
              Canais no MXF:{' '}
              <strong className="text-white font-mono">
                {selectedCount} de {audioChannels.length}
              </strong>
            </span>
          </div>

          <div>
            {selectedCount === 0 ? (
              <span className="text-amber-400 font-semibold">Nenhum canal selecionado</span>
            ) : (
              <span className="text-emerald-400 font-semibold">
                OP-1a &bull; {selectedCount} {selectedCount === 1 ? 'Canal no MXF' : 'Canais no MXF'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
