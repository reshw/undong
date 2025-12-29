import type { Workout, WorkoutType } from '../../types';
import { getKnownExercises } from '../normalize/normalizeText';

const CARDIO_KEYWORDS = ['러닝', '스텝밀', '사이클', '로잉', '조깅', '달리기'];
const CORE_KEYWORDS = ['플랭크', '데드버그', '크런치', '레그레이즈', '사이드플랭크'];
const MOBILITY_KEYWORDS = ['스트레칭', '요가', '폼롤링'];

const determineWorkoutType = (name: string): WorkoutType => {
  const lowerName = name.toLowerCase();

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
  duration_min: number | null;
}

const extractNumbers = (segment: string): ParsedNumbers => {
  let sets: number | null = null;
  let reps: number | null = null;
  let duration_min: number | null = null;

  const setsMatch = segment.match(/(\d+)\s*세트/);
  if (setsMatch) {
    sets = parseInt(setsMatch[1], 10);
  }

  const repsMatch = segment.match(/(\d+)\s*(회|개)/);
  if (repsMatch) {
    reps = parseInt(repsMatch[1], 10);
  }

  const durationMatch = segment.match(/(\d+)\s*분(간)?/);
  if (durationMatch) {
    duration_min = parseInt(durationMatch[1], 10);
  }

  const multiplyMatch = segment.match(/(\d+)\s*x\s*(\d+)/i);
  if (multiplyMatch) {
    reps = parseInt(multiplyMatch[1], 10);
    sets = parseInt(multiplyMatch[2], 10);
  }

  return { sets, reps, duration_min };
};

const findExerciseName = (segment: string): string | null => {
  const knownExercises = getKnownExercises();

  for (const exercise of knownExercises) {
    if (segment.includes(exercise)) {
      return exercise;
    }
  }

  const cleaned = segment
    .replace(/\d+\s*세트/g, '')
    .replace(/\d+\s*(회|개)/g, '')
    .replace(/\d+\s*분(간)?/g, '')
    .replace(/\d+\s*x\s*\d+/gi, '')
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

    const { sets, reps, duration_min } = extractNumbers(trimmed);

    const type = determineWorkoutType(name);

    const noteMatch = trimmed.match(/\((.*?)\)/);
    const note = noteMatch ? noteMatch[1] : null;

    workouts.push({
      name,
      sets,
      reps,
      duration_min,
      type,
      note,
    });
  }

  return workouts;
};
