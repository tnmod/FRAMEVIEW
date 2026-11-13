import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Film,
  Volume2,
  Subtitles,
  FileText,
  Info,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { MetadataTab } from '../../types/player';
import { formatBytes, formatBitrate, formatFrameRate, formatTime } from '../../utils/formatters';

export const MetadataPanel: React.FC = () => {
  const isMetadataOpen = usePlayerStore((s) => s.isMetadataOpen);
  const setIsMetadataOpen = usePlayerStore((s) => s.setIsMetadataOpen);
  const mediaInfo = usePlayerStore((s) => s.mediaInfo);
  const isMetadataLoading = usePlayerStore((s) => s.isMetadataLoading);
  const metadataError = usePlayerStore((s) => s.metadataError);
  const activeTab = usePlayerStore((s) => s.metadataActiveTab);
  const setActiveTab = usePlayerStore((s) => s.setMetadataActiveTab);

  const [copied, setCopied] = useState(false);

  if (!isMetadataOpen) return null;

  const handleCopy = () => {
    if (!mediaInfo) return;
    navigator.clipboard.writeText(JSON.stringify(mediaInfo, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const videoStreams = mediaInfo?.streams.filter((s) => s.codec_type === 'video') || [];
  const audioStreams = mediaInfo?.streams.filter((s) => s.codec_type === 'audio') || [];
  const subtitleStreams = mediaInfo?.streams.filter((s) => s.codec_type === 'subtitle') || [];
  const format = mediaInfo?.format;
  const primaryVideo = videoStreams[0];
  const primaryAudio = audioStreams[0];

  const tabs: { id: MetadataTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'video', label: 'Video', icon: <Film className="w-3.5 h-3.5" />, count: videoStreams.length },
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-3.5 h-3.5" />, count: audioStreams.length },
    { id: 'subtitles', label: 'Subs', icon: <Subtitles className="w-3.5 h-3.5" />, count: subtitleStreams.length },
    { id: 'container', label: 'Container', icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside className="absolute top-0 right-0 w-96 max-w-[90vw] h-full bg-[#0d0f12]/95 backdrop-blur-2xl border-l border-white/10 flex flex-col z-40 select-none shadow-2xl animate-in slide-in-from-right-4 duration-200">
      {/* Panel Header */}
      <div className="h-12 border-b border-white/5 flex items-center justify-between px-4">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
            Media Inspector
          </h2>
        </div>

        <div className="flex items-center space-x-1">
          {mediaInfo && (
            <button
              onClick={handleCopy}
              title="Copy Full JSON Specs"
              className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex items-center space-x-1 text-[11px]"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-mono">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="font-mono">JSON</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setIsMetadataOpen(false)}
            title="Close Inspector (I)"
            className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/5 bg-black/20 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center space-x-1 ${
              activeTab === tab.id
                ? 'bg-blue-600/30 text-blue-300 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[9px] px-1 rounded-full bg-white/10 text-zinc-300">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isMetadataLoading && (
          <div className="space-y-3 animate-pulse pt-4">
            <div className="h-20 bg-white/5 rounded-xl border border-white/5" />
            <div className="h-32 bg-white/5 rounded-xl border border-white/5" />
            <div className="h-40 bg-white/5 rounded-xl border border-white/5" />
          </div>
        )}

        {metadataError && !isMetadataLoading && (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/20 text-red-200 text-xs space-y-2">
            <div className="flex items-center space-x-2 text-red-400 font-semibold">
              <AlertCircle className="w-4 h-4" />
              <span>Inspection Error</span>
            </div>
            <p className="text-zinc-400 font-mono text-[11px] break-words">{metadataError}</p>
          </div>
        )}

        {!isMetadataLoading && !metadataError && !mediaInfo && (
          <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-500">
            <Info className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No media file loaded</p>
          </div>
        )}

        {!isMetadataLoading && !metadataError && mediaInfo && (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Hero Badge */}
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-900/20 to-indigo-900/10 border border-blue-500/20 flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-blue-400">
                    Primary Stream
                  </span>
                  <div className="text-lg font-bold text-zinc-100 flex items-center space-x-2">
                    <span>
                      {primaryVideo?.width && primaryVideo?.height
                        ? `${primaryVideo.width} × ${primaryVideo.height}`
                        : 'Audio Only'}
                    </span>
                    {primaryVideo?.width && primaryVideo.width >= 3840 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                        4K UHD
                      </span>
                    )}
                    {primaryVideo?.width && primaryVideo.width >= 1920 && primaryVideo.width < 3840 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                        FHD
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-300 font-mono">
                    {primaryVideo?.codec_long_name || primaryVideo?.codec_name || '—'}
                  </span>
                </div>

                {/* Grid Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard
                    label="Duration"
                    value={format?.duration ? formatTime(parseFloat(format.duration)) : '—'}
                  />
                  <MetricCard
                    label="File Size"
                    value={formatBytes(format?.size)}
                  />
                  <MetricCard
                    label="Bitrate"
                    value={formatBitrate(format?.bit_rate)}
                  />
                  <MetricCard
                    label="Frame Rate"
                    value={formatFrameRate(primaryVideo?.r_frame_rate || primaryVideo?.avg_frame_rate)}
                  />
                  <MetricCard
                    label="Color Profile"
                    value={primaryVideo?.color_transfer || primaryVideo?.pix_fmt || '—'}
                  />
                  <MetricCard
                    label="Audio Channels"
                    value={primaryAudio?.channel_layout || `${primaryAudio?.channels || 0} ch`}
                  />
                </div>

                {/* Streams Summary */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                    Streams Breakdown
                  </div>
                  <div className="text-xs space-y-1 font-mono text-zinc-300">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Video</span>
                      <span>{videoStreams.length} stream(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Audio</span>
                      <span>{audioStreams.length} stream(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Subtitles</span>
                      <span>{subtitleStreams.length} stream(s)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIDEO TAB */}
            {activeTab === 'video' && (
              <div className="space-y-4">
                {videoStreams.map((v, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="text-xs font-semibold text-blue-400 font-mono">
                        Video Stream #{v.index}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase">
                        {v.codec_name}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <Row label="Codec" value={v.codec_long_name || v.codec_name} />
                      <Row label="Codec Tag" value={v.codec_tag_string} />
                      <Row label="Profile" value={v.profile} />
                      <Row label="Resolution" value={`${v.width} × ${v.height}`} />
                      <Row label="Aspect Ratio" value={v.display_aspect_ratio || v.sample_aspect_ratio} />
                      <Row label="Frame Rate" value={formatFrameRate(v.r_frame_rate || v.avg_frame_rate)} />
                      <Row label="Pixel Format" value={v.pix_fmt} />
                      <Row label="Color Space" value={v.color_space} />
                      <Row label="Color Primaries" value={v.color_primaries} />
                      <Row label="Color Transfer" value={v.color_transfer} />
                      <Row label="Color Range" value={v.color_range} />
                      <Row label="Bitrate" value={formatBitrate(v.bit_rate)} />
                      <Row label="Total Frames" value={v.nb_frames} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* AUDIO TAB */}
            {activeTab === 'audio' && (
              <div className="space-y-4">
                {audioStreams.map((a, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="text-xs font-semibold text-indigo-400 font-mono">
                        Audio Stream #{a.index}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase">
                        {a.codec_name}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <Row label="Codec" value={a.codec_long_name || a.codec_name} />
                      <Row label="Channels" value={`${a.channels} (${a.channel_layout || 'layout'})`} />
                      <Row label="Sample Rate" value={a.sample_rate ? `${parseInt(a.sample_rate).toLocaleString()} Hz` : undefined} />
                      <Row label="Bit Depth" value={a.bits_per_raw_sample || (a.bits_per_sample ? `${a.bits_per_sample}-bit` : undefined)} />
                      <Row label="Bitrate" value={formatBitrate(a.bit_rate)} />
                      <Row label="Language" value={a.tags?.language || a.tags?.LANGUAGE} />
                      <Row label="Title" value={a.tags?.title || a.tags?.TITLE} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SUBTITLES TAB */}
            {activeTab === 'subtitles' && (
              <div className="space-y-4">
                {subtitleStreams.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs">
                    No subtitle streams detected in this file
                  </div>
                ) : (
                  subtitleStreams.map((s, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="text-xs font-semibold text-purple-400 font-mono">
                          Subtitle #{s.index}
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase">
                          {s.codec_name}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <Row label="Codec" value={s.codec_long_name || s.codec_name} />
                        <Row label="Language" value={s.tags?.language || s.tags?.LANGUAGE} />
                        <Row label="Title" value={s.tags?.title || s.tags?.TITLE} />
                        <Row label="Default" value={s.disposition?.default === 1 ? 'Yes' : 'No'} />
                        <Row label="Forced" value={s.disposition?.forced === 1 ? 'Yes' : 'No'} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* CONTAINER TAB */}
            {activeTab === 'container' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider border-b border-white/5 pb-2">
                    Format & Container Details
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <Row label="Format Name" value={format?.format_name} />
                    <Row label="Long Name" value={format?.format_long_name} />
                    <Row label="Duration" value={format?.duration ? `${parseFloat(format.duration).toFixed(3)}s` : undefined} />
                    <Row label="Size" value={formatBytes(format?.size)} />
                    <Row label="Overall Bitrate" value={formatBitrate(format?.bit_rate)} />
                    <Row label="Probe Score" value={format?.probe_score?.toString()} />
                  </div>
                </div>

                {/* Metadata Tags */}
                {format?.tags && Object.keys(format.tags).length > 0 && (
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                    <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider border-b border-white/5 pb-2">
                      Tags & Metadata
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {Object.entries(format.tags).map(([key, val]) => (
                        <Row key={key} label={key} value={val} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex flex-col space-y-1">
      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{label}</span>
      <span className="text-xs font-semibold text-zinc-200 font-mono truncate">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start space-x-2">
      <span className="text-zinc-500 font-medium text-[11px] shrink-0">{label}</span>
      <span className="text-zinc-300 font-mono text-[11px] text-right break-all">{value}</span>
    </div>
  );
}
