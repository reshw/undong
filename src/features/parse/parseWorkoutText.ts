import type { Workout, WorkoutType } from '../../types';
import { getKnownExercises } from '../normalize/normalizeText';

const CARDIO_KEYWORDS = ['러닝', '스텝밀', '사이클', '로잉', '조깅', '달리기'];
const CORE_KEYWORDS = ['플랭크', '데드버그', '크런치', '레그레이즈', '사이드플랭크'];
const MOBILITY_KEYWORDS = ['스트레칭', '요가', '폼롤링'];
const SNOWBOARD_KEYWORDS = ['스노보드', '스노우보드', '보드', '보딩'];

const determineWorkoutType = (name: string): WorkoutType => {
  const lowerName = name.toLowerCase();

  if (SNOWBOARD_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'snowboard';
  }
  if (CARDIO_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'cardio';
  }
  if (CORE_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'core';
  }
  if (MOBILITY_KEYWORDS.some((kw) => lowerName.includes(kw.toLowerCase()))) {
    return 'mobility';
  }

  const knownExercises = getKnownExercises();
  if (knownExercises.some((ex) => name.includes(ex))) {
    return 'strength';
  }

  return 'unknown';
};

interface ParsedNumbers {
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_min: number | null;
  distance_km: number | null;
  pace: string | null;
}

const extractNumbers = (segment: string): ParsedNumbers => {
  let sets: number | null = null;
  let reps: number | null = null;
  let weight_kg: number | null = null;
  let duration_min: number | null = null;
  let distance_km: number | null = null;
  let pace: string | null = null;

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

  return { sets, reps, weight_kg, duration_min, distance_km, pace };
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

    const { sets, reps, weight_kg, duration_min, distance_km, pace } = extractNumbers(trimmed);

    const type = determineWorkoutType(name);

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
      type,
      note,
    });
  }

  return workouts;
};
