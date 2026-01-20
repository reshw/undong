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
  "category": "gym" | "snowboard" | "running" | "sports" | "home" | "other",
  "type": "strength" | "cardio" | "skill" | "flexibility" | "unknown",
  "note": "추가 메모" (문자열 또는 null)
}

**중요: 2축 분류 (Matrix Classification)**
모든 운동은 반드시 category(카테고리)와 type(트레이닝 타입) 두 가지를 모두 지정해야 합니다.

1. category (카테고리) - "어디서/어떤 판에서 놀았는가?"
   - gym: 헬스장, 피트니스 센터 (웨이트, 머신, 트레드밀, 사이클 등)
   - snowboard: 스키장, 스노보드 활동
   - running: 야외 러닝, 트랙, 마라톤
   - sports: 구기/라켓 스포츠 (축구, 농구, 테니스, 골프, 수영 등)
   - home: 홈트레이닝, 집에서 운동
   - other: 기타

2. type (트레이닝 타입) - "몸을 어떻게 조졌는가?"
   - strength: 근력 운동 (웨이트 리프팅, 맨몸 근력)
   - cardio: 심폐 지구력 운동 (러닝, 사이클, 로잉, 수영)
   - skill: 기술/테크닉 연습 (스노보드 트릭, 골프 스윙, 기물 연습)
   - flexibility: 유연성/가동성 (요가, 스트레칭)
   - unknown: 분류 불가

예시: 2축 분류 적용
- "벤치프레스 80kg 10회 3세트" → category: "gym", type: "strength"
- "트레드밀에서 30분 달리기" → category: "gym", type: "cardio"
- "한강에서 5km 러닝" → category: "running", type: "cardio"
- "스노보드 관광보딩 3시간" → category: "snowboard", type: "cardio"
- "지빙(기물) 연습 10회" → category: "snowboard", type: "skill"
- "요가 60분" → category: "home", type: "flexibility"
- "푸쉬업 50개 3세트" → category: "home", type: "strength"
- "골프 스윙 연습 100회" → category: "sports", type: "skill"

측정 방식:
- 근력 운동: sets(세트), reps(횟수), weight_kg(무게)
- 유산소 운동:
  * distance_km: 거리 (km, m 단위는 km로 환산)
  * duration_min: 시간 (분)
  * pace: 페이스 ("1:30" = 1분 30초/km, "2:00" = 2분/km 형식)
  * note: 운동 스타일 ("인터벌", "템포", "속도", "LSD", "빡세게" 등)
- 기술 연습: reps(횟수), duration_min(시간)
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
- category와 type을 **반드시 모두** 지정하세요.
- "무겁게", "가볍게", "힘들었음", "인터벌", "속도", "템포" 같은 표현은 note에 포함하세요.
- 유산소 운동의 경우 거리, 시간, 페이스를 모두 파싱하세요.

예시 1: 헬스장 운동
입력: "헬스장에서 벤치프레스 80kg 10회 3세트하고 트레드밀 30분 뛰었어"
출력: [
  {"name": "벤치프레스", "sets": 3, "reps": 10, "weight_kg": 80, "duration_min": null, "distance_km": null, "pace": null, "category": "gym", "type": "strength", "note": null},
  {"name": "트레드밀", "sets": null, "reps": null, "weight_kg": null, "duration_min": 30, "distance_km": null, "pace": null, "category": "gym", "type": "cardio", "note": null}
]

예시 2: 야외 러닝
입력: "한강에서 5km 달리기 인터벌"
출력: [
  {"name": "달리기", "sets": null, "reps": null, "weight_kg": null, "duration_min": null, "distance_km": 5, "pace": null, "category": "running", "type": "cardio", "note": "인터벌"}
]

예시 3: 스노보드 (지구력 vs 기술)
입력: "스노보드 3시간 빡세게 탔고 기물 연습 10회 했어"
출력: [
  {"name": "스노보드 라이딩", "sets": null, "reps": null, "weight_kg": null, "duration_min": 180, "distance_km": null, "pace": null, "category": "snowboard", "type": "cardio", "note": "빡세게"},
  {"name": "기물 연습", "sets": null, "reps": 10, "weight_kg": null, "duration_min": null, "distance_km": null, "pace": null, "category": "snowboard", "type": "skill", "note": null}
]

예시 4: 홈트레이닝
입력: "집에서 푸쉬업 50개 3세트 플랭크 2분"
출력: [
  {"name": "푸쉬업", "sets": 3, "reps": 50, "weight_kg": null, "duration_min": null, "distance_km": null, "pace": null, "category": "home", "type": "strength", "note": null},
  {"name": "플랭크", "sets": null, "reps": null, "weight_kg": null, "duration_min": 2, "distance_km": null, "pace": null, "category": "home", "type": "strength", "note": null}
]`;

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
