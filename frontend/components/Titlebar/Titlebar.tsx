import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  FolderOpen,
  FolderPlus,
  Info,
  Keyboard,
  Minus,
  Square,
  Copy,
  X,
  Film,
  ListVideo,
  Settings,
  Sparkles,
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAiStore } from '../../store/aiStore';
import { useFileHandler } from '../../hooks/useFileHandler';

export const Titlebar: React.FC = () => {
  const fileName = usePlayerStore((s) => s.fileName);
  const isMetadataOpen = usePlayerStore((s) => s.isMetadataOpen);
  const toggleMetadataOpen = usePlayerStore((s) => s.toggleMetadataOpen);
  const isPlaylistOpen = usePlayerStore((s) => s.isPlaylistOpen);
  const togglePlaylistOpen = usePlayerStore((s) => s.togglePlaylistOpen);
  const isAiCenterOpen = useAiStore((s) => s.isAiCenterOpen);
  const toggleAiCenterOpen = useAiStore((s) => s.toggleAiCenterOpen);
  const toggleShortcutsOpen = usePlayerStore((s) => s.toggleShortcutsOpen);
  const toggleSettingsOpen = useSettingsStore((s) => s.toggleSettingsOpen);
  const { openFileDialog, openFolderDialog } = useFileHandler();

  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    try {
      const appWindow = getCurrentWebviewWindow();
      appWindow.isMaximized().then(setIsMaximized).catch(() => {});
      appWindow.onResized(() => {
        appWindow.isMaximized().then(setIsMaximized).catch(() => {});
      }).then((fn) => {
        unlisten = fn;
      });
    } catch (err) {
      console.warn('Window listener error:', err);
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const appWindow = getCurrentWebviewWindow();
      await appWindow.minimize();
    } catch {
      await invoke('minimize_window').catch(console.error);
    }
  };

  const handleMaximizeToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const appWindow = getCurrentWebviewWindow();
      await appWindow.toggleMaximize();
      const isMax = await appWindow.isMaximized();
      setIsMaximized(isMax);
    } catch {
      const isMax = await invoke<boolean>('toggle_maximize_window').catch(() => false);
      setIsMaximized(isMax);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const appWindow = getCurrentWebviewWindow();
      await appWindow.close();
    } catch {
      await invoke('close_window').catch(console.error);
    }
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') || target?.closest('.no-drag')) {
      return;
    }
    if (e.button === 0) {
      try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.startDragging();
      } catch {
        await invoke('start_drag').catch(() => {});
      }
    }
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') || target?.closest('.no-drag')) {
      return;
    }
    await handleMaximizeToggle(e);
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className="h-9 w-full bg-[#0d0f12]/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between select-none z-50 relative drag-region"
    >
      {/* Left: App Brand & Quick Action Tools */}
      <div className="flex items-center space-x-2 pl-3 no-drag">
        {/* Brand */}
        <div className="flex items-center space-x-1.5 pr-2 border-r border-white/10 text-zinc-300">
          <Film className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold tracking-wide text-zinc-200">FrameView</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-0.5">
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={openFileDialog}
            title="Open Video Files (Ctrl+O)"
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>

          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={openFolderDialog}
            title="Open Video Folder"
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={togglePlaylistOpen}
            title="Toggle Queue (Q)"
            className={`p-1 rounded transition-colors cursor-pointer ${
              isPlaylistOpen
                ? 'bg-blue-500/20 text-blue-400'
                : 'hover:bg-white/10 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <ListVideo className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3 bg-white/10 mx-0.5" />

          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleMetadataOpen}
            title="Toggle Media Inspector (I)"
            className={`p-1 rounded transition-colors cursor-pointer ${
              isMetadataOpen
                ? 'bg-blue-500/20 text-blue-400'
                : 'hover:bg-white/10 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleAiCenterOpen}
            title="AI Video Intelligence & Chapters"
            className={`p-1 rounded transition-colors cursor-pointer ${
              isAiCenterOpen
                ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 text-blue-300 border border-blue-500/30 shadow-sm'
                : 'hover:bg-white/10 text-zinc-400 hover:text-blue-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>

          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleShortcutsOpen}
            title="Keyboard Shortcuts (?)"
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleSettingsOpen}
            title="Preferences (,)"
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center: File Name / Title */}
      <div
        data-tauri-drag-region
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-xs font-medium text-zinc-400 max-w-[45%] truncate text-center"
      >
        {fileName ? fileName : ''}
      </div>

      {/* Right: Default Windows Window Controls (Hide, Size, Close) */}
      <div className="flex items-center h-full no-drag">
        {/* Hide / Minimize */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleMinimize}
          title="Minimize"
          className="h-full w-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5 stroke-[1.5]" />
        </button>

        {/* Size / Maximize / Restore */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleMaximizeToggle}
          title={isMaximized ? 'Restore Down' : 'Maximize'}
          className="h-full w-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
        >
          {isMaximized ? (
            <Copy className="w-3.5 h-3.5 stroke-[1.5]" />
          ) : (
            <Square className="w-3 h-3 stroke-[1.5]" />
          )}
        </button>

        {/* Close */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleClose}
          title="Close"
          className="h-full w-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#e81123] active:bg-[#c4101f] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4 stroke-[1.5]" />
        </button>
      </div>
    </header>
  );
};
