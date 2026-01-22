import type { Workout } from '../../types';

/**
 * Call the Netlify Function to parse workout text using OpenAI
 * This replaces the insecure browser-side OpenAI calls
 */
export async function parseWorkoutAPI(text: string): Promise<Workout[]> {
  if (!text.trim()) {
    return [];
  }

  try {
    const response = await fetch('/.netlify/functions/parse-workout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`API Error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    return data.workouts || [];
  } catch (error) {
    console.error('[parseWorkoutAPI] Failed to parse workout:', error);
    throw new Error('운동 파싱에 실패했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}
