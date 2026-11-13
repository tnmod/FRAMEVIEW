import React from 'react';
import {
  ListVideo,
  X,
  Plus,
  FolderPlus,
  Trash2,
  Play,
  Volume2,
  Film,
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useMpvPlayer } from '../../hooks/useMpvPlayer';
import { useFileHandler } from '../../hooks/useFileHandler';
import { useSettingsStore } from '../../store/settingsStore';

export const PlaylistPanel: React.FC = () => {
  const playlist = usePlayerStore((s) => s.playlist);
  const currentPlaylistIndex = usePlayerStore((s) => s.currentPlaylistIndex);
  const isPlaylistOpen = usePlayerStore((s) => s.isPlaylistOpen);
  const setIsPlaylistOpen = usePlayerStore((s) => s.setIsPlaylistOpen);
  const removeFromPlaylist = usePlayerStore((s) => s.removeFromPlaylist);
  const clearPlaylist = usePlayerStore((s) => s.clearPlaylist);

  const autoPlayNext = useSettingsStore((s) => s.autoPlayNext);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const { playPlaylistItem } = useMpvPlayer();
  const { openFileDialog, openFolderDialog } = useFileHandler();

  if (!isPlaylistOpen) return null;

  return (
    <aside className="absolute top-0 right-0 w-80 max-w-[90vw] h-full bg-[#0d1015]/95 backdrop-blur-2xl border-l border-white/10 flex flex-col z-40 select-none shadow-2xl animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="h-12 px-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <ListVideo className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
            Queue
          </h3>
          <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono text-[10px] font-medium">
            {playlist.length}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={openFileDialog}
            title="Add Video Files"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openFolderDialog}
            title="Add Video Folder"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          {playlist.length > 0 && (
            <button
              onClick={clearPlaylist}
              title="Clear Queue"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsPlaylistOpen(false)}
            title="Close Panel"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Playlist Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {playlist.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
              <Film className="w-6 h-6 text-zinc-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400">Queue is empty</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Add files, folders, or drag & drop videos here
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={openFileDialog}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-lg shadow-blue-600/20"
              >
                Add Files
              </button>
              <button
                onClick={openFolderDialog}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
              >
                Add Folder
              </button>
            </div>
          </div>
        ) : (
          playlist.map((item, index) => {
            const isCurrent = index === currentPlaylistIndex;
            return (
              <div
                key={item.id}
                onClick={() => playPlaylistItem(index)}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                  isCurrent
                    ? 'bg-blue-600/20 border border-blue-500/30 text-blue-200'
                    : 'hover:bg-white/5 text-zinc-300 border border-transparent'
                }`}
              >
                {/* Index / Playing icon */}
                <div className="flex items-center space-x-2.5 truncate flex-1 pr-2">
                  <div className="w-5 text-center shrink-0">
                    {isCurrent ? (
                      <Volume2 className="w-3.5 h-3.5 text-blue-400 animate-pulse inline" />
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  <span
                    className={`truncate font-medium ${
                      isCurrent ? 'text-white' : 'text-zinc-300 group-hover:text-white'
                    }`}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>

                {/* Actions on hover */}
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playPlaylistItem(index);
                    }}
                    title="Play"
                    className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-blue-400 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromPlaylist(item.id);
                    }}
                    title="Remove from queue"
                    className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-rose-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Settings */}
      <div className="p-3 border-t border-white/5 bg-black/20 flex items-center justify-between text-xs text-zinc-400 shrink-0">
        <label className="flex items-center space-x-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoPlayNext}
            onChange={(e) => updateSettings({ autoPlayNext: e.target.checked })}
            className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0 w-3.5 h-3.5"
          />
          <span className="text-[11px] text-zinc-300">Auto-play next</span>
        </label>
        <span className="text-[10px] text-zinc-500">
          {playlist.length > 0 ? `${currentPlaylistIndex + 1} of ${playlist.length}` : ''}
        </span>
      </div>
    </aside>
  );
};
