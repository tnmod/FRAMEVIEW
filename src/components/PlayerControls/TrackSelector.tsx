import React, { useState, useRef, useEffect } from 'react';
import { Headphones, Subtitles, Check, Plus, Layers, VolumeX } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useMpvPlayer } from '../../hooks/useMpvPlayer';
import { useFileHandler } from '../../hooks/useFileHandler';

export const TrackSelector: React.FC = () => {
  const audioTracks = usePlayerStore((s) => s.audioTracks);
  const subtitleTracks = usePlayerStore((s) => s.subtitleTracks);
  const selectedAudioTracks = usePlayerStore((s) => s.selectedAudioTracks);
  const selectedSubtitleTrack = usePlayerStore((s) => s.selectedSubtitleTrack);

  const { selectAudioTrack, toggleAudioTrack, setAudioTracksPlayback, selectSubtitleTrack } = useMpvPlayer();
  const { openSubtitleDialog } = useFileHandler();

  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const [isSubOpen, setIsSubOpen] = useState(false);

  const audioRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (audioRef.current && !audioRef.current.contains(e.target as Node)) {
        setIsAudioOpen(false);
      }
      if (subRef.current && !subRef.current.contains(e.target as Node)) {
        setIsSubOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasMultipleActiveAudio = selectedAudioTracks.length > 1;

  return (
    <div className="flex items-center space-x-1">
      {/* Audio Track Selector */}
      {audioTracks.length > 0 && (
        <div ref={audioRef} className="relative">
          <button
            onClick={() => {
              setIsAudioOpen(!isAudioOpen);
              setIsSubOpen(false);
            }}
            title={
              hasMultipleActiveAudio
                ? `Audio Tracks (${selectedAudioTracks.length} tracks playing together)`
                : 'Audio Tracks'
            }
            className={`p-1.5 rounded-lg transition-colors flex items-center space-x-1 ${
              isAudioOpen
                ? 'bg-blue-500/20 text-blue-400'
                : hasMultipleActiveAudio
                ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
                : 'hover:bg-white/10 text-zinc-300 hover:text-white'
            }`}
          >
            <Headphones className="w-4 h-4" />
            {hasMultipleActiveAudio && (
              <span className="text-[10px] font-bold px-1 py-0.2 bg-blue-500 text-white rounded-full leading-none">
                {selectedAudioTracks.length}
              </span>
            )}
          </button>

          {isAudioOpen && (
            <div className="absolute bottom-full mb-2 right-0 w-72 py-1.5 rounded-xl bg-[#161920]/95 backdrop-blur-md border border-white/10 shadow-2xl z-50 flex flex-col animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center space-x-1.5">
                    <Layers className="w-3 h-3 text-blue-400" />
                    <span>Audio Streams ({audioTracks.length})</span>
                  </div>
                  <div className="text-[9px] text-zinc-500">
                    Chọn nhiều track để phát cùng lúc (mix)
                  </div>
                </div>
                {selectedAudioTracks.length > 0 && (
                  <button
                    onClick={() => setAudioTracksPlayback([])}
                    title="Mute all audio tracks"
                    className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto py-1">
                {audioTracks.map((track) => {
                  const isSelected = selectedAudioTracks.includes(track.id);
                  return (
                    <div
                      key={track.id}
                      className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between group ${
                        isSelected
                          ? 'bg-blue-600/20 text-blue-300 font-medium'
                          : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <button
                        onClick={() => toggleAudioTrack(track.id)}
                        className="flex items-center space-x-2.5 flex-1 min-w-0 text-left cursor-pointer"
                        title="Click to toggle in mix"
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-white/30 group-hover:border-white/60 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <div className="flex flex-col truncate pr-2">
                          <span className="truncate">{track.title || `Track ${track.id}`}</span>
                          <span className="text-[10px] text-zinc-500 uppercase">
                            {track.lang || 'und'} • {track.codec || 'audio'}{' '}
                            {track.channels ? `• ${track.channels}ch` : ''}
                          </span>
                        </div>
                      </button>

                      <button
                        onClick={() => selectAudioTrack(track.id)}
                        title="Solo (Play only this track)"
                        className="text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-zinc-400 hover:text-white transition-all shrink-0 cursor-pointer"
                      >
                        Solo
                      </button>
                    </div>
                  );
                })}
              </div>

              {audioTracks.length > 1 && (
                <div className="px-3 pt-1.5 pb-0.5 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>{selectedAudioTracks.length} track(s) đang phát</span>
                  <button
                    onClick={() => setAudioTracksPlayback(audioTracks.map((t) => t.id))}
                    className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    Phát tất cả
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Subtitle Track Selector */}
      <div ref={subRef} className="relative">
        <button
          onClick={() => {
            setIsSubOpen(!isSubOpen);
            setIsAudioOpen(false);
          }}
          title="Subtitle Tracks"
          className={`p-1.5 rounded-lg transition-colors ${
            isSubOpen
              ? 'bg-blue-500/20 text-blue-400'
              : selectedSubtitleTrack !== null
              ? 'text-blue-400 hover:bg-white/10'
              : 'hover:bg-white/10 text-zinc-300 hover:text-white'
          }`}
        >
          <Subtitles className="w-4 h-4" />
        </button>

        {isSubOpen && (
          <div className="absolute bottom-full mb-2 right-0 w-60 py-1 rounded-xl bg-[#161920]/95 backdrop-blur-md border border-white/10 shadow-xl z-50 flex flex-col">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 border-b border-white/5">
              Subtitles ({subtitleTracks.length})
            </div>
            <div className="max-h-48 overflow-y-auto">
              {/* Off Option */}
              <button
                onClick={() => {
                  selectSubtitleTrack(null);
                  setIsSubOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                  selectedSubtitleTrack === null
                    ? 'bg-blue-600/25 text-blue-400 font-medium'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>Off (Disabled)</span>
                {selectedSubtitleTrack === null && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              </button>

              {subtitleTracks.map((track) => {
                const isSelected = selectedSubtitleTrack === track.id;
                return (
                  <button
                    key={track.id}
                    onClick={() => {
                      selectSubtitleTrack(track.id);
                      setIsSubOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600/25 text-blue-400 font-medium'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate">{track.title || `Subtitle ${track.id}`}</span>
                      <span className="text-[10px] text-zinc-500 uppercase">
                        {track.lang || 'und'} • {track.codec || 'sub'}
                      </span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Add external subtitle button */}
            <div className="p-1 border-t border-white/5 bg-black/20">
              <button
                onClick={() => {
                  setIsSubOpen(false);
                  openSubtitleDialog();
                }}
                className="w-full px-2 py-1.5 rounded-lg text-left text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors flex items-center space-x-1.5 font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Load External Subtitle...</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
