export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatBytes(bytes: number | string | undefined): string {
  if (!bytes) return '—';
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(b) || b <= 0) return '—';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = b;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(2)} ${units[idx]}`;
}

export function formatBitrate(bitrate: number | string | undefined): string {
  if (!bitrate) return '—';
  const b = typeof bitrate === 'string' ? parseInt(bitrate, 10) : bitrate;
  if (isNaN(b) || b <= 0) return '—';

  if (b >= 1_000_000) {
    return `${(b / 1_000_000).toFixed(2)} Mbps`;
  }
  return `${(b / 1_000).toFixed(0)} kbps`;
}

export function formatFrameRate(rateStr: string | undefined): string {
  if (!rateStr || rateStr === '0/0') return '—';
  if (rateStr.includes('/')) {
    const [num, den] = rateStr.split('/').map(Number);
    if (!isNaN(num) && !isNaN(den) && den > 0) {
      const fps = num / den;
      return `${fps.toFixed(fps % 1 === 0 ? 0 : 3)} fps`;
    }
  }
  const num = parseFloat(rateStr);
  return isNaN(num) ? rateStr : `${num.toFixed(2)} fps`;
}
