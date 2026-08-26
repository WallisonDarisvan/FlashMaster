import React, { useEffect, useRef } from 'react';

interface ChannelWaveformProps {
  channelId: string;
  sourceChannelId: string;
  isSelected: boolean;
  realPeaks?: number[];
  isLoading?: boolean;
}

export const ChannelWaveform: React.FC<ChannelWaveformProps> = ({
  channelId,
  sourceChannelId,
  isSelected,
  realPeaks,
  isLoading
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Suporte a monitores de alta densidade (retina / 4K)
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 280;
    const height = rect.height > 0 ? rect.height : 20;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const midY = height / 2;
    ctx.clearRect(0, 0, width, height);

    if (!isSelected) {
      // Linha tracejada de silêncio para canal mutado / excluído
      ctx.beginPath();
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    // Linha de centro discreta
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Gradiente broadcast ciano-azul
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#38BDF8'); // Sky blue
    gradient.addColorStop(0.5, '#60A5FA'); // Light blue
    gradient.addColorStop(1, '#2563EB'); // Royal blue

    // 1. SE TEMOS OS PICOS REAIS DO FFMPEG: Desenha a forma de onda 100% física e real
    if (realPeaks && realPeaks.length > 0) {
      const barCount = realPeaks.length;
      const step = width / barCount;
      const barWidth = Math.max(1.2, step - 0.8);

      ctx.fillStyle = gradient;

      for (let i = 0; i < barCount; i++) {
        const x = i * step;
        const amp = realPeaks[i]; // Amplitude física real extraída do áudio (0.0 a 1.0)
        const barHeight = Math.max(1.5, amp * (height * 0.88));
        const y = midY - barHeight / 2;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
      return;
    }

    // 2. FALLBACK PROCEDURAL (enquanto os picos reais carregam ou em modo offline)
    let seed = 17;
    for (let i = 0; i < sourceChannelId.length; i++) {
      seed = (seed * 31 + sourceChannelId.charCodeAt(i)) & 0xffffff;
    }

    const step = 3;
    const barCount = Math.floor(width / step);
    ctx.fillStyle = gradient;

    for (let i = 0; i < barCount; i++) {
      const x = i * step;
      const t = (i + (seed % 100)) * 0.18;
      const envelope = Math.sin(t * 0.45) * Math.cos(t * 0.85) + Math.sin(t * 1.4) * 0.4;
      const pseudoNoise = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;

      let amp = Math.abs(envelope * 0.65 + pseudoNoise * 0.35);
      if (Math.sin(t * 0.28) < -0.32) {
        amp *= 0.12;
      }

      const barHeight = Math.max(2, amp * (height * 0.82));
      const y = midY - barHeight / 2;
      ctx.fillRect(x, y, 1.8, barHeight);
    }
  }, [channelId, sourceChannelId, isSelected, realPeaks]);

  return (
    <div className="w-full h-full relative flex items-center">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
      {!isSelected && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-gray-500 pointer-events-none select-none tracking-widest uppercase">
          Silêncio &bull; Canal Mudo
        </span>
      )}
      {isSelected && isLoading && (
        <span className="absolute right-2 text-[7px] font-mono text-blue-400/80 pointer-events-none select-none animate-pulse">
          LENDO ONDA REAL...
        </span>
      )}
      {isSelected && realPeaks && realPeaks.length > 0 && (
        <span className="absolute right-1.5 bottom-0.5 text-[6px] font-mono text-emerald-400/70 pointer-events-none select-none tracking-widest uppercase">
          ONDA REAL
        </span>
      )}
    </div>
  );
};
