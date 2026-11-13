import { describe, expect, it } from 'vitest';
import { parseSceneCutVerification } from '../frontend/services/ai/providerService';

describe('scene-cut vision decisions', () => {
  it('accepts a VLM cut decision and normalizes percentage confidence', () => {
    expect(
      parseSceneCutVerification('{"isSceneCut": true, "confidence": 87, "reason": "new camera angle"}')
    ).toEqual({
      isSceneCut: true,
      confidence: 0.87,
      reason: 'new camera angle',
    });
  });

  it('fails closed when a model response is malformed', () => {
    expect(parseSceneCutVerification('Probably a cut, but I cannot return JSON.')).toEqual({
      isSceneCut: false,
      confidence: 0,
    });
  });

  it('does not turn a negative decision into a timeline marker', () => {
    expect(parseSceneCutVerification('{"isSceneCut": false, "confidence": 0.93}')).toEqual({
      isSceneCut: false,
      confidence: 0.93,
      reason: undefined,
    });
  });
});
