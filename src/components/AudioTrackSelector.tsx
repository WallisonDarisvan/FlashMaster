import React from 'react';
import { Sliders, CheckSquare, Square, Layers, Plus, Trash2, RotateCcw, Volume2 } from 'lucide-react';
import { AudioStreamInfo } from '../types';

interface AudioTrackSelectorProps {
  audioStreams: AudioStreamInfo[];
  onToggleTrack: (streamIndex: number) => void;
  onSelectAll: (select: boolean) => void;
  onAddTrack?: () => void;
  onRemoveTrack?: (streamIndex: number) => void;
  onSetPresetCount?: (count: number) => void;
}

export const AudioTrackSelector: React.FC<AudioTrackSelectorProps> = ({
  audioStreams,
  onToggleTrack,
  onSelectAll,
  onAddTrack,
  onRemoveTrack,
  onSetPresetCount
}) => {
  const selectedCount = audioStreams.filter((s) => s.selected).length;
  const allSelected = audioStreams.length > 0 && selectedCount === audioStreams.length;

  return (
    <div className="bg-[#151719] border border-[#333] rounded-lg p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header with Select All / Deselect All & Channel Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              Mapeamento de Linhas de Áudio (ffprobe Stream Detection)
            </h3>
            {audioStreams.length > 0 && (
              <span className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-800 font-mono font-bold">
                {audioStreams.length} LINHAS IDENTIFICADAS
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Selecione quais das {audioStreams.length} trilhas serão processadas com o filtro <code className="text-blue-400 font-mono bg-[#1A1C1E] px-1 py-0.5 rounded border border-[#333]">+7dB / Limiter -12dB</code> e encapsuladas no MXF:
          </p>
        </div>

        {/* Action Controls & Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          {onSetPresetCount && (
            <div className="flex items-center gap-1 bg-[#1A1C1E] p-0.5 rounded border border-[#333]">
              <span className="text-[10px] font-mono text-gray-500 px-1.5 uppercase">Presets:</span>
              <button
                type="button"
                onClick={() => onSetPresetCount(2)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                  audioStreams.length === 2
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Configurar 2 Canais (Stereo L/R)"
              >
                2CH
              </button>
              <button
                type="button"
                onClick={() => onSetPresetCount(4)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                  audioStreams.length === 4
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Configurar 4 Canais Broadcast (PGM L/R + M&E + Voz)"
              >
                4CH (Padrão)
              </button>
              <button
                type="button"
                onClick={() => onSetPresetCount(8)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                  audioStreams.length === 8
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Configurar 8 Canais Multitrack"
              >
                8CH
              </button>
            </div>
          )}

          {audioStreams.length > 0 && (
            <button
              type="button"
              onClick={() => onSelectAll(!allSelected)}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-mono font-medium px-2.5 py-1 rounded bg-[#1A1C1E] border border-[#333] hover:border-blue-500/50 transition-colors"
            >
              {allSelected ? 'DESMARCAR TODAS' : 'MARCAR TODAS'}
            </button>
          )}

          {onAddTrack && (
            <button
              type="button"
              onClick={onAddTrack}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono font-medium px-2.5 py-1 rounded bg-[#1A1C1E] border border-[#333] hover:border-emerald-500/50 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> ADICIONAR TRILHA
            </button>
          )}
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-2">
        {audioStreams.length === 0 ? (
          <div className="border border-dashed border-[#333] rounded-lg p-6 text-center text-xs text-gray-600 font-mono space-y-2">
            <div>NENHUMA LINHA DE ÁUDIO DETECTADA &bull; CARREGUE UM VÍDEO</div>
            {onSetPresetCount && (
              <button
                type="button"
                onClick={() => onSetPresetCount(4)}
                className="text-[11px] text-blue-400 hover:underline font-mono"
              >
                Clique aqui para carregar as 4 trilhas padrão broadcast
              </button>
            )}
          </div>
        ) : (
          audioStreams.map((stream, idx) => {
            const isSelected = stream.selected;
            const meterWidth = Math.min(100, Math.max(15, ((stream.peak_db || -10) + 40) * 2.5));

            return (
              <div
                key={`${stream.streamIndex}-${idx}`}
                onClick={() => onToggleTrack(stream.streamIndex)}
                className={`p-3 rounded border transition-all cursor-pointer flex items-center gap-3.5 ${
                  isSelected
                    ? 'bg-blue-900/10 border-blue-500/50 shadow-sm'
                    : 'bg-[#1A1C1E] border-[#333] opacity-60 hover:opacity-90 hover:border-gray-600'
                }`}
              >
                {/* Custom Checkbox */}
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 accent-blue-500 rounded bg-[#0F1112] border-[#333] cursor-pointer"
                  />
                </div>

                {/* Stream Info Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 truncate">
                      <span className={`text-xs font-semibold tracking-wide truncate ${isSelected ? 'text-blue-300' : 'text-gray-300'}`}>
                        Linha {idx + 1}: {stream.title || `Trilha #${idx + 1}`}
                      </span>
                      <span className="bg-[#0F1112] text-blue-400 font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#333] shrink-0">
                        -map 0:a:{stream.streamIndex}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-gray-400 bg-[#0F1112] px-2 py-0.5 rounded border border-[#2A2D30] hidden sm:inline">
                        {stream.sample_rate}Hz &bull; {stream.channel_layout || 'mono'}
                      </span>
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                        isSelected
                          ? 'bg-blue-900/30 text-blue-400 border-blue-800'
                          : 'bg-gray-800/40 text-gray-500 border-gray-800'
                      }`}>
                        {isSelected ? 'PROCESSED' : 'MUTED'}
                      </span>

                      {onRemoveTrack && audioStreams.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTrack(stream.streamIndex);
                          }}
                          className="p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                          title="Remover esta linha de áudio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Level meter bar */}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isSelected ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                        style={{ width: `${meterWidth}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-gray-500 shrink-0">
                      Peak: <strong className={isSelected ? 'text-gray-300' : 'text-gray-600'}>{stream.peak_db ? `${stream.peak_db} dBFS` : '-8.5 dBFS'}</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary Badge */}
      {audioStreams.length > 0 && (
        <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-gray-300">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>
              Linhas ativas para transcodificação MXF:{' '}
              <strong className="text-white font-mono">
                {selectedCount} de {audioStreams.length}
              </strong>
            </span>
          </div>

          <div className="text-[11px] font-mono">
            {selectedCount === 0 ? (
              <span className="text-amber-400 font-semibold">Selecione ao menos 1 linha de áudio</span>
            ) : (
              <span className="text-blue-400 font-semibold">
                FFmpeg Stream Map: {audioStreams.filter(s => s.selected).map(s => `-map 0:a:${s.streamIndex}`).join(' ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
