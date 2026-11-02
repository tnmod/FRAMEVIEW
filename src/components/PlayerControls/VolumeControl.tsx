import React from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useMpvPlayer } from '../../hooks/useMpvPlayer';

export const VolumeControl: React.FC = () => {
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const { changeVolume, toggleMute } = useMpvPlayer();

  const effectiveVolume = isMuted ? 0 : volume;

  const renderIcon = () => {
    if (isMuted || volume === 0) {
      return <VolumeX className="w-4 h-4 text-red-400" />;
    }
    if (volume < 50) {
      return <Volume1 className="w-4 h-4 text-zinc-300" />;
    }
    return <Volume2 className="w-4 h-4 text-zinc-300" />;
  };

  return (
    <div className="flex items-center space-x-2 group relative">
      <button
        onClick={toggleMute}
        title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
      >
        {renderIcon()}
      </button>

      <div className="w-16 flex items-center">
        <input
          type="range"
          min="0"
          max="100"
          value={effectiveVolume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      <span className="text-[10px] font-mono text-zinc-400 w-6">
        {Math.round(effectiveVolume)}%
      </span>
    </div>
  );
};
