import { env } from '../config/env.js';

export const DEFAULT_GEMINI_MODEL_NAME = 'gemini-2.5-flash';

export const getGeminiModelName = () =>
  env.GEMINI_MODEL_NAME || DEFAULT_GEMINI_MODEL_NAME;

export const generateRecommendationText = async ({
  prompt,
  fallback,
  apiKey = env.GEMINI_API_KEY,
  modelName = getGeminiModelName(),
  fetchImpl = globalThis.fetch,
  logger = console,
  timeoutMs = 8000,
} = {}) => {
  if (!apiKey) {
    return { message: fallback, source: 'fallback' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Recomendaciones IA] Gemini respondio con error', {
        status: response.status,
        modelName,
        body: errorText,
      });
      return { message: fallback, source: 'fallback' };
    }

    const json = await response.json();
    const message = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return message
      ? { message, source: 'gemini' }
      : { message: fallback, source: 'fallback' };
  } catch (error) {
    logger.error('[Recomendaciones IA] No se pudo contactar Gemini', {
      modelName,
      message: error.message,
    });
    return { message: fallback, source: 'fallback' };
  } finally {
    clearTimeout(timeout);
  }
};
