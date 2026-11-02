import React, { useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { Music2, Disc, Radio, Activity, Waves } from 'lucide-react';

type VisualizerMode = 'spectrum' | 'radial' | 'waves';

export const AudioVisualizer: React.FC = () => {
  const isAudioOnly = usePlayerStore((s) => s.isAudioOnly);
  const filePath = usePlayerStore((s) => s.filePath);
  const fileName = usePlayerStore((s) => s.fileName);
  const playbackState = usePlayerStore((s) => s.playbackState);
  const mediaInfo = usePlayerStore((s) => s.mediaInfo);
  const volume = usePlayerStore((s) => s.volume);
  const speed = usePlayerStore((s) => s.speed);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<VisualizerMode>('spectrum');

  const isPlaying = playbackState === 'playing';

  // Extract metadata tags
  const tags = mediaInfo?.format?.tags || {};
  const trackTitle = tags.title || tags.TITLE || fileName || 'Audio Track';
  const artist = tags.artist || tags.ARTIST || tags.album_artist || null;
  const album = tags.album || tags.ALBUM || null;

  // Audio stream info
  const audioStream = mediaInfo?.streams.find((s) => s.codec_type === 'audio');
  const codecName = audioStream?.codec_name?.toUpperCase() || fileName?.split('.').pop()?.toUpperCase() || 'AUDIO';
  const sampleRate = audioStream?.sample_rate ? `${(parseInt(audioStream.sample_rate, 10) / 1000).toFixed(1)} kHz` : null;
  const channels = audioStream?.channels === 2 ? 'Stereo' : audioStream?.channels === 1 ? 'Mono' : audioStream?.channels ? `${audioStream.channels}ch` : null;
  const bitRate = mediaInfo?.format?.bit_rate ? `${Math.round(parseInt(mediaInfo.format.bit_rate, 10) / 1000)} kbps` : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isAudioOnly) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;
    const barCount = 56;
    const peakHeights = new Array(barCount).fill(0);
    const prevHeights = new Array(barCount).fill(0);

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 500;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Phase progression
      if (isPlaying) {
        phase += 0.05 * speed;
      } else {
        phase += 0.008; // slow idle breath
      }

      const volMult = isPlaying ? Math.max(0.2, volume / 100) : 0.08;

      if (mode === 'spectrum') {
        const barWidth = Math.max(3, Math.min(10, (width * 0.7) / barCount - 4));
        const totalW = barCount * (barWidth + 4);
        const startX = (width - totalW) / 2;
        const baseY = height * 0.78;

        for (let i = 0; i < barCount; i++) {
          const normI = i / barCount;
          // Harmonic wave simulation
          const wave1 = Math.sin(phase * 1.5 + i * 0.28);
          const wave2 = Math.cos(phase * 2.2 - i * 0.18);
          const wave3 = Math.sin(phase * 0.7 + i * 0.08);
          const centerWeight = Math.sin(normI * Math.PI);

          let targetH = Math.abs(wave1 * 0.5 + wave2 * 0.35 + wave3 * 0.35) * centerWeight * 160 * volMult + 6;
          if (!isPlaying) targetH = (Math.sin(phase + i * 0.2) * 0.5 + 0.5) * 12 + 4;

          // Smooth interpolation
          prevHeights[i] += (targetH - prevHeights[i]) * 0.25;
          const currentH = prevHeights[i];

          // Peaks fall with gravity
          if (currentH > peakHeights[i]) {
            peakHeights[i] = currentH;
          } else {
            peakHeights[i] = Math.max(0, peakHeights[i] - 1.2);
          }

          const x = startX + i * (barWidth + 4);
          const y = baseY - currentH;

          // Vibrant neon gradient: Cyan -> Sky -> Indigo -> Magenta
          const gradient = ctx.createLinearGradient(x, baseY, x, y);
          gradient.addColorStop(0, '#06b6d4'); // cyan-500
          gradient.addColorStop(0.5, '#3b82f6'); // blue-500
          gradient.addColorStop(0.85, '#8b5cf6'); // violet-500
          gradient.addColorStop(1, '#ec4899'); // pink-500

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, currentH, [3, 3, 0, 0]);
          ctx.fill();

          // Peak cap
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 6;
          ctx.fillRect(x, baseY - peakHeights[i] - 2, barWidth, 2);
          ctx.shadowBlur = 0;

          // Subtle reflection below base
          ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
          ctx.fillRect(x, baseY + 2, barWidth, currentH * 0.25);
        }
      } else if (mode === 'radial') {
        const centerX = width / 2;
        const centerY = height * 0.45;
        const baseRadius = 88;
        const radialCount = 64;

        for (let i = 0; i < radialCount; i++) {
          const angle = (i / radialCount) * Math.PI * 2;
          const wave = Math.sin(phase * 2 + i * 0.4) * Math.cos(phase * 1.3 - i * 0.2);
          const barLen = Math.abs(wave) * 70 * volMult + (isPlaying ? 8 : 4);

          const x1 = centerX + Math.cos(angle) * baseRadius;
          const y1 = centerY + Math.sin(angle) * baseRadius;
          const x2 = centerX + Math.cos(angle) * (baseRadius + barLen);
          const y2 = centerY + Math.sin(angle) * (baseRadius + barLen);

          ctx.strokeStyle = `hsl(${(i / radialCount) * 120 + 190}, 90%, 65%)`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      } else if (mode === 'waves') {
        // Multi-layered oscilloscope waves
        const baseY = height * 0.68;
        const waveLayers = [
          { freq: 0.015, speed: 2.0, amp: 45, color: 'rgba(56, 189, 248, 0.7)' },
          { freq: 0.022, speed: -1.7, amp: 35, color: 'rgba(168, 85, 247, 0.6)' },
          { freq: 0.009, speed: 1.2, amp: 55, color: 'rgba(236, 72, 153, 0.5)' },
        ];

        waveLayers.forEach((layer) => {
          ctx.strokeStyle = layer.color;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = layer.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();

          for (let x = 0; x <= width; x += 4) {
            const y = baseY + Math.sin(x * layer.freq + phase * layer.speed) * layer.amp * volMult;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [isAudioOnly, isPlaying, mode, volume, speed]);

  if (!isAudioOnly || !filePath) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between p-6 select-none overflow-hidden bg-gradient-to-b from-[#0b0e14] via-[#090b10] to-[#06070a]">
      {/* Ambient background glow aura */}
      <div
        className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[130px] pointer-events-none transition-all duration-700 ${
          isPlaying
            ? 'bg-gradient-to-tr from-blue-600/25 via-cyan-500/20 to-purple-600/25 scale-100 opacity-90'
            : 'bg-blue-600/10 scale-75 opacity-40'
        }`}
      />

      {/* Top Bar: Visualizer Mode Selector */}
      <div className="w-full flex items-center justify-between z-10 pt-4 px-2">
        <div className="flex items-center space-x-2 text-zinc-400">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
            Audio Studio
          </span>
        </div>

        {/* Mode Toggle Pills */}
        <div className="flex items-center space-x-1 p-1 rounded-xl bg-black/40 border border-white/5 backdrop-blur-md">
          <button
            onClick={() => setMode('spectrum')}
            title="Spectrum Bars"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mode === 'spectrum'
                ? 'bg-blue-600/25 text-blue-400 border border-blue-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Bars</span>
          </button>

          <button
            onClick={() => setMode('radial')}
            title="Radial Halo"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mode === 'radial'
                ? 'bg-blue-600/25 text-blue-400 border border-blue-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>Radial</span>
          </button>

          <button
            onClick={() => setMode('waves')}
            title="Oscilloscope Waves"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mode === 'waves'
                ? 'bg-blue-600/25 text-blue-400 border border-blue-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Wave</span>
          </button>
        </div>
      </div>

      {/* Centerpiece: Vinyl Disc Emblem & Track Info */}
      <div className="flex flex-col items-center justify-center space-y-4 z-10 my-auto">
        {/* Animated Disc Container */}
        <div className="relative group">
          <div
            className={`w-36 h-36 rounded-full border-2 border-white/10 shadow-2xl flex items-center justify-center bg-gradient-to-tr from-zinc-900 via-black to-zinc-800 relative transition-transform duration-500 ${
              isPlaying ? 'animate-[spin_12s_linear_infinite]' : ''
            }`}
          >
            {/* Vinyl grooved rings */}
            <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />
            <div className="absolute inset-5 rounded-full border border-white/5 pointer-events-none" />
            <div className="absolute inset-8 rounded-full border border-white/10 pointer-events-none" />

            {/* Inner Center Label */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Music2 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Track Title & Metadata */}
        <div className="flex flex-col items-center text-center space-y-1.5 max-w-lg px-4">
          <h2 className="text-lg font-bold text-white tracking-wide truncate max-w-full drop-shadow-md">
            {trackTitle}
          </h2>

          {(artist || album) && (
            <p className="text-xs text-zinc-400 font-medium truncate max-w-full">
              {artist && <span className="text-zinc-200">{artist}</span>}
              {artist && album && <span className="mx-1.5 text-zinc-600">•</span>}
              {album && <span className="text-zinc-400">{album}</span>}
            </p>
          )}

          {/* Audio Spec Badges */}
          <div className="flex items-center space-x-2 pt-1">
            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 font-mono text-[10px] font-semibold uppercase tracking-wider">
              {codecName}
            </span>
            {sampleRate && (
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 font-mono text-[10px]">
                {sampleRate}
              </span>
            )}
            {channels && (
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 font-mono text-[10px]">
                {channels}
              </span>
            )}
            {bitRate && (
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-mono text-[10px]">
                {bitRate}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Background/Foreground Spectrum Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />
    </div>
  );
};
