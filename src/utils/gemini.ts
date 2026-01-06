import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

export const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }

  return genAI;
};

export const generateText = async (
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<string> => {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 2048,
    },
  });

  const response = result.response;
  return response.text();
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  // Convert blob to base64
  const base64Audio = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data:audio/webm;base64, prefix
      resolve(base64.split(',')[1]);
    };
    reader.readAsDataURL(audioBlob);
  });

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: '이 음성을 한국어로 텍스트로 변환해주세요. 운동 관련 내용입니다. 변환된 텍스트만 출력하고 다른 설명은 생략하세요.',
          },
          {
            inlineData: {
              mimeType: 'audio/webm',
              data: base64Audio,
            },
          },
        ],
      },
    ],
  });

  return result.response.text();
};
