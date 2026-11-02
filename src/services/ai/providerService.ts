import { invoke } from '@tauri-apps/api/core';
import { AiProviderConfig, ModelInfo, ModelCapability, ModelRuntimeStats } from '../../types/ai';

interface NativeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface NativeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

async function safeFetch(url: string, options: NativeFetchOptions = {}): Promise<NativeResponse> {
  try {
    const res = await invoke<{ status: number; body: string; ok: boolean }>('ai_http_request', {
      req: {
        url,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        timeout_ms: options.timeoutMs || 60000,
      },
    });

    return {
      ok: res.ok,
      status: res.status,
      json: async () => JSON.parse(res.body),
      text: async () => res.body,
    };
  } catch (invokeErr) {
    // Fallback to standard web fetch
    const resp = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      signal: options.signal,
    });
    return {
      ok: resp.ok,
      status: resp.status,
      json: () => resp.json(),
      text: () => resp.text(),
    };
  }
}

// Common known vision models in Ollama / OpenAI
const VISION_MODEL_KEYWORDS = [
  'vision',
  'llava',
  'minicpm-v',
  'bakllava',
  'moondream',
  'gpt-4o',
  'gpt-4-turbo',
  'claude-3',
  'gemini',
  'internvl',
  'qwen-vl',
  'qwen2-vl',
  'phi-3-vision',
  'phi-3.5-vision',
];

export function parseVisionResponse(rawContent: string): {
  summary: string;
  objects: string[];
  activity?: string;
} {
  const raw = (rawContent || '').trim();

  const parseObject = (value: unknown, depth = 0): Record<string, unknown> | null => {
    if (depth > 3 || !value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const objectValue = value as Record<string, unknown>;
      // Some local models serialize their intended JSON inside the summary field.
      if (typeof objectValue.summary === 'string') {
        const nested = parseObject(objectValue.summary, depth + 1);
        if (nested?.summary || nested?.description) return nested;
      }
      return objectValue;
    }
    if (typeof value !== 'string') return null;

    const text = value.trim();
    try {
      return parseObject(JSON.parse(text), depth + 1);
    } catch {
      const objectBlock = text.match(/\{[\s\S]*\}/)?.[0];
      if (!objectBlock) return null;
      try {
        return parseObject(JSON.parse(objectBlock), depth + 1);
      } catch {
        return null;
      }
    }
  };

  const parsed = parseObject(raw);
  if (parsed) {
    const summary = [parsed.summary, parsed.description, parsed.caption]
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
      ?.trim();
    if (summary) {
      return {
        summary,
        objects: Array.isArray(parsed.objects)
          ? parsed.objects.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : [],
        activity: typeof parsed.activity === 'string' ? parsed.activity.trim() : '',
      };
    }
  }

  // Some smaller local vision models begin a JSON response then stop early.
  // Recover the useful summary instead of exposing the incomplete JSON as a title.
  const recoverJsonStringField = (field: string): string | undefined => {
    const match = raw.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i'));
    if (!match?.[1]) return undefined;
    try {
      return JSON.parse(`"${match[1]}"`).trim();
    } catch {
      return match[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
    }
  };
  const recoveredSummary = recoverJsonStringField('summary') || recoverJsonStringField('description');
  if (recoveredSummary) {
    return {
      summary: recoveredSummary,
      objects: [],
      activity: recoverJsonStringField('activity') || '',
    };
  }

  return { summary: raw || 'Scene analyzed', objects: [], activity: '' };
}

export interface SceneCutVerification {
  isSceneCut: boolean;
  confidence: number;
  reason?: string;
  modelStats?: ModelRuntimeStats;
}

function finiteNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function nanosecondsToSeconds(value: unknown): number | undefined {
  const nanoseconds = finiteNumber(value);
  return nanoseconds && nanoseconds > 0 ? nanoseconds / 1_000_000_000 : undefined;
}

function ollamaRuntimeStats(data: any, modelId: string, contextWindowTokens?: number): ModelRuntimeStats {
  const inputTokens = finiteNumber(data.prompt_eval_count);
  const outputTokens = finiteNumber(data.eval_count);
  const promptSeconds = nanosecondsToSeconds(data.prompt_eval_duration);
  const generationSeconds = nanosecondsToSeconds(data.eval_duration);
  return {
    modelId,
    requestCount: 1,
    inputTokens,
    outputTokens,
    totalTokens: (inputTokens || 0) + (outputTokens || 0) || undefined,
    promptTokensPerSecond: inputTokens && promptSeconds ? inputTokens / promptSeconds : undefined,
    outputTokensPerSecond: outputTokens && generationSeconds ? outputTokens / generationSeconds : undefined,
    generationSeconds,
    loadSeconds: nanosecondsToSeconds(data.load_duration),
    contextWindowTokens,
  };
}

function openAiRuntimeStats(data: any, modelId: string): ModelRuntimeStats {
  const inputTokens = finiteNumber(data.usage?.prompt_tokens);
  const outputTokens = finiteNumber(data.usage?.completion_tokens);
  const totalTokens = finiteNumber(data.usage?.total_tokens) ||
    ((inputTokens || 0) + (outputTokens || 0) || undefined);
  return { modelId, requestCount: 1, inputTokens, outputTokens, totalTokens };
}

/** Parse a compact VLM decision without treating an unparseable answer as a cut. */
export function parseSceneCutVerification(rawContent: string): SceneCutVerification {
  const raw = (rawContent || '').trim();
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return { isSceneCut: false, confidence: 0 };

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    // Local VLMs do not consistently preserve camelCase JSON keys. Do not lose a
    // valid affirmative decision merely because the model used snake_case or a
    // plain affirmative string instead of the requested schema.
    const decision =
      parsed.isSceneCut ??
      parsed.is_scene_cut ??
      parsed.isCut ??
      parsed.is_cut ??
      parsed.cut_detected ??
      parsed.sceneCut ??
      parsed.scene_cut ??
      parsed.cut ??
      parsed.decision ??
      parsed.result;
    const normalizedDecision = String(decision ?? '').trim().toLowerCase();
    const isSceneCut = decision === true || ['true', 'yes', 'cut', 'scene cut', '1'].includes(normalizedDecision);

    const rawConfidence = Number(parsed.confidence ?? parsed.score ?? parsed.probability);
    const confidenceWord = String(parsed.confidence ?? '').trim().toLowerCase();
    const fallbackConfidence = confidenceWord === 'high'
      ? 0.85
      : confidenceWord === 'medium' || confidenceWord === 'moderate'
        ? 0.65
        : confidenceWord === 'low'
          ? 0.35
          // An explicit affirmative decision is more useful than silently
          // rejecting it just because this local model omitted confidence.
          : isSceneCut
            ? 0.65
            : 0;
    const normalizedConfidence = Number.isFinite(rawConfidence)
      ? Math.min(1, Math.max(0, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence))
      : fallbackConfidence;
    return {
      isSceneCut,
      confidence: normalizedConfidence,
      reason: typeof parsed.reason === 'string' ? parsed.reason.trim() : undefined,
    };
  } catch {
    return { isSceneCut: false, confidence: 0 };
  }
}

export class ProviderService {
  /**
   * Test an Ollama endpoint and fetch available models with their capabilities
   */
  static async testOllamaConnection(endpoint: string): Promise<{
    success: boolean;
    latencyMs: number;
    models: ModelInfo[];
    error?: string;
  }> {
    const cleanEndpoint = endpoint.replace(/\/+$/, '');
    const startTime = performance.now();

    try {
      const response = await safeFetch(`${cleanEndpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 5000,
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (!response.ok) {
        return {
          success: false,
          latencyMs,
          models: [],
          error: `Ollama returned HTTP status ${response.status}`,
        };
      }

      const data = await response.json();
      const rawModels = Array.isArray(data.models) ? data.models : [];

      const models: ModelInfo[] = rawModels.map((m: any) => {
        const nameLower = (m.name || m.model || '').toLowerCase();
        const familyLower = (m.details?.family || '').toLowerCase();

        const capabilities: ModelCapability[] = ['text'];

        // Determine if model supports vision
        const isVision =
          VISION_MODEL_KEYWORDS.some(
            (kw) => nameLower.includes(kw) || familyLower.includes(kw)
          ) || (Array.isArray(m.capabilities) && m.capabilities.includes('vision'));

        if (isVision) {
          capabilities.push('vision');
        }

        if (nameLower.includes('embed') || familyLower.includes('bert')) {
          capabilities.push('embedding');
        }

        return {
          id: m.name || m.model,
          name: m.name || m.model,
          providerId: 'ollama_default',
          capabilities,
          sizeBytes: m.size,
          parameterSize: m.details?.parameter_size,
          family: m.details?.family,
          contextLength: m.details?.context_length,
          isLocal: true,
        };
      });

      return {
        success: true,
        latencyMs,
        models,
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        latencyMs,
        models: [],
        error:
          err.name === 'TimeoutError'
            ? 'Connection timed out (5s)'
            : err.message || 'Cannot connect to Ollama server',
      };
    }
  }

  /**
   * Test an OpenAI-compatible endpoint
   */
  static async testOpenAICompatibleConnection(
    endpoint: string,
    apiKey?: string
  ): Promise<{
    success: boolean;
    latencyMs: number;
    models: ModelInfo[];
    error?: string;
  }> {
    const cleanEndpoint = endpoint.replace(/\/+$/, '');
    const startTime = performance.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

      const response = await safeFetch(`${cleanEndpoint}/models`, {
        method: 'GET',
        headers,
        timeoutMs: 6000,
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (!response.ok) {
        return {
          success: false,
          latencyMs,
          models: [],
          error: `Endpoint returned HTTP status ${response.status}`,
        };
      }

      const data = await response.json();
      const rawModels = Array.isArray(data.data) ? data.data : [];

      const models: ModelInfo[] = rawModels.map((m: any) => {
        const idLower = (m.id || '').toLowerCase();
        const capabilities: ModelCapability[] = ['text'];

        if (VISION_MODEL_KEYWORDS.some((kw) => idLower.includes(kw))) {
          capabilities.push('vision');
        }
        if (idLower.includes('embed')) {
          capabilities.push('embedding');
        }
        if (idLower.includes('whisper') || idLower.includes('audio')) {
          capabilities.push('audio');
        }

        return {
          id: m.id,
          name: m.id,
          providerId: 'custom',
          capabilities,
          isLocal: false,
        };
      });

      return {
        success: true,
        latencyMs,
        models,
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        latencyMs,
        models: [],
        error:
          err.name === 'TimeoutError'
            ? 'Connection timed out (6s)'
            : err.message || 'Failed to reach OpenAI-compatible endpoint',
      };
    }
  }

  /**
   * Send a vision prompt with a base64 image frame to Ollama or OpenAI-compatible endpoint
   */
  static async analyzeFrameWithVision(
    provider: AiProviderConfig,
    modelId: string,
    imageBase64: string,
    prompt: string,
    signal?: AbortSignal
  ): Promise<{
    summary: string;
    objects: string[];
    activity?: string;
    completionTokens?: number;
    generationSeconds?: number;
    modelStats?: ModelRuntimeStats;
  }> {
    const cleanBase64 = (imageBase64 || '').replace(/^data:image\/[a-z]+;base64,/, '').trim();
    if (!cleanBase64) {
      throw new Error('No valid image frame data provided for vision analysis');
    }

    if (provider.type === 'ollama') {
      const cleanEndpoint = provider.endpoint.replace(/\/+$/, '');
      const response = await safeFetch(`${cleanEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          prompt: `${prompt}\nRespond strictly in JSON format with fields: "summary" (string describing the scene), "objects" (array of strings), "activity" (short string describing action or "still").`,
          images: [cleanBase64],
          stream: false,
          format: 'json',
        }),
        timeoutMs: 60000,
        signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama error HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      return {
        ...parseVisionResponse(data.response || ''),
        completionTokens: Number.isFinite(data.eval_count) ? data.eval_count : undefined,
        generationSeconds:
          Number.isFinite(data.eval_duration) && data.eval_duration > 0
            ? data.eval_duration / 1_000_000_000
            : undefined,
        modelStats: ollamaRuntimeStats(data, modelId),
      };
    } else {
      // OpenAI-compatible format (compatible with OpenAI, Groq, OpenRouter, vLLM)
      const cleanEndpoint = provider.endpoint.replace(/\/+$/, '');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey.trim()}`;
      }

      const response = await safeFetch(`${cleanEndpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${prompt}\nRespond strictly in valid JSON format with fields: "summary" (string), "objects" (array of strings), "activity" (string).`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${cleanBase64}`,
                  },
                },
              ],
            },
          ],
        }),
        timeoutMs: 60000,
        signal,
      });

      if (!response.ok) {
        throw new Error(`Provider HTTP error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      return {
        ...parseVisionResponse(content),
        completionTokens: Number.isFinite(data.usage?.completion_tokens)
          ? data.usage.completion_tokens
          : undefined,
        modelStats: openAiRuntimeStats(data, modelId),
      };
    }
  }

  /**
   * Ask a vision model to decide whether two adjacent frames cross a real edit.
   * The visual detector only supplies candidates; this result controls which markers survive.
   */
  static async verifySceneCutWithVision(
    provider: AiProviderConfig,
    modelId: string,
    beforeImageBase64: string,
    afterImageBase64: string,
    signal?: AbortSignal
  ): Promise<SceneCutVerification> {
    const cleanImage = (value: string) => value.replace(/^data:image\/[a-z]+;base64,/, '').trim();
    const before = cleanImage(beforeImageBase64);
    const after = cleanImage(afterImageBase64);
    if (!before || !after) throw new Error('Both before and after frames are required for AI scene verification');

    const prompt =
      'Compare A before an edit with B after it. Is there an editorial cut? Ignore camera motion, flashes, lighting, overlays, and subtitles. Reply only JSON: {"isSceneCut":boolean,"confidence":number,"reason":"short"}.';

    let rawResponse = '';
    if (provider.type === 'ollama') {
      const endpoint = provider.endpoint.replace(/\/+$/, '');
      const response = await safeFetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          prompt,
          images: [before, after],
          stream: false,
          format: 'json',
          // Reasoning-capable vision models (including Qwen 3.5) can spend the
          // entire small response budget on their hidden reasoning and return an
          // empty `response`. A cut-review needs a short structured decision, so
          // suppress reasoning and leave enough room for the JSON payload.
          think: false,
          // Two visual inputs exceed Ollama's 4096-token default for several Qwen
          // vision models. Scope this larger context to the cut-review request.
          options: { num_ctx: 8192, num_predict: 128 },
        }),
        timeoutMs: 60000,
        signal,
      });
      if (!response.ok) throw new Error(`Ollama error HTTP ${response.status}: ${await response.text()}`);
      const data = await response.json();
      rawResponse = data.response || '';
      if (!rawResponse.trim()) {
        throw new Error(
          `The vision model returned no cut decision${data.done_reason ? ` (stopped: ${data.done_reason})` : ''}.`
        );
      }
      return {
        ...parseSceneCutVerification(rawResponse),
        modelStats: ollamaRuntimeStats(data, modelId, 8192),
      };
    } else {
      const endpoint = provider.endpoint.replace(/\/+$/, '');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
      const response = await safeFetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${before}` } },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${after}` } },
            ],
          }],
        }),
        timeoutMs: 60000,
        signal,
      });
      if (!response.ok) throw new Error(`Provider HTTP error ${response.status}: ${await response.text()}`);
      const data = await response.json();
      rawResponse = data.choices?.[0]?.message?.content || '';
      return {
        ...parseSceneCutVerification(rawResponse),
        modelStats: openAiRuntimeStats(data, modelId),
      };
    }
  }

  /**
   * Run a text completion/chat to summarize and create titled chapters from detected scenes
   */
  static async generateSmartChaptersText(
    provider: AiProviderConfig,
    modelId: string,
    prompt: string,
    signal?: AbortSignal
  ): Promise<{ content: string; modelStats: ModelRuntimeStats }> {
    if (provider.type === 'ollama') {
      const cleanEndpoint = provider.endpoint.replace(/\/+$/, '');
      const response = await safeFetch(`${cleanEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          prompt,
          stream: false,
        }),
        timeoutMs: 60000,
        signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama text error HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        content: data.response || '',
        modelStats: ollamaRuntimeStats(data, modelId),
      };
    } else {
      const cleanEndpoint = provider.endpoint.replace(/\/+$/, '');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey.trim()}`;
      }

      const response = await safeFetch(`${cleanEndpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
        }),
        timeoutMs: 60000,
        signal,
      });

      if (!response.ok) {
        throw new Error(`Provider HTTP error ${response.status}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        modelStats: openAiRuntimeStats(data, modelId),
      };
    }
  }
}
