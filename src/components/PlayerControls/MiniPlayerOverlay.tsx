import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize2,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useMpvPlayer } from '../../hooks/useMpvPlayer';
import { formatTime } from '../../utils/formatters';
import { invoke } from '@tauri-apps/api/core';

export const MiniPlayerOverlay: React.FC = () => {
  const isPip = usePlayerStore((s) => s.isPip);
  const togglePip = usePlayerStore((s) => s.togglePip);
  const fileName = usePlayerStore((s) => s.fileName);
  const playbackState = usePlayerStore((s) => s.playbackState);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const isMuted = usePlayerStore((s) => s.isMuted);

  const { togglePlay, seek, toggleMute } = useMpvPlayer();
  const [isHovered, setIsHovered] = useState(false);

  if (!isPip) return null;

  const isPlaying = playbackState === 'playing';
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newTime = (clickX / rect.width) * duration;
    seek(newTime, false);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={togglePip}
      data-tauri-drag-region
      className="absolute inset-0 z-50 flex flex-col justify-between p-3 select-none transition-all duration-200 cursor-move"
    >
      {/* Top Header Bar */}
      <div
        className={`flex items-center justify-between transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span
          data-tauri-drag-region
          className="text-xs font-medium text-white/90 truncate max-w-[70%] drop-shadow-md"
        >
          {fileName}
        </span>

        <div className="flex items-center space-x-1 no-drag">
          <button
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            className="p-1.5 rounded-lg bg-black/40 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur-md transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={togglePip}
            title="Exit Mini Player (Restore Window)"
            className="p-1.5 rounded-lg bg-black/40 hover:bg-blue-600/80 text-white/80 hover:text-white backdrop-blur-md transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => invoke('close_window').catch(console.error)}
            title="Close FrameView"
            className="p-1.5 rounded-lg bg-black/40 hover:bg-rose-600/80 text-white/80 hover:text-white backdrop-blur-md transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Playback Controls */}
      <div
        className={`flex items-center justify-center space-x-4 transition-opacity duration-200 no-drag ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          onClick={() => seek(-5, true)}
          title="Seek -5s"
          className="p-2 rounded-full bg-black/40 hover:bg-black/70 text-white/90 hover:text-white backdrop-blur-md transition-transform active:scale-90 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
          className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 transition-transform active:scale-95 cursor-pointer"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        <button
          onClick={() => seek(5, true)}
          title="Seek +5s"
          className="p-2 rounded-full bg-black/40 hover:bg-black/70 text-white/90 hover:text-white backdrop-blur-md transition-transform active:scale-90 cursor-pointer"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Mini Scrub Bar & Time */}
      <div
        className={`space-y-1 transition-opacity duration-200 no-drag ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          onClick={handleBarClick}
          className="w-full h-2 rounded-full bg-white/20 hover:h-2.5 transition-all duration-150 cursor-pointer relative overflow-hidden"
        >
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-75"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-white/80 drop-shadow-md">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
