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
