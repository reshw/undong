import { generateText as generateWithGemini } from './gemini';
import { generateTextWithGPT } from './openai';

export type AIProvider = 'gemini' | 'openai';

interface GenerateTextOptions {
  temperature?: number;
  maxTokens?: number;
  provider?: AIProvider;
  model?: string;
}

/**
 * 통합 AI 텍스트 생성 함수
 * 여러 AI 제공자를 선택해서 사용 가능
 */
export const generateTextWithAI = async (
  systemPrompt: string,
  userPrompt: string,
  options?: GenerateTextOptions
): Promise<string> => {
  const provider = options?.provider || getDefaultProvider();

  try {
    if (provider === 'openai') {
      return await generateTextWithGPT(systemPrompt, userPrompt, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        model: options?.model as any,
      });
    } else {
      // Gemini (default)
      return await generateWithGemini(systemPrompt, userPrompt, {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      });
    }
  } catch (error) {
    console.error(`[AI] ${provider} 실패:`, error);
    // Fallback: 다른 제공자 시도
    const fallbackProvider: AIProvider = provider === 'openai' ? 'gemini' : 'openai';
    console.log(`[AI] Fallback to ${fallbackProvider}`);

    if (fallbackProvider === 'openai') {
      return await generateTextWithGPT(systemPrompt, userPrompt, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });
    } else {
      return await generateWithGemini(systemPrompt, userPrompt, {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      });
    }
  }
};

/**
 * 사용 가능한 AI 제공자 확인
 */
export const getAvailableProviders = (): AIProvider[] => {
  const providers: AIProvider[] = [];

  if (import.meta.env.VITE_GEMINI_API_KEY) {
    providers.push('gemini');
  }

  if (import.meta.env.VITE_OPENAI_API_KEY) {
    providers.push('openai');
  }

  return providers;
};

/**
 * 기본 AI 제공자 결정
 */
export const getDefaultProvider = (): AIProvider => {
  // OpenAI 키가 있으면 우선 사용
  if (import.meta.env.VITE_OPENAI_API_KEY) {
    return 'openai';
  }

  return 'gemini';
};

/**
 * 바이브코딩: 여러 AI로부터 결과를 받아 종합
 * (선택적 고급 기능)
 */
export const generateWithMultipleAI = async (
  systemPrompt: string,
  userPrompt: string,
  options?: Omit<GenerateTextOptions, 'provider'>
): Promise<{
  gemini?: string;
  openai?: string;
  combined?: string;
}> => {
  const results: {
    gemini?: string;
    openai?: string;
    combined?: string;
  } = {};

  const availableProviders = getAvailableProviders();

  // 병렬로 모든 제공자에게 요청
  const promises = availableProviders.map(async (provider) => {
    try {
      const result = await generateTextWithAI(systemPrompt, userPrompt, {
        ...options,
        provider,
      });
      return { provider, result };
    } catch (error) {
      console.error(`[Multi-AI] ${provider} 실패:`, error);
      return { provider, result: null };
    }
  });

  const responses = await Promise.all(promises);

  responses.forEach(({ provider, result }) => {
    if (result) {
      if (provider === 'gemini') results.gemini = result;
      if (provider === 'openai') results.openai = result;
    }
  });

  // 결과 종합 (옵션)
  if (results.gemini && results.openai) {
    results.combined = `=== Gemini 추천 ===\n${results.gemini}\n\n=== OpenAI 추천 ===\n${results.openai}`;
  } else {
    results.combined = results.gemini || results.openai;
  }

  return results;
};
