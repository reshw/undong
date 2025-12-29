import type { Workout } from '../../types';

const SYSTEM_PROMPT = `당신은 운동 기록을 구조화하는 전문가입니다.
사용자가 말한 운동 내용을 JSON 배열로 변환해주세요.

각 운동은 다음 형식을 따릅니다:
{
  "name": "운동명",
  "sets": 세트 수 (숫자 또는 null),
  "reps": 반복 횟수 (숫자 또는 null),
  "duration_min": 시간(분) (숫자 또는 null),
  "type": "strength" | "cardio" | "core" | "mobility" | "unknown",
  "note": "추가 메모" (문자열 또는 null)
}

운동 타입 분류:
- strength: 근력 운동 (푸시업, 벤치프레스, 스쿼트 등)
- cardio: 유산소 운동 (러닝, 사이클, 로잉 등)
- core: 코어 운동 (플랭크, 크런치, 데드버그 등)
- mobility: 유연성/가동성 운동 (스트레칭, 요가 등)
- unknown: 분류 불가

주의사항:
- 반드시 유효한 JSON 배열만 반환하세요.
- 추가 설명이나 마크다운 없이 JSON만 반환하세요.
- 숫자가 없으면 null을 사용하세요.
- "무겁게", "가볍게", "힘들었음" 같은 표현은 note에 포함하세요.`;

export const parseWithGPT = async (text: string): Promise<Workout[]> => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.');
  }

  if (!text.trim()) {
    return [];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `다음 운동 기록을 JSON 배열로 변환해주세요:\n\n${text}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`GPT API error: ${errorData.error?.message || response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('GPT 응답이 비어있습니다.');
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('유효한 JSON을 찾을 수 없습니다.');
    }

    const workouts = JSON.parse(jsonMatch[0]) as Workout[];
    return workouts;
  } catch (err) {
    console.error('GPT parsing error:', err);
    throw err;
  }
};
