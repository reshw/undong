import type { Workout, WorkoutType, WorkoutCategory, WorkoutTarget } from '../../types';
import { getKnownExercises } from '../normalize/normalizeText';

// Category keywords
const SNOWBOARD_KEYWORDS = ['스노보드', '스노우보드', '보드', '보딩'];
const RUNNING_KEYWORDS = ['러닝', '달리기', '조깅', '마라톤'];
const SPORTS_KEYWORDS = ['축구', '농구', '배구', '테니스', '배드민턴', '골프', '수영'];
const HOME_KEYWORDS = ['홈트', '집에서', '맨몸'];

// Type keywords
const CARDIO_KEYWORDS = ['러닝', '스텝밀', '사이클', '로잉', '조깅', '달리기', '트레드밀'];
const STRENGTH_KEYWORDS = ['플랭크', '데드버그', '푸쉬업', '풀업', '스쿼트', '벤치', '데드'];
const FLEXIBILITY_KEYWORDS = ['스트레칭', '요가', '폼롤링'];
const SKILL_KEYWORDS = ['트릭', '기물', '지빙', '박스', '레일', '스윙 연습'];

/**
 * 2축 분류: Category와 Type을 분리해서 결정
 */
const determineWorkoutCategory = (name: string): WorkoutCategory => {
  const lowerName = name.toLowerCase();

  if (SNOWBOARD_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'snowboard';
  }
  if (RUNNING_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'running';
  }
  if (SPORTS_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'sports';
  }
  if (HOME_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'home';
  }

  // 기본값: gym (헬스장 운동이 가장 일반적)
  return 'gym';
};

const determineWorkoutType = (name: string): WorkoutType => {
  const lowerName = name.toLowerCase();

  if (SKILL_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'skill';
  }
  if (CARDIO_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'cardio';
  }
  if (FLEXIBILITY_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'flexibility';
  }
  if (STRENGTH_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'strength';
  }

  const knownExercises = getKnownExercises();
  if (knownExercises.some((ex) => name.includes(ex))) {
    return 'strength';
  }

  return 'unknown';
};

/**
 * Target 결정 (근력 운동만 해당)
 */
const determineWorkoutTarget = (name: string): WorkoutTarget => {
  const lowerName = name.toLowerCase();

  // Core 운동
  const coreKeywords = ['플랭크', '크런치', '레그레이즈', '데드버그', '힐터치', '시티드 니업', '러시안 트위스트'];
  if (coreKeywords.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'core';
  }

  // Upper 운동
  const upperKeywords = ['벤치', '프레스', '풀업', '친업', '푸쉬업', '덤벨', '숄더', '레터럴', '바벨로우', '랫풀'];
  if (upperKeywords.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'upper';
  }

  // Lower 운동
  const lowerKeywords = ['스쿼트', '데드리프트', '레그프레스', '레그컬', '레그익스텐션', '런지', '칼프'];
  if (lowerKeywords.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'lower';
  }

  // Full 운동
  const fullKeywords = ['버피', '클린', '스내치', '케틀벨', '스윙'];
  if (fullKeywords.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'full';
  }

  return 'none';
};

interface ParsedNumbers {
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_min: number | null;
  distance_km: number | null;
  pace: string | null;
  speed_kph: number | null;
  incline_percent: number | null;
  resistance_level: number | null;
}

const extractNumbers = (segment: string): ParsedNumbers => {
  let sets: number | null = null;
  let reps: number | null = null;
  let weight_kg: number | null = null;
  let duration_min: number | null = null;
  let distance_km: number | null = null;
  let pace: string | null = null;
  let speed_kph: number | null = null;
  let incline_percent: number | null = null;
  let resistance_level: number | null = null;

  const setsMatch = segment.match(/(\d+)\s*세트/);
  if (setsMatch) {
    sets = parseInt(setsMatch[1], 10);
  }

  // "회", "개", "번" 모두 reps로 인식
  const repsMatch = segment.match(/(\d+)\s*(회|개|번)/);
  if (repsMatch) {
    reps = parseInt(repsMatch[1], 10);
  }

  const weightMatch = segment.match(/(\d+(?:\.\d+)?)\s*(kg|킬로|키로)/i);
  if (weightMatch) {
    weight_kg = parseFloat(weightMatch[1]);
  }

  // 거리 파싱: "2km", "10킬로", "5키로"
  const distanceMatch = segment.match(/(\d+(?:\.\d+)?)\s*(km|킬로|키로)/i);
  if (distanceMatch && !weightMatch) {
    // weight와 구분하기 위해 weightMatch가 없을 때만
    distance_km = parseFloat(distanceMatch[1]);
  }

  // 페이스 파싱: "1분 30초", "2분", "5:30"
  const paceMinSecMatch = segment.match(/(\d+)\s*분\s*(\d+)\s*초/);
  if (paceMinSecMatch) {
    const min = paceMinSecMatch[1];
    const sec = paceMinSecMatch[2];
    pace = `${min}:${sec.padStart(2, '0')}`;
  } else {
    // "2분" 형식
    const paceMinOnlyMatch = segment.match(/(\d+)\s*분(?!\s*간)/); // "분간"이 아닌 경우
    if (paceMinOnlyMatch) {
      const min = paceMinOnlyMatch[1];
      // duration과 구분: 페이스는 보통 5분 이하
      if (parseInt(min) <= 10) {
        pace = `${min}:00`;
      }
    }
  }

  // 콜론 형식: "5:30"
  const paceColonMatch = segment.match(/(\d+):(\d+)/);
  if (paceColonMatch) {
    pace = `${paceColonMatch[1]}:${paceColonMatch[2].padStart(2, '0')}`;
  }

  // "분" 패턴 (duration)
  const durationMinMatch = segment.match(/(\d+)\s*분(간)?/);
  if (durationMinMatch && !pace) {
    duration_min = parseInt(durationMinMatch[1], 10);
  }

  // "시간" 패턴 (시간을 분으로 변환)
  const durationHourMatch = segment.match(/(\d+(?:\.\d+)?)\s*시간/);
  if (durationHourMatch) {
    const hours = parseFloat(durationHourMatch[1]);
    duration_min = Math.round(hours * 60);
  }

  const multiplyMatch = segment.match(/(\d+)\s*x\s*(\d+)/i);
  if (multiplyMatch) {
    reps = parseInt(multiplyMatch[1], 10);
    sets = parseInt(multiplyMatch[2], 10);
  }

  // 속도 파싱: "5km 속도로", "시속 10km", "10km/h"
  const speedMatch = segment.match(/(?:시속\s*)?(\d+(?:\.\d+)?)\s*(?:km|킬로|키로)\s*(?:속도로|로|\/h|퍼아워)/i);
  if (speedMatch) {
    speed_kph = parseFloat(speedMatch[1]);

    // 속도와 시간이 있으면 거리 계산 (거리가 없을 때만)
    if (duration_min && !distance_km) {
      distance_km = speed_kph * (duration_min / 60);
    }
  }

  // 경사도 파싱: "인클라인 10", "경사 15%", "오르막 10"
  const inclineMatch = segment.match(/(?:인클라인|경사|오르막)\s*(\d+)(?:%|도)?/i);
  if (inclineMatch) {
    incline_percent = parseInt(inclineMatch[1], 10);
  }

  // 저항 레벨 파싱: "레벨 5", "저항 8", "기어 10"
  const resistanceMatch = segment.match(/(?:레벨|저항|기어)\s*(\d+)/i);
  if (resistanceMatch) {
    resistance_level = parseInt(resistanceMatch[1], 10);
  }

  return { sets, reps, weight_kg, duration_min, distance_km, pace, speed_kph, incline_percent, resistance_level };
};

const findExerciseName = (segment: string): string | null => {
  const knownExercises = getKnownExercises();

  for (const exercise of knownExercises) {
    if (segment.includes(exercise)) {
      return exercise;
    }
  }

  const cleaned = segment
    .replace(/\d+(?:\.\d+)?\s*시간/g, '')
    .replace(/\d+\s*분(간)?/g, '')
    .replace(/\d+\s*초/g, '')
    .replace(/\d+:\d+/g, '')
    .replace(/\d+\s*세트/g, '')
    .replace(/\d+\s*(회|개|번)/g, '')
    .replace(/\d+(?:\.\d+)?\s*(kg|킬로|키로|km)/gi, '')
    .replace(/\d+\s*x\s*\d+/gi, '')
    .replace(/빡세게|가볍게|하드하게|라이트하게|인터벌|속도|템포/g, '')
    .trim();

  if (cleaned.length > 1) {
    return cleaned;
  }

  return null;
};

export const parseWorkoutText = (normalizedText: string): Workout[] => {
  if (!normalizedText.trim()) {
    return [];
  }

  const segments = normalizedText.split(/[,.\n]/).filter((s) => s.trim());
  const workouts: Workout[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const name = findExerciseName(trimmed);
    if (!name) continue;

    const { sets, reps, weight_kg, duration_min, distance_km, pace, speed_kph, incline_percent, resistance_level } = extractNumbers(trimmed);

    // Matrix Classification: 2축 분류
    const category = determineWorkoutCategory(name);
    const type = determineWorkoutType(name);

    // Target 결정 (근력 운동만)
    const target = type === 'strength' ? determineWorkoutTarget(name) : undefined;

    // note 추출: 괄호 안 내용 또는 강도 표현
    let note: string | null = null;
    const noteMatch = trimmed.match(/\((.*?)\)/);
    if (noteMatch) {
      note = noteMatch[1];
    } else {
      // 강도/스타일 표현 추출
      const intensityMatch = trimmed.match(/(빡세게|가볍게|하드하게|라이트하게|인터벌|속도|템포|프리스타일|카빙|곤돌라|초급|중급|고급)/);
      if (intensityMatch) {
        note = intensityMatch[1];
      }
    }

    workouts.push({
      name,
      sets,
      reps,
      weight_kg,
      duration_min,
      distance_km,
      pace,
      category,
      type,
      target,
      speed_kph,
      incline_percent,
      resistance_level,
      note,
    });
  }

  return workouts;
};
