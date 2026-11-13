import React, { useState } from 'react';
import { Film, UploadCloud, FolderOpen, Settings } from 'lucide-react';
import { useFileHandler } from '../../hooks/useFileHandler';
import { useSettingsStore } from '../../store/settingsStore';

export const EmptyState: React.FC = () => {
  const { openFileDialog } = useFileHandler();
  const toggleSettingsOpen = useSettingsStore((s) => s.toggleSettingsOpen);
  const [isDragOver, setIsDragOver] = useState(false);

  const formats = ['MP4', 'MKV', 'MOV', 'WebM', 'AVI', 'TS', 'MTS'];

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      className={`h-full w-full flex flex-col items-center justify-center p-8 transition-all duration-200 select-none ${
        isDragOver ? 'bg-blue-950/20 border-2 border-dashed border-blue-500/50' : 'bg-transparent'
      }`}
    >
      <div className="max-w-md w-full flex flex-col items-center text-center">
        {/* Glow Icon */}
        <div className="relative mb-6 group cursor-pointer" onClick={openFileDialog}>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-25 group-hover:opacity-40 blur transition duration-300" />
          <div className="relative w-20 h-20 rounded-2xl bg-[#161920] border border-white/10 flex items-center justify-center shadow-2xl">
            {isDragOver ? (
              <UploadCloud className="w-10 h-10 text-blue-400 animate-bounce" />
            ) : (
              <Film className="w-10 h-10 text-zinc-300 group-hover:text-blue-400 transition-colors" />
            )}
          </div>
        </div>

        {/* Text */}
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          {isDragOver ? 'Drop Video File Here' : 'Open a Video to Start'}
        </h2>
        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          High-performance playback powered by libmpv and deep media inspection via FFprobe
        </p>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 mb-8">
          <button
            onClick={openFileDialog}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-medium shadow-lg shadow-blue-500/20 transition-all duration-150 active:scale-95 cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Browse Video File</span>
          </button>

          <button
            onClick={toggleSettingsOpen}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-zinc-300 hover:text-white text-xs font-medium border border-white/5 transition-all duration-150 active:scale-95 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-zinc-400" />
            <span>Preferences & Settings</span>
          </button>
        </div>

        {/* Formats badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 opacity-60">
          {formats.map((fmt) => (
            <span
              key={fmt}
              className="px-2 py-0.5 text-[10px] font-mono tracking-wider text-zinc-400 bg-white/5 border border-white/5 rounded"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
