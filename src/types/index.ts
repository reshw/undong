export type RecordingState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'parsing'
  | 'review'
  | 'error';

export type WorkoutType = 'strength' | 'cardio' | 'core' | 'mobility' | 'unknown';

export interface Workout {
  name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_min: number | null;
  type: WorkoutType;
  note: string | null;
}

export interface WorkoutLog {
  id: string;
  date: string; // YYYY-MM-DD
  rawText: string;
  normalizedText: string;
  workouts: Workout[];
  memo: string | null;
  createdAt: number;
}

export interface SpeechRecognitionHookResult {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export interface UserProfile {
  goals: string; // AI가 정리한 운동 목표 및 배경
  rawInput?: string; // 사용자가 입력한 원본 텍스트 (참고용)
  createdAt: number;
  updatedAt: number;
}

export interface TodoWorkout {
  name: string;
  sets?: number;
  reps?: number;
  weight_kg?: number;
  duration_min?: number;
  note?: string;
  completed: boolean;
}

export interface DailyTodo {
  id: string;
  date: string; // YYYY-MM-DD
  source: 'ai_recommendation' | 'manual'; // AI 추천인지 수동 추가인지
  aiRecommendation?: string; // AI가 추천한 원문 텍스트
  workouts: TodoWorkout[];
  createdAt: number;
}
