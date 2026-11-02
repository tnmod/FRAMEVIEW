import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { command as mpvCommand, getProperty, setProperty } from 'tauri-plugin-libmpv-api';
import {
  AiProviderConfig,
  ModelRuntimeStats,
  SceneMark,
  SmartChapter,
  VisionDescription,
  SmartChaptersConfig,
  VisionAnalysisConfig,
  TaskWorkProgress,
} from '../../types/ai';
import { parseVisionResponse, ProviderService } from './providerService';
import { usePlayerStore } from '../../store/playerStore';

const unsupportedWebViewVideoExtensions = new Set([
  'mkv', 'avi', 'flv', 'ts', 'mts', 'm2ts', 'wmv', 'vob', 'rmvb', 'asf',
]);
const html5FrameCaptureFailures = new Set<string>();

export class ChapterEngine {
  /**
   * Capture a base64 image frame at a specific timestamp from the video
   */
  static async captureFrameBase64(
    filePath: string,
    timestamp: number,
    maxWidth = 640
  ): Promise<string> {
    const normalizedPath = filePath.replace(/[\\/]+/g, '\\').toLocaleLowerCase();
    const extension = normalizedPath.split('.').pop() || '';
    if (
      unsupportedWebViewVideoExtensions.has(extension) ||
      html5FrameCaptureFailures.has(normalizedPath)
    ) {
      return this.captureFrameWithMpv(filePath, timestamp);
    }

    try {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;

      try {
        video.src = convertFileSrc(filePath);
      } catch {
        html5FrameCaptureFailures.add(normalizedPath);
        return await this.captureFrameWithMpv(filePath, timestamp);
      }

      const metadataSuccess = await new Promise<boolean>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            cleanup();
            resolve(false);
          }
        }, 2500);

        const onLoaded = () => {
          if (!settled) {
            settled = true;
            cleanup();
            resolve(true);
          }
        };
        const onError = () => {
          if (!settled) {
            settled = true;
            cleanup();
            resolve(false);
          }
        };
        const cleanup = () => {
          clearTimeout(timer);
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
        };

        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('error', onError);
      });

      if (!metadataSuccess) {
        video.src = '';
        video.remove();
        html5FrameCaptureFailures.add(normalizedPath);
        return await this.captureFrameWithMpv(filePath, timestamp);
      }

      const seekSuccess = await new Promise<boolean>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            video.removeEventListener('seeked', onSeeked);
            resolve(false);
          }
        }, 1500);

        const onSeeked = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            video.removeEventListener('seeked', onSeeked);
            resolve(true);
          }
        };

        video.addEventListener('seeked', onSeeked, { once: true });
        video.currentTime = Math.max(0, timestamp);
      });

      if (!seekSuccess || video.videoWidth <= 0 || video.videoHeight <= 0) {
        video.src = '';
        video.remove();
        html5FrameCaptureFailures.add(normalizedPath);
        return await this.captureFrameWithMpv(filePath, timestamp);
      }

      const canvas = document.createElement('canvas');
      const scale = Math.min(1.0, maxWidth / (video.videoWidth || 640));
      canvas.width = Math.round((video.videoWidth || 640) * scale);
      canvas.height = Math.round((video.videoHeight || 360) * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        video.src = '';
        video.remove();
        canvas.remove();
        html5FrameCaptureFailures.add(normalizedPath);
        return await this.captureFrameWithMpv(filePath, timestamp);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);

      video.src = '';
      video.remove();
      canvas.remove();

      return dataUrl;
    } catch {
      html5FrameCaptureFailures.add(normalizedPath);
      return await this.captureFrameWithMpv(filePath, timestamp);
    }
  }

  private static async captureFrameWithMpv(filePath: string, timestamp: number): Promise<string> {
    const loadedFile = usePlayerStore.getState().filePath;
    const normalize = (path: string) => path.replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLocaleLowerCase();
    if (!loadedFile || normalize(loadedFile) !== normalize(filePath)) return '';

    const fileName = `ai-frame-${crypto.randomUUID()}.jpg`;
    let capturePath: string | undefined;
    let originalTime: number | null = null;
    let originalPause: boolean | null = null;

    try {
      originalTime = await getProperty<number>('time-pos', 'double');
      originalPause = await getProperty<boolean>('pause', 'flag');
      if (originalTime === null || !Number.isFinite(originalTime)) {
        originalTime = usePlayerStore.getState().currentTime;
      }
      if (originalPause === null) {
        originalPause = usePlayerStore.getState().playbackState !== 'playing';
      }

      capturePath = await invoke<string>('prepare_ai_frame_capture', { fileName });
      await setProperty('pause', true);
      await mpvCommand('seek', [timestamp.toString(), 'absolute', 'exact']);

      for (let attempt = 0; attempt < 24; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const currentTime = await getProperty<number>('time-pos', 'double');
        if (currentTime !== null && Math.abs(currentTime - timestamp) < 0.75) break;
      }

      // Let mpv present the decoded frame before writing its screenshot.
      await new Promise((resolve) => setTimeout(resolve, 100));
      await mpvCommand('screenshot-to-file', [capturePath, 'video']);
      const imageBase64 = await invoke<string>('read_ai_frame_base64', { fileName });
      return imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : '';
    } catch (error) {
      console.warn(`Could not capture frame at ${timestamp}s with libmpv:`, error);
      return '';
    } finally {
      if (capturePath) {
        await invoke('remove_ai_frame_capture', { fileName }).catch(() => {});
      }
      if (originalTime !== null && Number.isFinite(originalTime)) {
        await mpvCommand('seek', [originalTime.toString(), 'absolute', 'exact']).catch(() => {});
      }
      if (originalPause !== null) {
        await setProperty('pause', originalPause).catch(() => {});
      }
    }
  }

  /**
   * Pick a compact, evidence-rich set of frames. Strong visual changes win a place,
   * while temporal anchors keep quieter parts of the video represented.
   */
  static buildVisionSamplePlan(
    scenes: SceneMark[],
    config: VisionAnalysisConfig,
    videoDuration?: number
  ): SceneMark[] {
    const orderedScenes = [...scenes]
      .filter((scene) => Number.isFinite(scene.timestamp))
      .sort((left, right) => left.timestamp - right.timestamp);
    if (orderedScenes.length === 0) return [];

    const configuredMaximum = Math.max(1, config.maxFramesToAnalyze || 28);
    const duration = Math.max(videoDuration || 0, orderedScenes[orderedScenes.length - 1].timestamp);
    const maxFrames = Math.min(48, configuredMaximum);
    if (duration <= 0) return orderedScenes.slice(0, maxFrames);

    const timeSample = (timestamp: number): SceneMark => ({
      id: `timeline_${timestamp.toFixed(2)}`,
      timestamp: Number(timestamp.toFixed(2)),
      confidence: 0.5,
      label: 'Timeline sample',
    });

    if (config.sampleStrategy === 'uniform_interval') {
      const interval = Math.max(5, config.intervalSeconds || duration / maxFrames);
      const selected: SceneMark[] = [];
      for (let timestamp = 0; timestamp <= duration && selected.length < maxFrames; timestamp += interval) {
        selected.push(timeSample(timestamp));
      }
      const finalSample = selected[selected.length - 1];
      if (finalSample?.timestamp !== duration && selected.length < maxFrames) selected.push(timeSample(duration));
      return selected;
    }

    const selected = new Map<string, SceneMark>();
    const add = (scene: SceneMark | undefined) => {
      if (scene && selected.size < maxFrames) selected.set(scene.id, scene);
    };
    // Reserve room for timeline anchors, otherwise a keyframe-heavy opening can leave
    // the last half of a video without any visual evidence.
    const scoreOf = (scene: SceneMark) => (scene.score ?? 0) + (scene.confidence ?? 0) * 0.08;
    const minimumSeparation = Math.max(3, duration / Math.max(1, maxFrames * 1.5));
    const timelineAnchorCount = Math.min(maxFrames, Math.max(2, Math.ceil(maxFrames * 0.4)));
    const priorityBudget = maxFrames - timelineAnchorCount;
    for (const scene of [...orderedScenes].sort((left, right) => scoreOf(right) - scoreOf(left))) {
      if (selected.size >= priorityBudget) break;
      const hasRoom = [...selected.values()].every(
        (chosen) => Math.abs(chosen.timestamp - scene.timestamp) >= minimumSeparation
      );
      if (hasRoom) add(scene);
    }

    // Capture exact temporal anchors when scene detection provides no nearby marker.
    for (let slot = 0; slot < timelineAnchorCount && selected.size < maxFrames; slot++) {
      const target = duration * (slot / Math.max(1, timelineAnchorCount - 1));
      const nearestSelected = [...selected.values()].some(
        (scene) => Math.abs(scene.timestamp - target) < minimumSeparation
      );
      if (!nearestSelected) add(timeSample(target));
    }
    for (let slot = 0; selected.size < maxFrames; slot++) {
      const target = duration * ((slot + 0.5) / maxFrames);
      add(timeSample(target));
    }

    return Array.from(selected.values()).sort((left, right) => left.timestamp - right.timestamp);
  }

  /**
   * Run vision analysis on keyframes extracted from detected scenes
   */
  static async runVisionAnalysis(options: {
    filePath: string;
    scenes: SceneMark[];
    videoDuration?: number;
    provider: AiProviderConfig;
    config: VisionAnalysisConfig;
    onProgress: (p: TaskWorkProgress) => void;
    signal?: AbortSignal;
  }): Promise<VisionDescription[]> {
    const { filePath, scenes, videoDuration, provider, config, onProgress, signal } = options;

    if (!scenes || scenes.length === 0) {
      throw new Error('No scenes provided for vision analysis. Run Scene Detection first.');
    }

    const sampledScenes = this.buildVisionSamplePlan(scenes, config, videoDuration);

    const totalUnits = sampledScenes.length;
    const results: VisionDescription[] = [];
    const failures: string[] = [];

    const defaultPrompt =
      config.promptOverride ||
      'Briefly describe this video frame. What key objects, people, background, and action are visible?';

    const completedFrameSamples: Array<{
      elapsedSeconds: number;
      completionTokens: number;
      generationSeconds?: number;
    }> = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalGenerationSeconds = 0;
    let completedModelRequests = 0;
    let modelStats: ModelRuntimeStats | undefined;

    const recordModelStats = (latest?: ModelRuntimeStats) => {
      if (!latest) return modelStats;
      completedModelRequests += latest.requestCount;
      totalInputTokens += latest.inputTokens || 0;
      totalOutputTokens += latest.outputTokens || 0;
      totalGenerationSeconds += latest.generationSeconds || 0;
      modelStats = {
        ...latest,
        requestCount: completedModelRequests,
        inputTokens: totalInputTokens || undefined,
        outputTokens: totalOutputTokens || undefined,
        totalTokens: (totalInputTokens + totalOutputTokens) || undefined,
        outputTokensPerSecond: totalOutputTokens && totalGenerationSeconds
          ? totalOutputTokens / totalGenerationSeconds
          : latest.outputTokensPerSecond,
        generationSeconds: totalGenerationSeconds || undefined,
      };
      return modelStats;
    };

    for (let i = 0; i < sampledScenes.length; i++) {
      if (signal?.aborted) break;

      const scene = sampledScenes[i];
      const currentUnit = i + 1;
      const frameStartedAt = performance.now();
      const recentSamples = completedFrameSamples.slice(-8);
      const averageFrameSeconds = recentSamples.length
        ? recentSamples.reduce((sum, sample) => sum + sample.elapsedSeconds, 0) / recentSamples.length
        : undefined;
      const samplesWithOutput = recentSamples.filter((sample) => sample.completionTokens > 0);
      const averageOutputTokens = samplesWithOutput.length
        ? samplesWithOutput.reduce((sum, sample) => sum + sample.completionTokens, 0) / samplesWithOutput.length
        : undefined;
      const averageSecondsPerOutputToken = samplesWithOutput.length
        ? samplesWithOutput.reduce((sum, sample) => sum + sample.elapsedSeconds, 0) /
          samplesWithOutput.reduce((sum, sample) => sum + sample.completionTokens, 0)
        : undefined;
      const measuredGenerationSamples = recentSamples.filter(
        (sample): sample is typeof sample & { generationSeconds: number } =>
          sample.generationSeconds !== undefined && sample.generationSeconds > 0
      );
      const measuredTokensPerSecond = measuredGenerationSamples.length
        ? measuredGenerationSamples.reduce((sum, sample) => sum + sample.completionTokens, 0) /
          measuredGenerationSamples.reduce((sum, sample) => sum + sample.generationSeconds, 0)
        : undefined;
      const averageFrameOverhead = measuredGenerationSamples.length
        ? measuredGenerationSamples.reduce(
            (sum, sample) => sum + Math.max(0, sample.elapsedSeconds - sample.generationSeconds),
            0
          ) / measuredGenerationSamples.length
        : undefined;
      const estimateRemainingSeconds = (remainingFrames: number, inFlightSeconds = 0) => {
        if (remainingFrames <= 0) return 0;
        if (averageOutputTokens && measuredTokensPerSecond && averageFrameOverhead !== undefined) {
          return Math.max(
            0,
            Math.ceil(
              remainingFrames * (averageFrameOverhead + averageOutputTokens / measuredTokensPerSecond) -
                inFlightSeconds
            )
          );
        }
        if (averageOutputTokens && averageSecondsPerOutputToken) {
          return Math.max(
            0,
            Math.ceil(remainingFrames * averageOutputTokens * averageSecondsPerOutputToken - inFlightSeconds)
          );
        }
        if (averageFrameSeconds) {
          return Math.max(0, Math.ceil(remainingFrames * averageFrameSeconds - inFlightSeconds));
        }
        return undefined;
      };

      onProgress({
        currentUnit,
        totalUnits,
        percent: Math.round(((currentUnit - 0.5) / totalUnits) * 100),
        unitLabel: 'scenes analyzed',
        stageDescription: `Analyzing keyframe at ${Math.round(scene.timestamp)}s with ${config.modelId}...`,
        etaSeconds: estimateRemainingSeconds(
          totalUnits - currentUnit + 1,
          (performance.now() - frameStartedAt) / 1000
        ),
        modelStats,
      });

      let frameSampleRecorded = false;
      try {
        // Scene thumbnails are intentionally tiny for storage. Vision needs a real frame first;
        // keep the thumbnail only as a resilience fallback when the decoder cannot capture one.
        const capturedFrame = await this.captureFrameBase64(filePath, scene.timestamp, 640);
        const frameDataUrl = capturedFrame || scene.thumbnailDataUrl;

        if (frameDataUrl) {
          const visionResult = await ProviderService.analyzeFrameWithVision(
            provider,
            config.modelId,
            frameDataUrl,
            defaultPrompt,
            signal
          );
          recordModelStats(visionResult.modelStats);

          results.push({
            timestamp: scene.timestamp,
            sceneId: scene.id,
            summary: visionResult.summary,
            objects: visionResult.objects,
            activity: visionResult.activity,
            thumbnailDataUrl: frameDataUrl,
          });
          const elapsedSeconds = (performance.now() - frameStartedAt) / 1000;
          // Ollama and some OpenAI-compatible providers expose generated token counts.
          // Fall back to a text-length estimate when usage metadata is omitted.
          const completionTokens =
            visionResult.completionTokens ??
            Math.max(1, Math.ceil(JSON.stringify(visionResult).length / 4));
          completedFrameSamples.push({
            elapsedSeconds,
            completionTokens,
            generationSeconds: visionResult.generationSeconds,
          });
          frameSampleRecorded = true;
        } else {
          failures.push(`${Math.round(scene.timestamp)}s: no decoded frame`);
        }
      } catch (err: any) {
        if (signal?.aborted) break;
        console.warn(`Vision analysis failed for scene at ${scene.timestamp}s:`, err);
        failures.push(`${Math.round(scene.timestamp)}s: ${err?.message || 'vision request failed'}`);
      }

      if (!frameSampleRecorded) {
        // Failed or undecodable frames still consume work; include their elapsed time without
        // inventing an output-token count.
        const elapsedSeconds = (performance.now() - frameStartedAt) / 1000;
        completedFrameSamples.push({ elapsedSeconds, completionTokens: 0 });
      }
      const etaSeconds = estimateRemainingSeconds(totalUnits - currentUnit);

      onProgress({
        currentUnit,
        totalUnits,
        percent: Math.round((currentUnit / totalUnits) * 100),
        unitLabel: 'scenes analyzed',
        stageDescription: `Completed keyframe ${currentUnit} of ${totalUnits}`,
        etaSeconds,
        modelStats,
      });

      // Throttle slightly to respect model inference load
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!signal?.aborted && results.length === 0) {
      const detail = failures.slice(0, 3).join('; ');
      throw new Error(
        `Vision analysis could not analyze any sampled video frames.${detail ? ` ${detail}` : ''}`
      );
    }

    return results;
  }

  /**
   * Synthesize Smart Chapters from scenes and optional vision descriptions.
   * Can use a text LLM if available, or intelligent rule-based grouping if offline/no LLM.
   */
  static async generateSmartChapters(options: {
    videoDuration: number;
    scenes: SceneMark[];
    visionDescriptions?: VisionDescription[];
    existingChapters?: SmartChapter[];
    provider?: AiProviderConfig;
    config: SmartChaptersConfig;
    onProgress: (p: TaskWorkProgress) => void;
    signal?: AbortSignal;
  }): Promise<SmartChapter[]> {
    const {
      videoDuration,
      scenes,
      visionDescriptions = [],
      existingChapters = [],
      provider,
      config,
      onProgress,
      signal,
    } = options;

    if (videoDuration <= 0) {
      throw new Error('Valid video duration is required to build chapters');
    }

    const observations = visionDescriptions
      .map((description) => {
        const recovered = parseVisionResponse(description.summary);
        return {
          ...description,
          summary: recovered.summary,
          objects: description.objects?.length ? description.objects : recovered.objects,
          activity: description.activity?.trim() || recovered.activity,
        };
      })
      .filter((description) => description.summary.trim().length > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (observations.length === 0) {
      throw new Error('No analyzed video frames are available. Run Vision Analysis before creating content-based chapters.');
    }

    const preservedManualChapters = existingChapters.filter((chapter) => chapter.isManualEdit);
    const minDuration = Math.max(10, config.minChapterDurationSeconds || 20);
    const language = config.language || 'English';

    onProgress({
      currentUnit: 1,
      totalUnits: 3,
      percent: 20,
      unitLabel: 'stages',
      stageDescription: `Reviewing ${observations.length} analyzed frames for content changes...`,
    });

    const observationContext = observations
      .map((observation, index) => {
        const objects = observation.objects?.length ? `; objects: ${observation.objects.join(', ')}` : '';
        const activity = observation.activity ? `; activity: ${observation.activity}` : '';
        return `${index + 1}. ${observation.timestamp.toFixed(1)}s — ${observation.summary}${objects}${activity}`;
      })
      .join('\n');

    let groups: Array<{ startFrame: number; endFrame: number; title: string; summary: string }> = [];

    if (provider && config.modelId && !signal?.aborted) {
      onProgress({
        currentUnit: 2,
        totalUnits: 3,
        percent: 45,
        unitLabel: 'stages',
        stageDescription: 'Grouping related scenes and naming chapters from their visual content...',
      });

      try {
        const prompt = `You are preparing an editor's chapter map from analyzed video frames. The observations are in chronological order and describe real visual content.

Group adjacent observations into meaningful editing chapters. Start a new chapter only when the subject, activity, location, or story beat changes. Do not split by equal time intervals, do not make one chapter per frame, and do not invent events absent from the observations. Keep chapters at least ${minDuration} seconds where possible, but prefer real content changes over duration. Return concise, specific titles and useful summaries in ${language}. A title must name the visible subject or action; never use generic labels such as "Scene 3", "Chapter 2", "Section", or timestamp ranges.

Return only valid JSON in this exact shape. Frame numbers are 1-based and inclusive, and the groups must partition every observation exactly once in order:
{"chapters":[{"startFrame":1,"endFrame":3,"title":"Specific event or activity","summary":"What is visibly happening"}]}

Video duration: ${videoDuration.toFixed(1)} seconds
Observed frames:
${observationContext}`;

        const response = await ProviderService.generateSmartChaptersText(
          provider,
          config.modelId,
          prompt,
          signal
        );
        onProgress({
          currentUnit: 2,
          totalUnits: 3,
          percent: 75,
          unitLabel: 'stages',
          stageDescription: 'Model response received; validating chapter boundaries...',
          modelStats: response.modelStats,
        });
        const responseText = response.content;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const proposed = Array.isArray(parsed.chapters) ? parsed.chapters : [];
          let expectedStart = 1;
          const validated = proposed.map((chapter: any) => {
            if (
              !Number.isInteger(chapter.startFrame) ||
              !Number.isInteger(chapter.endFrame) ||
              chapter.startFrame !== expectedStart ||
              chapter.endFrame < chapter.startFrame ||
              chapter.endFrame > observations.length ||
              typeof chapter.title !== 'string' ||
              !chapter.title.trim()
            ) {
              throw new Error('Chapter model returned invalid frame grouping.');
            }
            expectedStart = chapter.endFrame + 1;
            const startObservation = observations[chapter.startFrame - 1];
            const fallback = this.makeObservationGroup(
              observations,
              chapter.startFrame - 1,
              chapter.endFrame - 1
            );
            const suppliedTitle = this.cleanChapterText(chapter.title, fallback.title).slice(0, 96);
            const suppliedSummary =
              typeof chapter.summary === 'string' && chapter.summary.trim()
                ? this.cleanChapterText(chapter.summary, startObservation.summary)
                : startObservation.summary;
            return {
              startFrame: chapter.startFrame,
              endFrame: chapter.endFrame,
              title: this.isGenericChapterTitle(suppliedTitle) ? fallback.title : suppliedTitle,
              summary: suppliedSummary,
            };
          });

          if (validated.length > 0 && expectedStart === observations.length + 1) {
            groups = validated;
          }
        }
      } catch (err) {
        console.warn('Semantic chapter grouping failed; using visual-summary grouping:', err);
      }
    }

    if (groups.length === 0) {
      groups = this.groupObservationsByVisualSimilarity(observations, minDuration);
    }

    const draftChapters: SmartChapter[] = groups.map((group, index) => {
      const startObservation = observations[group.startFrame - 1];
      const nextObservation = observations[group.endFrame];
      const startTime = index === 0 ? 0 : startObservation.timestamp;
      const endTime = group.endFrame === observations.length ? videoDuration : nextObservation.timestamp;
      const matchingScene = scenes.find(
        (scene) =>
          (scene.id === startObservation.sceneId || Math.abs(scene.timestamp - startObservation.timestamp) < 2) &&
          Boolean(scene.thumbnailDataUrl)
      );

      return {
        id: `chap_${index + 1}_${Date.now()}`,
        startTime: parseFloat(Math.max(0, startTime).toFixed(2)),
        endTime: parseFloat(Math.min(videoDuration, endTime).toFixed(2)),
        title: group.title,
        summary: group.summary,
        thumbnailDataUrl: matchingScene?.thumbnailDataUrl || startObservation.thumbnailDataUrl,
        isManualEdit: false,
      };
    }).filter((chapter) => chapter.endTime > chapter.startTime);

    onProgress({
      currentUnit: 3,
      totalUnits: 3,
      percent: 100,
      unitLabel: 'chapters',
      stageDescription: `Created ${draftChapters.length} content-based chapters.`,
    });

    return this.mergeManualChapters(draftChapters, preservedManualChapters);
  }

  private static groupObservationsByVisualSimilarity(
    observations: VisionDescription[],
    minDuration: number
  ): Array<{ startFrame: number; endFrame: number; title: string; summary: string }> {
    const stopWords = new Set([
      'the', 'and', 'with', 'from', 'this', 'that', 'there', 'then', 'into', 'while', 'near',
      'một', 'các', 'đang', 'trong', 'trên', 'với', 'của', 'và', 'người', 'khung', 'cảnh',
    ]);
    const tokens = (text: string) =>
      new Set(
        (text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
          .filter((token) => token.length > 2 && !stopWords.has(token))
      );
    const similarity = (left: VisionDescription, right: VisionDescription) => {
      const leftTokens = new Set([...tokens(left.summary), ...tokens((left.objects || []).join(' ')), ...tokens(left.activity || '')]);
      const rightTokens = new Set([...tokens(right.summary), ...tokens((right.objects || []).join(' ')), ...tokens(right.activity || '')]);
      const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
      const union = new Set([...leftTokens, ...rightTokens]).size;
      return union === 0 ? 0 : intersection / union;
    };

    const groups: Array<{ startFrame: number; endFrame: number; title: string; summary: string }> = [];
    let start = 0;
    for (let index = 1; index < observations.length; index++) {
      const elapsed = observations[index].timestamp - observations[start].timestamp;
      if (elapsed >= minDuration && similarity(observations[index - 1], observations[index]) < 0.18) {
        groups.push(this.makeObservationGroup(observations, start, index - 1));
        start = index;
      }
    }
    groups.push(this.makeObservationGroup(observations, start, observations.length - 1));

    if (groups.length > 1) {
      const lastGroup = groups[groups.length - 1];
      const lastStart = observations[lastGroup.startFrame - 1].timestamp;
      if (observations[observations.length - 1].timestamp - lastStart < minDuration / 2) {
        const previous = groups[groups.length - 2];
        groups[groups.length - 2] = this.makeObservationGroup(
          observations,
          previous.startFrame - 1,
          observations.length - 1
        );
        groups.pop();
      }
    }

    return groups;
  }

  private static makeObservationGroup(
    observations: VisionDescription[],
    startIndex: number,
    endIndex: number
  ) {
    const entries = observations.slice(startIndex, endIndex + 1);
    const first = entries[0];
    const summary = entries
      .map((entry) => entry.summary.trim())
      .filter((value, index, all) => value && all.indexOf(value) === index)
      .slice(0, 3)
      .join(' ');
    const titleSource = entries.find((entry) => entry.activity?.trim())?.activity?.trim() || first.summary.trim();
    const title = titleSource.replace(/[.!?。！？]+$/, '').slice(0, 72) || 'Video segment';

    return {
      startFrame: startIndex + 1,
      endFrame: endIndex + 1,
      title,
      summary: summary || title,
    };
  }

  private static isGenericChapterTitle(title: string): boolean {
    return /^(scene|chapter|section|part|segment|đoạn|chương)\s*(\d+|[-–—:]|$)/i.test(title.trim());
  }

  private static cleanChapterText(value: string, fallback: string): string {
    const trimmed = value.trim();
    if (!/^\s*(?:"\s*)?\{/.test(trimmed)) return trimmed;
    const parsed = parseVisionResponse(trimmed).summary.trim();
    return /^\s*(?:"\s*)?\{/.test(parsed) ? fallback : parsed;
  }

  private static mergeManualChapters(
    generated: SmartChapter[],
    manual: SmartChapter[]
  ): SmartChapter[] {
    if (manual.length === 0) return generated;

    const remaining = generated.flatMap((chapter) => {
      let intervals = [{ startTime: chapter.startTime, endTime: chapter.endTime }];
      for (const manualChapter of manual) {
        intervals = intervals.flatMap((interval) => {
          if (manualChapter.endTime <= interval.startTime || manualChapter.startTime >= interval.endTime) {
            return [interval];
          }
          const pieces = [];
          if (manualChapter.startTime > interval.startTime) {
            pieces.push({ startTime: interval.startTime, endTime: manualChapter.startTime });
          }
          if (manualChapter.endTime < interval.endTime) {
            pieces.push({ startTime: manualChapter.endTime, endTime: interval.endTime });
          }
          return pieces;
        });
      }
      return intervals
        .filter((interval) => interval.endTime - interval.startTime >= 5)
        .map((interval, index) => ({
          ...chapter,
          id: `${chapter.id}_part_${index + 1}`,
          ...interval,
        }));
    });

    return [...remaining, ...manual].sort((a, b) => a.startTime - b.startTime);
  }
}
