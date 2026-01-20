import type { Workout } from '../../types';
import { generateText } from '../../utils/gemini';

const SYSTEM_PROMPT = `당신은 운동 데이터를 분석하고 구조화하는 전문가입니다.
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
  "target": "upper" | "lower" | "core" | "full" | "none" (근력 운동만 해당, 선택적),
  "speed_kph": 속도(km/h) (숫자 또는 null, 유산소만),
  "incline_percent": 경사도(%) (숫자 또는 null, 트레드밀/러닝),
  "resistance_level": 저항 레벨 (숫자 또는 null, 사이클/로잉),
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

3. target (타겟 부위) - **근력 운동(type: strength)만 해당** (선택적)
   - upper: 상체 (벤치프레스, 덤벨프레스, 풀업, 숄더프레스, 바벨로우)
   - lower: 하체 (스쿼트, 데드리프트, 레그프레스, 레그컬, 런지)
   - core: 코어/복근 (플랭크, 크런치, 레그레이즈, 데드버그, 힐터치)
   - full: 전신 (버피, 클린앤저크, 케틀벨 스윙)
   - none: 미지정 (기본값)

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
- 근력 운동: sets(세트), reps(횟수), weight_kg(무게), target(타겟 부위)
- 유산소 운동:
  * distance_km: 거리 (km, m 단위는 km로 환산)
  * duration_min: 시간 (분)
  * pace: 페이스 ("1:30" = 1분 30초/km, "2:00" = 2분/km 형식)
  * speed_kph: 속도 (km/h)
  * incline_percent: 경사도 (%)
  * resistance_level: 저항 레벨
  * note: 운동 스타일 ("인터벌", "템포", "속도", "LSD", "빡세게" 등)
- 기술 연습: reps(횟수), duration_min(시간)
- 스노보드:
  * duration_min: "3시간", "120분" → 시간으로 기록
  * reps: "10번", "15회 run" → 탄 횟수로 기록
  * note: 강도("빡세게", "가볍게"), 스타일("프리스타일", "카빙"), 구간("곤돌라", "초급 슬로프") 등

**중요: 유산소 운동 속도/거리 계산 규칙 (Disambiguation Logic)**

사용자가 "5km 속도로 30분" 같이 말하면, 이는 "5km/h의 속도로 30분 동안"을 의미합니다.
당신은 데이터 분석가이므로 **모호함을 해결(Disambiguate)**하고 **계산(Calculate)**해야 합니다.

1. **속도 vs 거리 구분 (CRITICAL)**
   Rule A: 다음 패턴은 **속도(Speed)**로 해석:
   - "5km 속도로", "5km로", "5km/h로", "시속 5km"
   - "5킬로 속도", "5키로로"
   - Context: "속도" 단어가 있거나, 뒤에 "~로" 조사가 붙음

   Rule B: 다음 패턴은 **거리(Distance)**로 해석:
   - "5km 달렸어", "5km 완주", "5km 뛰었어", "5km 걸었어"
   - "5킬로 갔어", "5키로 완료"
   - Context: 동작 동사(달리다, 뛰다, 걷다, 가다)와 함께

   Rule C: **애매한 경우 (Default Rule)**
   - "5km" 단독 → 문맥 판단:
     * 시간이 함께 있고 페이스가 없으면 → 거리로 추정
     * 예: "5km 30분" → distance: 5km, duration: 30min (거리 우선)
     * 예: "5km 1분 30초" → distance: 5km, pace: "1:30" (페이스 포함 → 거리)

2. **자동 계산 (AUTO-CALCULATION)**
   IF speed_kph AND duration_min AND NOT distance_km:
     👉 distance_km = speed_kph * (duration_min / 60)
     Example: "5km 속도로 30분" → speed: 5, duration: 30, distance: 2.5 (calculated)

   IF distance_km AND duration_min AND NOT speed_kph:
     👉 speed_kph = (distance_km / duration_min) * 60
     Example: "5km 30분" → distance: 5, duration: 30, speed: 10 (calculated)

3. **경사도 추출 (Intensity Modifier)**
   - "인클라인 10", "경사 15%", "오르막 10도" → incline_percent: 10 or 15
   - 경사도는 난이도를 높이는 변수

4. **저항 레벨 추출 (Resistance)**
   - "레벨 5", "저항 8", "기어 10" → resistance_level: 5, 8, 10 (사이클, 로잉)

5. **디버깅 힌트**
   사용자가 "5km"라고만 말하면:
   1) 앞뒤 문맥 확인 (동사 있나? "속도" 단어 있나?)
   2) 시간 정보 있나? → 있으면 거리로 간주 (Rule C)
   3) 페이스 정보 있나? → 있으면 거리로 간주 (Rule C)

유산소 운동 파싱 예시 (Disambiguation 적용):
- "2km 달리기 인터벌" → distance_km: 2, note: "인터벌" (동사 "달리기" → 거리)
- "8km 속도 1분 30초" → distance_km: 8, pace: "1:30", note: "속도" (거리 + 페이스)
- "5km 속도로 30분 뛰었어" → speed_kph: 5, duration_min: 30, distance_km: 2.5 (속도 + 시간 → 거리 계산)
- "5km 30분" → distance_km: 5, duration_min: 30 (애매 → 거리 우선 Rule C)
- "인클라인 10으로 20분 걸었어" → duration_min: 20, incline_percent: 10 (동사 "걸었어" → cardio)
- "사이클 레벨 8로 40분" → duration_min: 40, resistance_level: 8 (저항 추출)
- "10km로 1시간 뛰었어" → speed_kph: 10, duration_min: 60, distance_km: 10 (속도 + 계산)
- 페이스는 반드시 "분:초" 형식으로 변환 (예: "1분 30초" → "1:30", "2분" → "2:00")

주의사항:
- **CRITICAL**: 반드시 유효한 JSON 배열만 반환하세요. 마크다운 코드 블록을 절대 사용하지 마세요!
- 올바른 형식: [{"name": "...", ...}]
- 잘못된 형식: 마크다운 블록으로 감싸는 것
- 추가 설명이나 마크다운 없이 순수 JSON 배열만 반환하세요.
- 숫자가 없으면 null을 사용하세요.
- category와 type을 **반드시 모두** 지정하세요.
- "무겁게", "가볍게", "힘들었음", "인터벌", "속도", "템포" 같은 표현은 note에 포함하세요.
- 유산소 운동의 경우 거리, 시간, 페이스를 모두 파싱하세요.

예시 1: 헬스장 운동 (target 필드 포함)
입력: "헬스장에서 벤치프레스 80kg 10회 3세트하고 스쿼트 100kg 5세트 8회"
출력: [
  {"name": "벤치프레스", "sets": 3, "reps": 10, "weight_kg": 80, "duration_min": null, "distance_km": null, "pace": null, "category": "gym", "type": "strength", "target": "upper", "note": null},
  {"name": "스쿼트", "sets": 5, "reps": 8, "weight_kg": 100, "duration_min": null, "distance_km": null, "pace": null, "category": "gym", "type": "strength", "target": "lower", "note": null}
]

예시 2: 속도/거리 계산
입력: "트레드밀 5km 속도로 30분 뛰었어"
출력: [
  {"name": "트레드밀", "sets": null, "reps": null, "weight_kg": null, "duration_min": 30, "distance_km": 2.5, "pace": null, "speed_kph": 5, "category": "gym", "type": "cardio", "note": null}
]
설명: 5km/h * (30분 / 60) = 2.5km

예시 3: 경사도 포함
입력: "인클라인 10으로 20분 걸었어"
출력: [
  {"name": "걷기", "sets": null, "reps": null, "weight_kg": null, "duration_min": 20, "distance_km": null, "pace": null, "incline_percent": 10, "category": "gym", "type": "cardio", "note": null}
]

예시 4: 코어 운동 (target: core)
입력: "집에서 플랭크 3분하고 크런치 50개 3세트"
출력: [
  {"name": "플랭크", "sets": null, "reps": null, "weight_kg": null, "duration_min": 3, "distance_km": null, "pace": null, "category": "home", "type": "strength", "target": "core", "note": null},
  {"name": "크런치", "sets": 3, "reps": 50, "weight_kg": null, "duration_min": null, "distance_km": null, "pace": null, "category": "home", "type": "strength", "target": "core", "note": null}
]

예시 5: 스노보드
입력: "스노보드 3시간 빡세게 탔고 기물 연습 10회 했어"
출력: [
  {"name": "스노보드 라이딩", "sets": null, "reps": null, "weight_kg": null, "duration_min": 180, "distance_km": null, "pace": null, "category": "snowboard", "type": "cardio", "note": "빡세게"},
  {"name": "기물 연습", "sets": null, "reps": 10, "weight_kg": null, "duration_min": null, "distance_km": null, "pace": null, "category": "snowboard", "type": "skill", "note": null}
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
      { temperature: 0.3, maxOutputTokens: 4000 }
    );

    console.log('[Gemini] Content:', content);

    if (!content) {
      throw new Error('Gemini 응답이 비어있습니다.');
    }

    // 마크다운 코드 블록 제거 (```json ... ``` 또는 ``` ... ```)
    let cleanedContent = content.trim();
    cleanedContent = cleanedContent.replace(/^`{3}json\s*/i, '').replace(/^`{3}\s*/, '');
    cleanedContent = cleanedContent.replace(/\s*`{3}$/, '');

    // JSON 배열 추출
    const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[Gemini] No JSON found in content:', content);
      console.error('[Gemini] Cleaned content:', cleanedContent);
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
