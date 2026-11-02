import React, { useState, useRef, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useAiStore } from '../../store/aiStore';
import { useMpvPlayer } from '../../hooks/useMpvPlayer';
import { formatTime } from '../../utils/formatters';
import { TimelineThumbnail } from './TimelineThumbnail';

export const Timeline: React.FC = () => {
  const filePath = usePlayerStore((s) => s.filePath);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const { seek } = useMpvPlayer();

  const sessions = useAiStore((s) => s.sessions);
  const session = filePath ? sessions[filePath] : null;
  const scenes = session?.scenes || [];
  const chapters = session?.chapters || [];
  const cutMarkers = [...scenes]
    .filter((scene) => scene.timestamp > 0.01 && scene.timestamp < duration)
    .sort((left, right) => left.timestamp - right.timestamp)
    .filter((scene, index, list) => index === 0 || scene.timestamp - list[index - 1].timestamp > 0.01);
  const sceneBoundaries = [0, ...cutMarkers.map((scene) => scene.timestamp), duration];
  const sceneSegments = cutMarkers.length > 0
    ? sceneBoundaries.slice(0, -1).map((startTime, index) => ({
      startTime,
      endTime: sceneBoundaries[index + 1],
    }))
    : [];

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const calculateTimeFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!barRef.current || duration <= 0) return 0;
      const rect = barRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = clickX / rect.width;
      return percentage * duration;
    },
    [duration]
  );

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setHoverX(x);
    setHoverTime((x / rect.width) * duration);
  };

  const handleMouseLeave = () => {
    if (!isDragging) {
      setHoverTime(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (duration <= 0) return;
    setIsDragging(true);
    const newTime = calculateTimeFromEvent(e);
    seek(newTime, false);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const draggedTime = calculateTimeFromEvent(moveEvent);
      seek(draggedTime, false);
      if (barRef.current) {
        const rect = barRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(moveEvent.clientX - rect.left, rect.width));
        setHoverX(x);
        setHoverTime(draggedTime);
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
      setHoverTime(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full flex items-center space-x-3 select-none">
      {/* Current Time */}
      <span className="text-[11px] font-mono text-zinc-400 w-12 text-right">
        {formatTime(currentTime)}
      </span>

      {/* Progress Track */}
      <div
        ref={barRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        className="relative flex-1 h-5 flex items-center cursor-pointer group"
      >
        {/* Scene timeline. Each AI-confirmed boundary splits the bar into a visible segment. */}
        <div
          className="relative h-2 w-full overflow-hidden rounded-full bg-white/20 transition-all duration-150 group-hover:h-3"
          aria-label={sceneSegments.length > 0 ? `${sceneSegments.length} AI-detected scene segments` : 'Video timeline'}
        >
          {sceneSegments.length > 0 && (
            <div className="absolute inset-0 flex" aria-hidden="true">
              {sceneSegments.map((segment, index) => (
                <div
                  key={`${segment.startTime}-${segment.endTime}`}
                  className={`h-full ${index % 2 === 0 ? 'bg-emerald-400/25' : 'bg-cyan-400/20'} ${index > 0 ? 'border-l-2 border-[#0d0f12]' : ''}`}
                  style={{ width: `${((segment.endTime - segment.startTime) / duration) * 100}%` }}
                />
              ))}
            </div>
          )}

          {/* Played Progress Bar */}
          <div
            className="relative z-[1] h-full rounded-full bg-blue-500/85 transition-all duration-75"
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>

        {/* Chapter Boundary Divider Notches (G3.6, UI-07) */}
        {duration > 0 &&
          chapters.map((chap) => {
            if (chap.startTime <= 0) return null;
            const leftPct = (chap.startTime / duration) * 100;
            return (
              <div
                key={`notch_${chap.id}`}
                title={chap.title}
                className="absolute w-[2px] h-2 bg-[#0d0f12] -translate-x-1/2 z-10 pointer-events-none"
                style={{ left: `${leftPct}%` }}
              />
            );
          })}

        {/* AI-confirmed cut markers */}
        {duration > 0 &&
          cutMarkers.map((scene) => {
            const leftPct = (scene.timestamp / duration) * 100;
            return (
              <button
                key={`scene_${scene.id}`}
                type="button"
                aria-label={`Jump to AI-confirmed cut at ${formatTime(scene.timestamp)}`}
                title={`AI-confirmed cut at ${formatTime(scene.timestamp)} — click to jump`}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => void seek(scene.timestamp, false)}
                className="absolute z-10 h-3 w-[3px] -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.8)] transition-all hover:h-4 hover:bg-emerald-200 focus-visible:h-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                style={{ left: `${leftPct}%` }}
              />
            );
          })}

        {/* Scrubber Knob */}
        <div
          className="absolute w-3 h-3 rounded-full bg-white shadow-md shadow-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none -translate-x-1/2 z-20"
          style={{ left: `${Math.min(100, Math.max(0, percentage))}%` }}
        />

        {/* Hover Thumbnail Preview Popover */}
        <TimelineThumbnail
          hoverTime={hoverTime}
          hoverX={hoverX}
          barWidth={barRef.current?.getBoundingClientRect().width || 500}
        />
      </div>

      {/* Total Duration */}
      <span className="text-[11px] font-mono text-zinc-500 w-12 text-left">
        {formatTime(duration)}
      </span>
    </div>
  );
};

