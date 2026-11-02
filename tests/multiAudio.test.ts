import { describe, it, expect } from 'vitest';

/**
 * Helper function mirroring the mpv filter graph generator in TrackSelector.tsx
 */
function buildMpvAudioFilterGraph(selectedTrackIds: number[]): string {
  if (selectedTrackIds.length <= 1) {
    return '';
  }
  const inputTags = selectedTrackIds.map((id) => `[aid${id}]`).join('');
  return `${inputTags}amix=inputs=${selectedTrackIds.length}:dropout_transition=0[ao]`;
}

describe('Multi-track Audio Filter Graph Tests', () => {
  it('returns empty string for single audio track or no track selected', () => {
    expect(buildMpvAudioFilterGraph([])).toBe('');
    expect(buildMpvAudioFilterGraph([1])).toBe('');
  });

  it('generates valid lavfi-complex amix filter graph for 2 tracks', () => {
    const graph = buildMpvAudioFilterGraph([1, 2]);
    expect(graph).toBe('[aid1][aid2]amix=inputs=2:dropout_transition=0[ao]');
  });

  it('generates valid lavfi-complex amix filter graph for 3 or more tracks', () => {
    const graph = buildMpvAudioFilterGraph([1, 2, 3]);
    expect(graph).toBe('[aid1][aid2][aid3]amix=inputs=3:dropout_transition=0[ao]');
  });
});
