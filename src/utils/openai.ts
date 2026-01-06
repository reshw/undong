import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export const getOpenAIClient = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.');
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // 브라우저에서 직접 사용 (프로덕션에서는 백엔드 권장)
    });
  }

  return openaiClient;
};

export const generateTextWithGPT = async (
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo';
  }
): Promise<string> => {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: options?.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  });

  return completion.choices[0]?.message?.content || '';
};
