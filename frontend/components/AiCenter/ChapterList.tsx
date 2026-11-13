import React, { useState } from 'react';
import {
  Play,
  Edit2,
  Trash2,
  Plus,
  Check,
  X,
  Bookmark,
  Sparkles,
  UserCheck,
  Film,
} from 'lucide-react';
import { useAiStore } from '../../store/aiStore';
import { usePlayerStore } from '../../store/playerStore';
import { useMpvPlayer } from '../../hooks/useMpvPlayer';
import { formatTime } from '../../utils/formatters';
import { SmartChapter } from '../../types/ai';

export const ChapterList: React.FC = () => {
  const filePath = usePlayerStore((s) => s.filePath);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const { seek } = useMpvPlayer();

  const sessions = useAiStore((s) => s.sessions);
  const updateChapter = useAiStore((s) => s.updateChapter);
  const deleteChapter = useAiStore((s) => s.deleteChapter);
  const addChapter = useAiStore((s) => s.addChapter);
  const runSmartChapters = useAiStore((s) => s.runSmartChapters);
  const currentTask = useAiStore((s) => s.currentTask);

  const session = filePath ? sessions[filePath] : null;
  const chapters = session?.chapters || [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStartTime, setEditStartTime] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const handleGenerateChapters = async () => {
    if (!filePath) return;
    setGenerationError(null);
    try {
      await runSmartChapters(filePath, duration);
    } catch (err: any) {
      setGenerationError(err?.message || 'Chapter generation failed.');
    }
  };

  const handleStartEdit = (chap: SmartChapter) => {
    setEditingId(chap.id);
    setEditTitle(chap.title);
    setEditStartTime(chap.startTime);
  };

  const handleSaveEdit = (chapId: string) => {
    if (!filePath) return;
    updateChapter(filePath, chapId, {
      title: editTitle.trim() || 'Untitled Chapter',
      startTime: Math.max(0, editStartTime),
    });
    setEditingId(null);
  };

  const handleAddNewAtCurrentTime = () => {
    if (!filePath) return;
    const startTime = Math.round(currentTime);
    const newChap: SmartChapter = {
      id: `custom_${Date.now()}`,
      startTime,
      endTime: Math.min(duration, startTime + 30),
      title: `Custom Chapter ${chapters.length + 1}`,
      isManualEdit: true,
    };
    addChapter(filePath, newChap);
    handleStartEdit(newChap);
  };

  if (!filePath) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-500 text-xs">
        <Film className="w-8 h-8 mb-2 opacity-30" />
        <span>Load a media file to view or generate chapters</span>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-400 space-y-3 p-4">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-blue-400">
          <Bookmark className="w-6 h-6 opacity-60" />
        </div>
        <div>
          <div className="text-xs font-semibold text-zinc-200">No chapters yet</div>
          <div className="text-[11px] text-zinc-500 mt-1 max-w-[240px]">
            Analyze the video with a vision model to create chapters from what is actually shown.
          </div>
        </div>

        <div className="flex space-x-2 pt-1">
          <button
            disabled={currentTask?.status === 'running'}
            onClick={handleGenerateChapters}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-md shadow-blue-600/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Now</span>
          </button>

          <button
            onClick={handleAddNewAtCurrentTime}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add at Current Time</span>
          </button>
        </div>
        {generationError && (
          <p className="text-[11px] text-rose-300 max-w-sm" role="alert">
            {generationError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-zinc-400">
          {chapters.length} chapter{chapters.length > 1 ? 's' : ''}
        </span>
        <button
          onClick={handleAddNewAtCurrentTime}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer text-[11px]"
        >
          <Plus className="w-3 h-3" />
          <span>Add at {formatTime(currentTime)}</span>
        </button>
      </div>

      {/* Chapters Cards */}
      <div className="space-y-2">
        {chapters.map((chap, idx) => {
          const isCurrent =
            currentTime >= chap.startTime &&
            (idx === chapters.length - 1 || currentTime < chap.endTime);
          const isEditing = editingId === chap.id;

          return (
            <div
              key={chap.id}
              className={`group p-3 rounded-2xl border transition-all ${
                isCurrent
                  ? 'bg-blue-600/15 border-blue-500/40 shadow-lg shadow-blue-900/10'
                  : 'bg-white/5 border-white/5 hover:border-white/15'
              }`}
            >
              {isEditing ? (
                /* Inline Edit Mode (G5.5, G5.6) */
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono text-zinc-400 w-12">Title:</span>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono text-zinc-400 w-12">Start:</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max={duration}
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-zinc-800 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                    <span className="text-[11px] font-mono text-zinc-500">
                      ({formatTime(editStartTime)})
                    </span>
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                    <button
                      onClick={() => handleSaveEdit(chap.id)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Card View */
                <div className="flex space-x-3">
                  {/* Thumbnail Preview */}
                  <div
                    onClick={() => seek(chap.startTime, false)}
                    className="w-20 h-14 rounded-xl bg-black/60 border border-white/10 overflow-hidden shrink-0 relative cursor-pointer group/thumb"
                  >
                    {chap.thumbnailDataUrl ? (
                      <img
                        src={chap.thumbnailDataUrl}
                        alt={chap.title}
                        className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <Film className="w-4 h-4" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-current" />
                    </div>
                  </div>

                  {/* Chapter Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 truncate pr-1">
                          <span className="text-[10px] font-mono text-blue-400 font-semibold shrink-0">
                            #{idx + 1}
                          </span>
                          <span
                            onClick={() => seek(chap.startTime, false)}
                            className="text-xs font-semibold text-zinc-100 hover:text-blue-300 transition-colors truncate cursor-pointer"
                            title={chap.title}
                          >
                            {chap.title}
                          </span>
                        </div>

                        {/* Badges (Auto vs Manual Edit) */}
                        <div className="shrink-0">
                          {chap.isManualEdit ? (
                            <span
                              title="Protected manual edit"
                              className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/20 flex items-center space-x-1"
                            >
                              <UserCheck className="w-2.5 h-2.5 inline mr-0.5" />
                              Custom
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/20 flex items-center space-x-1">
                              <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
                              AI
                            </span>
                          )}
                        </div>
                      </div>

                      {chap.summary && (
                        <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5 font-sans">
                          {chap.summary}
                        </p>
                      )}
                    </div>

                    {/* Footer: Time range and actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] font-mono text-zinc-500">
                      <span>
                        {formatTime(chap.startTime)} – {formatTime(chap.endTime)}
                      </span>

                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartEdit(chap)}
                          title="Edit Chapter"
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => deleteChapter(filePath, chap.id)}
                          title="Delete Chapter"
                          className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
