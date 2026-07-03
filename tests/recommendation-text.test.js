import { describe, expect, it, vi } from 'vitest';
import { generateRecommendationText } from '../src/services/recommendationText.service.js';

const silentLogger = { error: vi.fn() };

describe('Generacion de texto para recomendaciones', () => {
  it('usa fallback sin llamar a red cuando no hay API key', async () => {
    const fetchImpl = vi.fn();

    const result = await generateRecommendationText({
      prompt: 'prompt',
      fallback: 'texto local',
      apiKey: '',
      fetchImpl,
      logger: silentLogger,
    });

    expect(result).toEqual({ message: 'texto local', source: 'fallback' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('devuelve y marca la respuesta valida de Gemini', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'recomendacion IA' }] } }],
      }),
    });

    const result = await generateRecommendationText({
      prompt: 'prompt controlado',
      fallback: 'texto local',
      apiKey: 'test-key',
      modelName: 'test-model',
      fetchImpl,
      logger: silentLogger,
    });

    expect(result).toEqual({ message: 'recomendacion IA', source: 'gemini' });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      contents: [{ parts: [{ text: 'prompt controlado' }] }],
    });
  });

  it('usa fallback cuando Gemini responde con error HTTP', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    });

    const result = await generateRecommendationText({
      prompt: 'prompt',
      fallback: 'texto local',
      apiKey: 'test-key',
      fetchImpl,
      logger: silentLogger,
    });

    expect(result).toEqual({ message: 'texto local', source: 'fallback' });
  });

  it('usa fallback cuando la respuesta no contiene texto', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });

    const result = await generateRecommendationText({
      prompt: 'prompt',
      fallback: 'texto local',
      apiKey: 'test-key',
      fetchImpl,
      logger: silentLogger,
    });

    expect(result).toEqual({ message: 'texto local', source: 'fallback' });
  });

  it('usa fallback cuando falla la conexion', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network unavailable'));

    const result = await generateRecommendationText({
      prompt: 'prompt',
      fallback: 'texto local',
      apiKey: 'test-key',
      fetchImpl,
      logger: silentLogger,
    });

    expect(result).toEqual({ message: 'texto local', source: 'fallback' });
  });

  it('cancela la llamada y usa fallback cuando se supera el timeout', async () => {
    const fetchImpl = vi.fn((_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')));
      })
    );

    const result = await generateRecommendationText({
      prompt: 'prompt',
      fallback: 'texto local',
      apiKey: 'test-key',
      fetchImpl,
      logger: silentLogger,
      timeoutMs: 5,
    });

    expect(result).toEqual({ message: 'texto local', source: 'fallback' });
  });
});
