import React, { useState, useEffect, useRef } from 'react';
import { Sliders, Volume2, Play, Square, ShieldCheck, Zap, Gauge, Check } from 'lucide-react';

export const AudioLimiterVisualizer: React.FC = () => {
  const [isPlayingTestTone, setIsPlayingTestTone] = useState(false);
  const [inputSignalLevel, setInputSignalLevel] = useState(-20); // dB
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const limiterNodeRef = useRef<DynamicsCompressorNode | null>(null);

  const boostedLevel = inputSignalLevel + 7;
  const outputLevel = Math.min(-12, boostedLevel);
  const wasLimited = boostedLevel > -12;
  const dbReduced = wasLimited ? (boostedLevel - -12).toFixed(1) : '0.0';

  const startTestAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);

      const inputGain = ctx.createGain();
      const gainVal = Math.pow(10, inputSignalLevel / 20);
      inputGain.gain.setValueAtTime(gainVal, ctx.currentTime);

      const boostGain = ctx.createGain();
      boostGain.gain.setValueAtTime(Math.pow(10, 7 / 20), ctx.currentTime);

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(-12, ctx.currentTime);
      limiter.knee.setValueAtTime(0, ctx.currentTime);
      limiter.ratio.setValueAtTime(20, ctx.currentTime);
      limiter.attack.setValueAtTime(0.005, ctx.currentTime);
      limiter.release.setValueAtTime(0.050, ctx.currentTime);

      osc.connect(inputGain);
      inputGain.connect(boostGain);
      boostGain.connect(limiter);
      limiter.connect(ctx.destination);

      osc.start();
      oscRef.current = osc;
      gainNodeRef.current = inputGain;
      limiterNodeRef.current = limiter;
      setIsPlayingTestTone(true);
    } catch (e) {
      console.error(e);
    }
  };

  const stopTestAudio = () => {
    if (oscRef.current) {
      oscRef.current.stop();
      oscRef.current.disconnect();
      oscRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsPlayingTestTone(false);
  };

  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      const gainVal = Math.pow(10, inputSignalLevel / 20);
      gainNodeRef.current.gain.setValueAtTime(gainVal, audioContextRef.current.currentTime);
    }
  }, [inputSignalLevel]);

  useEffect(() => {
    return () => {
      stopTestAudio();
    };
  }, []);

  return (
    <div className="bg-[#151719] border border-[#333] rounded-lg p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            Audio Processing Chain & Limiter (+7dB / -12dB)
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">
            Ganho linear de +7.0 dB seguido por limitador rígido True Peak em -12.0 dBFS sem clipping.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-blue-400 bg-blue-900/30 border border-blue-800 px-2.5 py-1 rounded">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> ZERO CLIPPING &bull; EBU R128 SAFE
        </span>
      </div>

      {/* Filter Pipeline Diagram */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Step 1: Input Gain */}
        <div className="bg-[#1A1C1E] border border-[#333] rounded-md p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 text-[11px] font-medium">Estágio 1: Ganho Linear</span>
            <span className="text-emerald-400 font-mono font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800 text-[10px]">
              +7.0 dB
            </span>
          </div>
          <div className="text-sm font-mono font-bold text-white">
            volume=7dB
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Aumenta a amplitude geral de todas as frequências para realçar diálogos e detalhes sonoros.
          </p>
        </div>

        {/* Step 2: Peak Limiter */}
        <div className="bg-blue-900/10 border border-blue-500/40 rounded-md p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-300 text-[11px] font-medium">Estágio 2: Hard Limiter</span>
            <span className="text-blue-400 font-mono font-bold bg-blue-900/40 px-1.5 py-0.5 rounded border border-blue-800 text-[10px]">
              -12.0 dB
            </span>
          </div>
          <div className="text-sm font-mono font-bold text-blue-300">
            alimiter=limit=-12dB
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Lookahead com ataque rápido (5ms) e release suave (50ms). Impede picos acima de -12 dB.
          </p>
        </div>

        {/* Step 3: Broadcast Container Compliance */}
        <div className="bg-[#1A1C1E] border border-[#333] rounded-md p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 text-[11px] font-medium">Estágio 3: Codificação MXF</span>
            <span className="text-purple-400 font-mono font-bold bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800 text-[10px]">
              24-bit PCM
            </span>
          </div>
          <div className="text-sm font-mono font-bold text-white">
            -c:a pcm_s24le -ar 48000
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Áudio sem perdas (uncompressed linear PCM a 48kHz), em total conformidade broadcast SMPTE.
          </p>
        </div>
      </div>

      {/* Interactive Signal Meter & Simulator */}
      <div className="bg-[#1A1C1E] border border-[#333] rounded-lg p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
              Simulador Interativo da Curva de Ganho & Limiter
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Ajuste o sinal original de entrada para testar o ganho e contenção em tempo real:
            </p>
          </div>

          <button
            type="button"
            onClick={isPlayingTestTone ? stopTestAudio : startTestAudio}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all shadow ${
              isPlayingTestTone
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isPlayingTestTone ? <Square className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white ml-0.5" />}
            {isPlayingTestTone ? 'PARAR TOM (440Hz)' : 'OUVIR TOM DE TESTE'}
          </button>
        </div>

        {/* Input Level Slider */}
        <div className="space-y-1.5 bg-[#151719] p-3 rounded border border-[#2A2D30]">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-400">Nível do Sinal Original de Entrada:</span>
            <span className="font-bold text-white">{inputSignalLevel} dBFS</span>
          </div>
          <input
            type="range"
            min="-36"
            max="-4"
            step="1"
            value={inputSignalLevel}
            onChange={(e) => setInputSignalLevel(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>-36 dB (Baixo)</span>
            <span>-24 dB (Diálogo)</span>
            <span>-18 dB (Música)</span>
            <span className="text-blue-400 font-bold">-12 dB (Teto)</span>
            <span>-4 dB (Pico)</span>
          </div>
        </div>

        {/* Comparative VU Meters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Input Meter */}
          <div className="bg-[#151719] p-2.5 rounded border border-[#2A2D30]">
            <div className="text-[10px] text-gray-400 font-mono flex justify-between">
              <span>Sinal Entrada</span>
              <span className="text-gray-200">{inputSignalLevel} dB</span>
            </div>
            <div className="mt-1.5 h-2 bg-[#0F1112] rounded-full overflow-hidden flex">
              <div
                className="h-full bg-gray-500 transition-all duration-150 rounded-full"
                style={{ width: `${Math.max(5, Math.min(100, (inputSignalLevel + 40) * 2.7))}%` }}
              />
            </div>
          </div>

          {/* After +7dB Boost */}
          <div className="bg-[#151719] p-2.5 rounded border border-[#2A2D30]">
            <div className="text-[10px] text-gray-400 font-mono flex justify-between">
              <span>Após Ganho (+7dB)</span>
              <span className="text-emerald-400 font-semibold">{boostedLevel} dB</span>
            </div>
            <div className="mt-1.5 h-2 bg-[#0F1112] rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-150 rounded-full"
                style={{ width: `${Math.max(5, Math.min(100, (boostedLevel + 40) * 2.7))}%` }}
              />
            </div>
          </div>

          {/* Final Output with Limiter */}
          <div className="bg-[#151719] p-2.5 rounded border border-blue-900/40">
            <div className="text-[10px] text-blue-300 font-mono flex justify-between">
              <span>Saída MXF (Teto -12dB)</span>
              <span className="text-blue-400 font-bold">{outputLevel} dB</span>
            </div>
            <div className="mt-1.5 h-2 bg-[#0F1112] rounded-full overflow-hidden flex relative">
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                style={{ left: `${(-12 + 40) * 2.7}%` }}
                title="Teto Limiter -12dB"
              />
              <div
                className={`h-full transition-all duration-150 rounded-full ${wasLimited ? 'bg-blue-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.max(5, Math.min(100, (outputLevel + 40) * 2.7))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Dynamic Status Feedback */}
        <div className="text-xs p-2.5 rounded bg-[#151719] border border-[#2A2D30] flex items-center justify-between font-mono">
          <span className="text-gray-400 text-[11px]">
            Limiter Status:{' '}
            {wasLimited ? (
              <strong className="text-amber-400">ATIVO (Atenuação de {dbReduced} dB aplicada)</strong>
            ) : (
              <strong className="text-emerald-400">LINEAR (Abaixo de -12 dB)</strong>
            )}
          </span>
          <span className="text-[10px] text-blue-400 font-semibold">PEAK MAX: &le; -12.0 dBFS</span>
        </div>
      </div>
    </div>
  );
};

