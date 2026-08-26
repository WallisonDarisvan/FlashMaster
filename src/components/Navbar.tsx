import React from 'react';

export const Navbar: React.FC = () => {
  return (
    <header className="h-11 sm:h-12 bg-[#1A1C1E] border-b border-[#333] shrink-0 flex items-center justify-between px-4">
      {/* Left: Engine Brand & Version */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center shadow-md shadow-blue-600/30">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-white flex items-center">
              MXF Master Engine
              <span className="text-[10px] font-mono font-semibold text-blue-400 ml-2 hidden md:inline px-2 py-0.5 bg-[#0F1112] rounded border border-blue-900/40">
                Flash Master
              </span>
            </h1>
          </div>
          <p className="text-[10px] text-gray-400 hidden xl:block">
            Mapeamento de Canais &bull; Ganho +7dB &bull; Hard Limiter -12dB True Peak
          </p>
        </div>
      </div>

    </header>
  );
};

