import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

function isTransientError(err: any): boolean {
  const status = err?.status ?? err?.code;
  const msg = String(err?.message || '');
  return status === 503 || status === 500 || status === 502 || msg.includes('UNAVAILABLE') || msg.includes('503');
}

export function formatGeminiError(err: any): string {
  const status = err?.status ?? err?.code;
  const raw = String(err?.message || '');
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return raw;
  }
  if (status === 403 || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return 'Gemini API authentication failed. Please verify your API key in Settings > Secrets.';
  }
  if (status === 429 || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Gemini API quota limit reached temporarily. Please pause briefly or configure a higher-tier key in Settings > Secrets.';
  }
  if (isTransientError(err)) {
    return 'Gemini AI is experiencing temporary high demand. Please retry in a few seconds.';
  }
  return 'The Gemini AI service could not complete this request. Please try again.';
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-3.6-flash';
}

/**
 * Calls ai.models.generateContent with exponential backoff retry on transient 503/5xx
 * responses, and falls back to a lightweight model if primary capacity is saturated.
 */
export async function generateContentWithRetry(
  params: GenerateContentParameters,
): Promise<{ response: GenerateContentResponse; modelUsed: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please add a valid API key in Settings > Secrets.',
    );
  }

  const primaryModel = params.model || getGeminiModel();
  const fallbackModel = primaryModel === 'gemini-3.6-flash' ? 'gemini-2.5-flash' : 'gemini-3.6-flash';
  const attemptPlan = [
    { model: primaryModel, delayMs: 0 },
    { model: primaryModel, delayMs: 900 },
    { model: fallbackModel, delayMs: 500 },
  ];

  let lastErr: any;
  for (const step of attemptPlan) {
    if (step.delayMs > 0) {
      await new Promise((r) => setTimeout(r, step.delayMs));
    }
    try {
      const response = await ai.models.generateContent({
        ...params,
        model: step.model,
      });
      return { response, modelUsed: step.model };
    } catch (err: any) {
      lastErr = err;
      if (!isTransientError(err)) {
        throw err;
      }
      console.warn(`[AIRWISE Gemini] Transient error on ${step.model}, retrying...`);
    }
  }

  const wrapped: any = new Error(formatGeminiError(lastErr));
  wrapped.status = lastErr?.status || 503;
  throw wrapped;
}
