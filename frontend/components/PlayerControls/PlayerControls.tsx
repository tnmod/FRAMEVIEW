import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Info,
  Camera,
  ListVideo,
  PictureInPicture2,
  Sparkles,
  Settings,
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAiStore } from '../../store/aiStore';
import { useMpvPlayer } from '../../hooks/useMpvPlayer';
import { useFileHandler } from '../../hooks/useFileHandler';
import { Timeline } from './Timeline';
import { VolumeControl } from './VolumeControl';
import { SpeedControl } from './SpeedControl';
import { TrackSelector } from './TrackSelector';

export const PlayerControls: React.FC = () => {
  const playbackState = usePlayerStore((s) => s.playbackState);
  const filePath = usePlayerStore((s) => s.filePath);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen);
  const togglePip = usePlayerStore((s) => s.togglePip);
  const isMetadataOpen = usePlayerStore((s) => s.isMetadataOpen);
  const toggleMetadataOpen = usePlayerStore((s) => s.toggleMetadataOpen);
  const isPlaylistOpen = usePlayerStore((s) => s.isPlaylistOpen);
  const togglePlaylistOpen = usePlayerStore((s) => s.togglePlaylistOpen);
  const toggleSettingsOpen = useSettingsStore((s) => s.toggleSettingsOpen);

  const isAiCenterOpen = useAiStore((s) => s.isAiCenterOpen);
  const toggleAiCenterOpen = useAiStore((s) => s.toggleAiCenterOpen);

  const { togglePlay, frameStep, captureScreenshot } = useMpvPlayer();
  const { nextFile, prevFile } = useFileHandler();

  const [isVisible, setIsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPlaying = playbackState === 'playing';

  // Auto-hide controls after 2.5s of mouse inactivity while playing, and hide cursor in fullscreen
  useEffect(() => {
    const resetTimer = () => {
      setIsVisible(true);
      document.documentElement.classList.remove('hide-player-cursor');
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (isPlaying) {
        hideTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          if (usePlayerStore.getState().isFullscreen) {
            document.documentElement.classList.add('hide-player-cursor');
          }
        }, 2500);
      }
    };

    window.addEventListener('mousemove', resetTimer);
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      document.documentElement.classList.remove('hide-player-cursor');
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, isFullscreen]);

  // Clean up cursor when exiting fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      document.documentElement.classList.remove('hide-player-cursor');
    }
  }, [isFullscreen]);

  if (!filePath) return null;

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 z-40 select-none ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <div className="max-w-4xl mx-auto rounded-2xl bg-[#0d0f12]/85 backdrop-blur-xl border border-white/10 p-3 shadow-2xl flex flex-col space-y-2">
        {/* Timeline Scrub Bar */}
        <Timeline />

        {/* Controls Row */}
        <div className="flex items-center justify-between pt-1">
          {/* Left Controls: Volume & Speed */}
          <div className="flex items-center space-x-3">
            <VolumeControl />
            <div className="w-[1px] h-4 bg-white/10" />
            <SpeedControl />
          </div>

          {/* Center Controls: Navigation & Playback */}
          <div className="flex items-center space-x-2">
            {/* Prev Video File */}
            <button
              onClick={prevFile}
              title="Previous Video in Folder (P)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Frame Step Back (when paused) */}
            <button
              onClick={() => frameStep(false)}
              title="Frame Step Back (,)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Main Play / Pause Button */}
            <button
              onClick={togglePlay}
              title="Play / Pause (Space)"
              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 transition-all duration-150 active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Frame Step Forward (when paused) */}
            <button
              onClick={() => frameStep(true)}
              title="Frame Step Forward (.)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Next Video File */}
            <button
              onClick={nextFile}
              title="Next Video in Folder (N)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Right Controls: Tracks, Camera, Playlist, Inspector, AI, Fullscreen */}
          <div className="flex items-center space-x-1.5">
            <TrackSelector />

            <button
              onClick={captureScreenshot}
              title="Capture Frame (S)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlaylistOpen}
              title="Toggle Queue (Q)"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isPlaylistOpen
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'hover:bg-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <ListVideo className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-4 bg-white/10 mx-1" />

            <button
              onClick={toggleMetadataOpen}
              title="Media Inspector (I)"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isMetadataOpen
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'hover:bg-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              onClick={toggleAiCenterOpen}
              title="AI Video Intelligence & Chapters (A)"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isAiCenterOpen
                  ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 text-blue-300 border border-blue-500/30 shadow-sm'
                  : 'hover:bg-white/10 text-zinc-400 hover:text-blue-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </button>

            <button
              onClick={toggleSettingsOpen}
              title="Preferences & Settings (Ctrl+,)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={togglePip}
              title="Mini Player / Picture-in-Picture (Alt+P)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title="Toggle Fullscreen (F)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
