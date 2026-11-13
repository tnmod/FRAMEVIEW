import React, { useState, useRef, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useMpvPlayer } from '../../hooks/useMpvPlayer';

const SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export const SpeedControl: React.FC = () => {
  const speed = usePlayerStore((s) => s.speed);
  const { changeSpeed } = useMpvPlayer();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Playback Speed ([ / ])"
        className="px-2 py-1 rounded-md hover:bg-white/10 text-xs font-mono font-medium text-zinc-300 hover:text-white transition-colors border border-transparent hover:border-white/10"
      >
        {speed.toFixed(2).replace(/\.00$/, '')}x
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-24 py-1 rounded-xl bg-[#161920]/95 backdrop-blur-md border border-white/10 shadow-xl z-50 flex flex-col">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 border-b border-white/5">
            Speed
          </div>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => {
                changeSpeed(s);
                setIsOpen(false);
              }}
              className={`px-3 py-1 text-left text-xs font-mono transition-colors flex items-center justify-between ${
                Math.abs(speed - s) < 0.01
                  ? 'bg-blue-600/30 text-blue-400 font-semibold'
                  : 'text-zinc-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{s.toFixed(2).replace(/\.00$/, '')}x</span>
              {s === 1.0 && <span className="text-[9px] text-zinc-500">Normal</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
