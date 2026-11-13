import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';

export const ShortcutsModal: React.FC = () => {
  const isShortcutsOpen = usePlayerStore((s) => s.isShortcutsOpen);
  const setIsShortcutsOpen = usePlayerStore((s) => s.setIsShortcutsOpen);

  if (!isShortcutsOpen) return null;

  const categories = [
    {
      name: 'Playback & Seeking',
      items: [
        { key: 'Space', desc: 'Toggle Play / Pause' },
        { key: '← / →', desc: 'Seek 5 seconds back / forward' },
        { key: 'Shift + ← / →', desc: 'Seek 1 second (fine scrub)' },
        { key: 'J / L', desc: 'Jump 10 seconds back / forward' },
        { key: 'Page Up / Down', desc: 'Jump to Previous / Next Chapter' },
        { key: ', / .', desc: 'Frame step backward / forward (paused)' },
      ],
    },
    {
      name: 'Queue & Frame Capture',
      items: [
        { key: 'S', desc: 'Capture screenshot / frame' },
        { key: 'Q', desc: 'Toggle Queue / Playlist panel' },
        { key: 'Ctrl + O', desc: 'Open video file(s)' },
        { key: 'N / P', desc: 'Next / Previous video in queue' },
      ],
    },
    {
      name: 'Audio & Speed',
      items: [
        { key: '↑ / ↓', desc: 'Increase / Decrease volume by 5%' },
        { key: 'M', desc: 'Toggle Mute' },
        { key: '[ / ]', desc: 'Decrease / Increase speed by 0.25x' },
        { key: 'Backspace', desc: 'Reset speed to 1.0x' },
      ],
    },
    {
      name: 'View & Preferences',
      items: [
        { key: 'F', desc: 'Toggle Fullscreen' },
        { key: 'A', desc: 'Toggle AI Intelligence & Chapters panel' },
        { key: 'Alt + P', desc: 'Toggle Mini Player (Picture-in-Picture)' },
        { key: 'I', desc: 'Toggle Media Inspector panel' },
        { key: 'Ctrl + ,', desc: 'Open Preferences / Settings' },
        { key: '?', desc: 'Show this shortcuts guide' },
        { key: 'Esc', desc: 'Close dialog or exit fullscreen / mini player' },
      ],
    },
  ];

  return (
    <div
      onClick={() => setIsShortcutsOpen(false)}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-[#14171d] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="h-12 px-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-zinc-100">
            <Keyboard className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={() => setIsShortcutsOpen(false)}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat.name} className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 font-mono">
                {cat.name}
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {cat.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/5 border border-white/5 text-xs"
                  >
                    <span className="text-zinc-300">{item.desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 font-mono text-[11px] shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
