import type { Workout } from '../../types';
import { generateText } from '../../utils/gemini';

const SYSTEM_PROMPT = `당신은 운동 기록을 구조화하는 전문가입니다.
사용자가 말한 운동 내용을 JSON 배열로 변환해주세요.

각 운동은 다음 형식을 따릅니다:
{
  "name": "운동명",
  "sets": 세트 수 (숫자 또는 null),
  "reps": 반복 횟수 (숫자 또는 null),
  "weight_kg": 무게(kg) (숫자 또는 null),
  "duration_min": 시간(분) (숫자 또는 null),
  "distance_km": 거리(km) (숫자 또는 null),
  "pace": 페이스 "분:초" 형식 (문자열 또는 null, 예: "5:30" = 5분 30초/km),
  "type": "strength" | "cardio" | "core" | "mobility" | "snowboard" | "unknown",
  "note": "추가 메모" (문자열 또는 null)
}

운동 타입 분류:
- strength: 근력 운동 (푸시업, 벤치프레스, 스쿼트 등)
- cardio: 유산소 운동 (러닝, 달리기, 사이클, 로잉 등)
- core: 코어 운동 (플랭크, 크런치, 데드버그 등)
- mobility: 유연성/가동성 운동 (스트레칭, 요가 등)
- snowboard: 스노보드 활동
- unknown: 분류 불가

측정 방식:
- 근력 운동: sets(세트), reps(횟수), weight_kg(무게)
- 유산소 운동:
  * distance_km: 거리 (km, m 단위는 km로 환산)
  * duration_min: 시간 (분)
  * pace: 페이스 ("1:30" = 1분 30초/km, "2:00" = 2분/km 형식)
  * note: 운동 스타일 ("인터벌", "템포", "속도", "LSD", "빡세게" 등)
- 코어 운동: reps(횟수), sets(세트), duration_min(시간)
- 스노보드:
  * duration_min: "3시간", "120분" → 시간으로 기록
  * reps: "10번", "15회 run" → 탄 횟수로 기록
  * note: 강도("빡세게", "가볍게"), 스타일("프리스타일", "카빙"), 구간("곤돌라", "초급 슬로프") 등

유산소 운동 파싱 규칙:
- "2km 달리기 인터벌" → distance_km: 2, note: "인터벌"
- "8km 속도 1분 30초" → distance_km: 8, pace: "1:30", note: "속도"
- "6km 2분" → distance_km: 6, pace: "2:00"
- "10km 완주" → distance_km: 10
- 페이스는 반드시 "분:초" 형식으로 변환 (예: "1분 30초" → "1:30", "2분" → "2:00")

주의사항:
- 반드시 유효한 JSON 배열만 반환하세요.
- 추가 설명이나 마크다운 없이 JSON만 반환하세요.
- 숫자가 없으면 null을 사용하세요.
- "무겁게", "가볍게", "힘들었음", "인터벌", "속도", "템포" 같은 표현은 note에 포함하세요.
- 유산소 운동의 경우 거리, 시간, 페이스를 모두 파싱하세요.
- 스노보드의 경우 시간과 횟수를 둘 다 기록할 수 있습니다.

예시:
입력: "2km 달리기 인터벌 8km 속도 1분 30초 6km 2분 데드버그 10회 2세트"
출력: [
  {"name": "달리기", "sets": null, "reps": null, "weight_kg": null, "duration_min": null, "distance_km": 2, "pace": null, "type": "cardio", "note": "인터벌"},
  {"name": "달리기", "sets": null, "reps": null, "weight_kg": null, "duration_min": null, "distance_km": 8, "pace": "1:30", "type": "cardio", "note": "속도"},
  {"name": "달리기", "sets": null, "reps": null, "weight_kg": null, "duration_min": null, "distance_km": 6, "pace": "2:00", "type": "cardio", "note": null},
  {"name": "데드버그", "sets": 2, "reps": 10, "weight_kg": null, "duration_min": null, "distance_km": null, "pace": null, "type": "core", "note": null}
]

입력: "스노보드 3시간 빡세게 탔어요"
출력: [{"name": "스노보드", "sets": null, "reps": null, "weight_kg": null, "duration_min": 180, "distance_km": null, "pace": null, "type": "snowboard", "note": "빡세게"}]

입력: "벤치프레스 80kg 10회 3세트"
출력: [{"name": "벤치프레스", "sets": 3, "reps": 10, "weight_kg": 80, "duration_min": null, "distance_km": null, "pace": null, "type": "strength", "note": null}]`;

export const parseWithGPT = async (text: string): Promise<Workout[]> => {
  console.log('[Gemini] Input text:', text);

  if (!text.trim()) {
    console.log('[Gemini] Empty text, returning empty array');
    return [];
  }

  try {
    console.log('[Gemini] Sending request to Gemini...');

    const content = await generateText(
      SYSTEM_PROMPT,
      `다음 운동 기록을 JSON 배열로 변환해주세요:\n\n${text}`,
      { temperature: 0.3, maxOutputTokens: 2000 }
    );

    console.log('[Gemini] Content:', content);

    if (!content) {
      throw new Error('Gemini 응답이 비어있습니다.');
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[Gemini] No JSON found in content:', content);
      throw new Error('유효한 JSON을 찾을 수 없습니다.');
    }

    const workouts = JSON.parse(jsonMatch[0]) as Workout[];
    console.log('[Gemini] Parsed workouts:', workouts);
    return workouts;
  } catch (err) {
    console.error('[Gemini] Parsing error:', err);
    throw err;
  }
};
