import { describe, expect, it } from 'vitest';
import { ChapterEngine } from '../src/services/ai/chapterEngine';
import { parseVisionResponse } from '../src/services/ai/providerService';
import { SceneMark, SmartChapter, VisionDescription } from '../src/types/ai';

const visionConfig = {
  providerId: 'ollama_default',
  modelId: 'moondream:latest',
  sampleStrategy: 'scene_keyframes' as const,
  maxFramesToAnalyze: 6,
};

const observations: VisionDescription[] = [
  { timestamp: 0, sceneId: 's0', summary: 'A cook prepares vegetables on a cutting board.', objects: ['cook', 'vegetables', 'cutting board'], activity: 'Preparing vegetables' },
  { timestamp: 70, sceneId: 's1', summary: 'The cook stirs vegetables in a pan.', objects: ['cook', 'pan'], activity: 'Cooking vegetables' },
  { timestamp: 180, sceneId: 's2', summary: 'A plated vegetable dish is shown on the table.', objects: ['dish', 'table'], activity: 'Serving the finished dish' },
  { timestamp: 310, sceneId: 's3', summary: 'A car drives along a mountain road.', objects: ['car', 'mountains'], activity: 'Driving through the mountains' },
  { timestamp: 440, sceneId: 's4', summary: 'The car stops at a mountain viewpoint.', objects: ['car', 'viewpoint'], activity: 'Viewing the mountains' },
];

describe('ChapterEngine content analysis', () => {
  it('prioritizes strong visual changes while still covering the whole video', () => {
    const scenes: SceneMark[] = [
      { id: 's0', timestamp: 0, confidence: 1 },
      { id: 's1', timestamp: 50, confidence: 0.5, score: 0.12 },
      { id: 's2', timestamp: 120, confidence: 0.95, score: 0.84 },
      { id: 's3', timestamp: 190, confidence: 0.5, score: 0.09 },
      { id: 's4', timestamp: 260, confidence: 0.95, score: 0.79 },
      { id: 's5', timestamp: 330, confidence: 0.5, score: 0.11 },
      { id: 's6', timestamp: 400, confidence: 1 },
    ];

    const plan = ChapterEngine.buildVisionSamplePlan(scenes, visionConfig, 400);
    expect(plan).toHaveLength(6);
    expect(plan[0].timestamp).toBe(0);
    expect(plan.at(-1)?.timestamp).toBe(400);
    expect(plan.map((scene) => scene.id)).toContain('s2');
    expect(plan.map((scene) => scene.id)).toContain('s4');
  });

  it('adds timeline samples after the final detected scene', () => {
    const plan = ChapterEngine.buildVisionSamplePlan(
      [
        { id: 's0', timestamp: 0, confidence: 1 },
        { id: 's1', timestamp: 544, confidence: 0.8, score: 0.5 },
      ],
      visionConfig,
      1425
    );

    expect(plan.some((scene) => scene.timestamp >= 1000)).toBe(true);
    expect(plan.at(-1)?.timestamp).toBe(1425);
  });

  it('unwraps JSON that a vision model serialized inside another JSON string', () => {
    expect(
      parseVisionResponse('"{\\"summary\\":\\"A Minecraft village beside a river.\\",\\"objects\\":[\\"village\\",\\"river\\"],\\"activity\\":\\"Exploring\\"}"')
    ).toMatchObject({
      summary: 'A Minecraft village beside a river.',
      objects: ['village', 'river'],
      activity: 'Exploring',
    });
    expect(
      parseVisionResponse('{"summary":"{\\"summary\\":\\"A mountain island in Minecraft.\\"}"}')
    ).toMatchObject({ summary: 'A mountain island in Minecraft.' });
  });

  it('requires visual evidence before creating content chapters', async () => {
    await expect(
      ChapterEngine.generateSmartChapters({
        videoDuration: 600,
        scenes: [],
        visionDescriptions: [],
        config: { providerId: 'ollama_default', modelId: '', minChapterDurationSeconds: 30, language: 'Vietnamese' },
        onProgress: () => {},
      })
    ).rejects.toThrow('No analyzed video frames');
  });

  it('groups chapters by observed content with titles based on the visible activity', async () => {
    const chapters = await ChapterEngine.generateSmartChapters({
      videoDuration: 600,
      scenes: observations.map(({ sceneId, timestamp }) => ({ id: sceneId || '', timestamp, confidence: 0.8 })),
      visionDescriptions: observations,
      config: { providerId: 'ollama_default', modelId: '', minChapterDurationSeconds: 60, language: 'Vietnamese' },
      onProgress: () => {},
    });

    expect(chapters).toHaveLength(3);
    expect(chapters.map((chapter) => chapter.title)).toEqual([
      'Preparing vegetables',
      'Serving the finished dish',
      'Driving through the mountains',
    ]);
    expect(chapters.map((chapter) => [chapter.startTime, chapter.endTime])).toEqual([
      [0, 180],
      [180, 310],
      [310, 600],
    ]);
  });

  it('preserves a manual chapter when generated content overlaps it', async () => {
    const manualChapter: SmartChapter = {
      id: 'manual_1',
      startTime: 180,
      endTime: 310,
      title: 'Món ăn đã duyệt',
      isManualEdit: true,
    };
    const chapters = await ChapterEngine.generateSmartChapters({
      videoDuration: 600,
      scenes: observations.map(({ sceneId, timestamp }) => ({ id: sceneId || '', timestamp, confidence: 0.8 })),
      visionDescriptions: observations,
      existingChapters: [manualChapter],
      config: { providerId: 'ollama_default', modelId: '', minChapterDurationSeconds: 60, language: 'Vietnamese' },
      onProgress: () => {},
    });

    expect(chapters.find((chapter) => chapter.id === 'manual_1')).toMatchObject(manualChapter);
    expect(chapters.some((chapter) => !chapter.isManualEdit && chapter.startTime < 310 && chapter.endTime > 180)).toBe(false);
  });
});
