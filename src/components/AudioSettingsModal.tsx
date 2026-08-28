import React, { useState, useEffect } from 'react';
import { Sliders, RotateCcw, Check, X, Volume2, ShieldAlert } from 'lucide-react';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gainDb: number;
  limitDb: number;
  onSave: (newGain: number, newLimit: number) => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  onClose,
  gainDb,
  limitDb,
  onSave
}) => {
  const [localGain, setLocalGain] = useState<number>(gainDb);
  const [localLimit, setLocalLimit] = useState<number>(limitDb);

  useEffect(() => {
    if (isOpen) {
      setLocalGain(gainDb);
      setLocalLimit(limitDb);
    }
  }, [isOpen, gainDb, limitDb]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResetToDefault = () => {
    setLocalGain(0);
    setLocalLimit(0);
  };

  const handleConfirmSave = () => {
    onSave(localGain, localLimit);
    onClose();
  };

  const isDefault = localGain === 0 && localLimit === 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#151719] border border-[#333] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1A1C1E] px-4 py-3 border-b border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="font-mono font-bold text-xs text-white uppercase tracking-wider">
              Configurações de Padrão de Áudio
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xs font-mono px-2 py-1 bg-[#24272B] hover:bg-[#333] rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-5 font-mono text-xs text-gray-300">
          <p className="text-[11px] text-gray-400 font-sans leading-relaxed">
            Ajuste os parâmetros de normalização broadcast. Essas alterações são aplicadas tanto no <strong>monitor de preview em tempo real</strong> quanto na <strong>conversão final para MXF</strong>.
          </p>

          {/* 1. Ganho Linear */}
          <div className="bg-[#101214] p-3 rounded-lg border border-[#25282B] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-300 font-bold">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ganho Linear de Áudio:</span>
              </div>
              <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded font-bold text-xs">
                {localGain >= 0 ? '+' : ''}{localGain.toFixed(1)} dB
              </span>
            </div>

            <input
              type="range"
              min="-24"
              max="24"
              step="0.5"
              value={localGain}
              onChange={(e) => setLocalGain(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#202428] rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <div className="flex justify-between text-[9px] text-gray-500">
              <span>-24.0 dB</span>
              <span className={localGain === 0 ? 'text-emerald-400 font-bold' : ''}>0.0 dB (Padrão)</span>
              <span>+24.0 dB</span>
            </div>
          </div>

          {/* 2. Limitador Rígido */}
          <div className="bg-[#101214] p-3 rounded-lg border border-[#25282B] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-300 font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Teto do Hard Limiter:</span>
              </div>
              <span className="bg-amber-950/60 text-amber-400 border border-amber-800/80 px-2 py-0.5 rounded font-bold text-xs">
                {localLimit >= 0 ? '+' : ''}{localLimit.toFixed(1)} dBFS
              </span>
            </div>

            <input
              type="range"
              min="-24"
              max="24"
              step="0.5"
              value={localLimit}
              onChange={(e) => setLocalLimit(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#202428] rounded-lg appearance-none cursor-pointer accent-amber-500"
            />

            <div className="flex justify-between text-[9px] text-gray-500">
              <span>-24.0 dBFS</span>
              <span className={localLimit === 0 ? 'text-amber-400 font-bold' : ''}>0.0 dBFS (Padrão)</span>
              <span>+24.0 dBFS</span>
            </div>
          </div>

          {/* Status do Padrão */}
          <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isDefault ? 'bg-emerald-400' : 'bg-blue-400 animate-pulse'}`}></div>
              <span>
                {isDefault ? 'Padrão Oficial ativo (0dB / 0dBFS)' : 'Padrão personalizado em uso'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Restaurar Padrão Oficial
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#1A1C1E] px-4 py-3 border-t border-[#333] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs font-mono text-gray-400 hover:text-white bg-[#25282B] hover:bg-[#333] transition-colors"
          >
            Cancelar (ESC)
          </button>
          <button
            type="button"
            onClick={handleConfirmSave}
            className="px-4 py-1.5 rounded text-xs font-mono font-bold text-white bg-blue-600 hover:bg-blue-500 shadow flex items-center gap-1.5 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            Salvar e Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
