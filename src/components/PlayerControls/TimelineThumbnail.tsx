import React from 'react';
import { formatTime } from '../../utils/formatters';
import { useTimelineThumbnail } from '../../hooks/useTimelineThumbnail';
import { usePlayerStore } from '../../store/playerStore';
import { useAiStore } from '../../store/aiStore';
import { Film } from 'lucide-react';

interface TimelineThumbnailProps {
  hoverTime: number | null;
  hoverX: number;
  barWidth: number;
}

export const TimelineThumbnail: React.FC<TimelineThumbnailProps> = ({
  hoverTime,
  hoverX,
  barWidth,
}) => {
  const filePath = usePlayerStore((s) => s.filePath);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  const sessions = useAiStore((s) => s.sessions);
  const session = filePath ? sessions[filePath] : null;
  const chapters = session?.chapters || [];

  const { thumbnailUrl, isLoading, isUnsupported } = useTimelineThumbnail(
    filePath,
    hoverTime
  );

  const activeChapter = hoverTime !== null
    ? chapters.find(
        (c, idx) =>
          hoverTime >= c.startTime &&
          (idx === chapters.length - 1 || hoverTime < c.endTime)
      )
    : null;

  if (hoverTime === null || duration <= 0) return null;

  // Calculate clamped left position (card width = 160px)
  const cardWidth = 160;
  const halfCard = cardWidth / 2;
  const clampedX = Math.max(halfCard, Math.min(hoverX, barWidth - halfCard));

  // Time delta relative to current playback position
  const deltaSeconds = hoverTime - currentTime;
  const sign = deltaSeconds >= 0 ? '+' : '-';
  const deltaStr = `${sign}${formatTime(Math.abs(deltaSeconds))}`;
  const percentStr = `${((hoverTime / duration) * 100).toFixed(0)}%`;

  return (
    <div
      className="absolute bottom-8 -translate-x-1/2 pointer-events-none select-none z-50 flex flex-col items-center animate-in fade-in zoom-in-95 duration-150"
      style={{ left: `${clampedX}px` }}
    >
      <div className="w-40 rounded-xl bg-[#14171e]/95 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden flex flex-col">
        {/* Frame image or preview backdrop */}
        {!isUnsupported && (
          <div className="w-full h-[90px] bg-black/60 relative overflow-hidden flex items-center justify-center">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="Frame Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-500 space-y-1">
                <Film className={`w-5 h-5 ${isLoading ? 'animate-pulse text-blue-400' : 'text-zinc-600'}`} />
                <span className="text-[9px] font-mono text-zinc-400">
                  {isLoading ? 'Seeking frame...' : 'Preview'}
                </span>
              </div>
            )}

            {/* Time Delta badge inside frame */}
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-mono text-blue-400 border border-white/10">
              {deltaStr}
            </div>

            {/* Percent badge */}
            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-mono text-zinc-300 border border-white/10">
              {percentStr}
            </div>
          </div>
        )}

        {/* Timestamp Footer Bar */}
        <div className="py-1 px-2.5 bg-black/40 flex items-center justify-between border-t border-white/5">
          <span className="text-xs font-mono font-semibold text-white tracking-wider">
            {formatTime(hoverTime)}
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            / {formatTime(duration)}
          </span>
        </div>

        {/* Smart Chapter Title at hover time */}
        {activeChapter && (
          <div className="px-2 py-0.5 bg-blue-950/40 text-[10px] font-medium text-blue-300 truncate border-t border-white/5 text-center">
            {activeChapter.title}
          </div>
        )}
      </div>

      {/* Downward pointer triangle */}
      <div className="w-2.5 h-2.5 bg-[#14171e] rotate-45 border-r border-b border-white/15 -mt-1.5 shadow-md" />
    </div>
  );
};
