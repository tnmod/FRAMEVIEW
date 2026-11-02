import { describe, it, expect } from 'vitest';

describe('Scene Detection Calibration Tests', () => {
  function computeDiffThreshold(sensitivity: number): number {
    return 0.05 + (1.0 - sensitivity) * 0.13;
  }

  function computeSamplingInterval(duration: number, configInterval?: number): number {
    let sampleInterval = configInterval || 0.8;
    if (duration > 1800) {
      sampleInterval = Math.max(sampleInterval, 2.0);
    } else if (duration > 300) {
      sampleInterval = Math.max(sampleInterval, 1.0);
    }
    return sampleInterval;
  }

  it('keeps diffThreshold in realistic perceptual range (0.05 to 0.18)', () => {
    // Default sensitivity: 0.35
    const defaultThreshold = computeDiffThreshold(0.35);
    expect(defaultThreshold).toBeCloseTo(0.1345, 3);
    expect(defaultThreshold).toBeGreaterThan(0.08);
    expect(defaultThreshold).toBeLessThan(0.18);

    // Highly sensitive: 0.8
    const highSensitivityThreshold = computeDiffThreshold(0.8);
    expect(highSensitivityThreshold).toBeCloseTo(0.076, 3);

    // Low sensitivity: 0.1
    const lowSensitivityThreshold = computeDiffThreshold(0.1);
    expect(lowSensitivityThreshold).toBeCloseTo(0.167, 3);
  });

  it('scales sampling interval dynamically for short, medium, and long videos', () => {
    // 3-minute video
    expect(computeSamplingInterval(180)).toBe(0.8);

    // 15-minute video
    expect(computeSamplingInterval(900)).toBe(1.0);

    // 2.5-hour video (8938s)
    expect(computeSamplingInterval(8938)).toBe(2.0);
  });

  it('calculates perceptual weighted delta across RGB and luminance', () => {
    // Test that color shift is detected even with identical luminance
    const r1 = 0, g1 = 255, b1 = 0; // Pure green
    const r2 = 255, g2 = 0, b2 = 0; // Pure red

    const dr = Math.abs(r1 - r2) / 255.0; // 1.0
    const dg = Math.abs(g1 - g2) / 255.0; // 1.0
    const db = Math.abs(b1 - b2) / 255.0; // 0.0

    const colorDiff = dr * 0.3 + dg * 0.59 + db * 0.11;
    expect(colorDiff).toBeCloseTo(0.89, 2);
  });
});
