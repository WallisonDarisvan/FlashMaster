import React, { useEffect, useRef } from 'react';
import { AudioChannelInfo } from '../types';

interface AudioVuMeterProps {
  audioChannels: AudioChannelInfo[];
  analysersRef: React.MutableRefObject<{ [chIndex: number]: AnalyserNode }>;
  isPlaying: boolean;
  audioMode?: 'original' | 'corrected';
  gainDb?: number;
  limitDb?: number;
}

export const AudioVuMeter: React.FC<AudioVuMeterProps> = ({
  audioChannels,
  analysersRef,
  isPlaying,
  audioMode = 'corrected',
  gainDb = 7,
  limitDb = -12
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Armazena picos para efeito Peak-Hold (retenção de pico de estúdio de TV)
  const peakHoldRef = useRef<{ [chIndex: number]: number }>({});
  const currentLevelsRef = useRef<{ [chIndex: number]: number }>({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderMeters = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width > 0 ? rect.width : 340;
      const height = rect.height > 0 ? rect.height : 48;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const channels = audioChannels.length > 0 ? audioChannels : [];
      const numMeters = Math.max(1, channels.length);
      const rowHeight = Math.min(18, Math.max(12, (height - (numMeters - 1) * 3) / numMeters));

      channels.forEach((ch, idx) => {
        const y = idx * (rowHeight + 3);
        const labelWidth = 55;
        const dbWidth = 46;
        const meterWidth = Math.max(50, width - labelWidth - dbWidth - 10);
        const meterX = labelWidth + 4;

        // 1. Label do Canal
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = ch.selected ? '#93C5FD' : '#4B5563';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const chName = `CH ${idx + 1} (${ch.layoutName.slice(0, 3)})`;
        ctx.fillText(chName, 2, y + rowHeight / 2);

        // 2. Leitura de nível via AnalyserNode do Web Audio
        let targetLevel = 0;
        const analyser = analysersRef.current[ch.channelIndex];

        if (isPlaying && ch.selected && analyser) {
          const buffer = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteTimeDomainData(buffer);
          let peak = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = Math.abs((buffer[i] - 128) / 128);
            if (v > peak) peak = v;
          }
          targetLevel = peak;
        }

        // Suavização balística (Attack rápido, Release suave broadcast)
        const prevLevel = currentLevelsRef.current[ch.channelIndex] || 0;
        const newLevel = targetLevel > prevLevel
          ? prevLevel + (targetLevel - prevLevel) * 0.8
          : prevLevel * 0.88;
        currentLevelsRef.current[ch.channelIndex] = newLevel;

        // Peak Hold
        const prevPeak = peakHoldRef.current[ch.channelIndex] || 0;
        const newPeak = newLevel >= prevPeak
          ? newLevel
          : Math.max(0, prevPeak * 0.982);
        peakHoldRef.current[ch.channelIndex] = newPeak;

        // Fundo do meter (Track escuro com marcações de escala)
        ctx.fillStyle = '#0B0D0E';
        ctx.fillRect(meterX, y, meterWidth, rowHeight);
        ctx.strokeStyle = '#22262A';
        ctx.lineWidth = 1;
        ctx.strokeRect(meterX, y, meterWidth, rowHeight);

        // Barra de Modulação Ativa
        const activeWidth = Math.min(meterWidth, meterWidth * Math.min(1, newLevel * 1.35));

        if (activeWidth > 0 && ch.selected) {
          // Gradiente Padrão TVB: Verde (-60 a -18dB) -> Amarelo (-18 a -12dB) -> Vermelho (-12 a 0dB)
          const grad = ctx.createLinearGradient(meterX, 0, meterX + meterWidth, 0);
          grad.addColorStop(0, '#10B981'); // Verde
          grad.addColorStop(0.68, '#34D399'); // Verde claro
          grad.addColorStop(0.72, '#FBBF24'); // Amarelo início faixa TVB (-18dB)
          grad.addColorStop(0.86, '#F59E0B'); // Âmbar limite TVB (-12dBFS)
          grad.addColorStop(0.92, '#EF4444'); // Vermelho (Pico acima do limiter)

          ctx.fillStyle = grad;
          ctx.fillRect(meterX + 1, y + 1, activeWidth - 2, rowHeight - 2);
        }

        // Marcador dinâmico do Limiter
        const limiterPos = Math.max(0.3, Math.min(0.96, (limitDb + 48) / 48));
        const limiterX = meterX + meterWidth * limiterPos;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(limiterX, y);
        ctx.lineTo(limiterX, y + rowHeight);
        ctx.stroke();

        // Linha Peak Hold (tracinho de pico retido)
        if (ch.selected && newPeak > 0.02) {
          const peakX = Math.min(meterX + meterWidth - 2, meterX + meterWidth * Math.min(1, newPeak * 1.35));
          ctx.fillStyle = newPeak > 0.85 ? '#EF4444' : '#FBBF24';
          ctx.fillRect(peakX - 1, y, 2, rowHeight);
        }

        // 3. Indicador Numérico em dBFS
        ctx.font = '8px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        if (!ch.selected) {
          ctx.fillStyle = '#64748B';
          ctx.fillText('MUDO', width - 2, y + rowHeight / 2);
        } else if (newLevel <= 0.005) {
          ctx.fillStyle = '#64748B';
          ctx.fillText('-inf dB', width - 2, y + rowHeight / 2);
        } else {
          const dbVal = Math.round(20 * Math.log10(Math.min(1, newLevel * 1.35)));
          ctx.fillStyle = dbVal >= limitDb ? '#F59E0B' : '#10B981';
          ctx.fillText(`${dbVal > 0 ? '+' : ''}${dbVal} dB`, width - 2, y + rowHeight / 2);
        }
      });

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(renderMeters);
    };

    animFrameRef.current = requestAnimationFrame(renderMeters);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [audioChannels, isPlaying, gainDb, limitDb, audioMode]);

  if (audioChannels.length === 0) return null;

  return (
    <div className="w-full bg-[#101214] border-t border-[#25282B] px-3 py-1.5 shrink-0 flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[8px] font-mono text-gray-500 mb-0.5 px-0.5">
        <span className="text-gray-400 font-semibold tracking-wider flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${audioMode === 'corrected' ? 'bg-blue-500 animate-pulse' : 'bg-amber-500'}`}></span>
          {audioMode === 'corrected' ? `VU METERS • PADRÃO (+${gainDb}dB / ${limitDb}dB)` : 'VU METERS • ÁUDIO ORIGINAL (BRUTO)'}
        </span>
        <div className="flex items-center gap-3">
          <span>-40</span>
          <span>-24</span>
          <span className="text-amber-400 font-bold">{limitDb}dB (LIMITER)</span>
          <span className="text-rose-500 font-bold">0dB</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: `${Math.max(26, audioChannels.length * 16)}px` }}
      />
    </div>
  );
};
