import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import * as Schemas from "./aiParserSchema";
import type { Workout, WorkoutCategory, WorkoutType, WorkoutTarget } from "../../types";

// OpenAI client initialization
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Required for client-side usage
});

// Use gpt-4o-mini (validated in test-parser)
const MODEL = "gpt-4o-mini";

// =================================================================
// 🔪 Step 1: The Shredder (입력 분쇄기)
// =================================================================
async function shredInput(input: string): Promise<Schemas.ShreddedSegment[]> {
  const completion = await openai.beta.chat.completions.parse({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `
You are a Text Shredder. Your ONLY job is to split workout logs into distinct, self-contained segments.

[RULES]
1. **Split by Activity:** "Run 30m and Bench 60kg" -> [Segment 1: Run], [Segment 2: Bench].
2. **Context Preservation:** Keep the numbers with their exercise. "Squat 100kg 5 sets" is ONE segment.
3. **Compound Sets:** "Superset: Bench and Row" -> Split into TWO segments ("Bench", "Row").
4. **Intervals:** "Run fast 10m then walk 10m" -> Split into TWO segments.
5. **Assign Category:**
   - 'strength': Weights, Machines, Bodyweight (Pullup, Pushup).
   - 'cardio': Run, Walk, Cycle, Stepmill, Row, Swim.
   - 'snowboard': Ski, Snowboard.

[EXAMPLES]
In: "런닝 20분 뛰고 벤치 60 5세트"
Out: [
  { text: "런닝 20분", category: "cardio", item_name_hint: "running" },
  { text: "벤치 60 5세트", category: "strength", item_name_hint: "bench_press" }
]
`
      },
      { role: "user", content: input },
    ],
    response_format: zodResponseFormat(Schemas.ShredderResponseSchema, "shredder_output"),
  });

  return completion.choices[0].message.parsed?.segments || [];
}

// =================================================================
// 🏃 Step 2A: Cardio Specialist
// =================================================================
async function parseCardio(text: string, hint: string): Promise<Schemas.CardioResult | null> {
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `
You are a Cardio Specialist. Extract metrics accurately.

[CRITICAL RULES]
1. **Particles (조사):**
   - "~로" (Instrumental) -> **Speed** or **Pace**. (e.g. "6km로" -> Speed: 6)
   - "~를/을" (Objective) -> **Distance**. (e.g. "6km를" -> Distance: 6)
   - Ambiguous -> **Distance**.
2. **Stepmill (천국의 계단):**
   - Name MUST be "stepmill".
   - Value goes to **floors**.
   - **distance_km** MUST be NULL.
3. **Null Handling:**
   - Use NULL for missing data. **NEVER use 0**.
4. **Name Normalization:**
   - "따릉이/자전거" -> "cycle"
   - "런닝" -> "running"
   - "로잉" -> "rowing"
   - "등산" -> "hiking"
   - "수영" -> "swimming"
`
        },
        { role: "user", content: `Hint: ${hint}\nInput: ${text}` },
      ],
      response_format: zodResponseFormat(Schemas.CardioResultSchema, "cardio_result"),
    });
    return completion.choices[0].message.parsed || null;
  } catch (error) {
    console.error("[aiParser] Cardio parsing error:", error);
    return null;
  }
}

// =================================================================
// 🏋️ Step 2B: Strength Specialist
// =================================================================
async function parseStrength(text: string, hint: string): Promise<Schemas.StrengthResult | null> {
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `
You are a Strength Specialist. Extract metrics accurately.

[CRITICAL RULES]
1. **Units:**
   - "kg", "키로" -> **weight_kg**.
   - "세트", "set" -> **sets**.
   - "회", "개", "reps" -> **reps**.
2. **Bodyweight Exercises:**
   - For Pullups, Pushups, Dips -> **weight_kg is NULL** (unless weighted vest mentioned).
   - Do NOT guess bodyweight.
3. **Null Handling:**
   - Use NULL for missing data. **NEVER use 0**.
4. **Name Examples:**
   - "벤치" -> "bench press"
   - "스쿼트" -> "squat"
   - "등 조짐" -> "back training"
`
        },
        { role: "user", content: `Hint: ${hint}\nInput: ${text}` },
      ],
      response_format: zodResponseFormat(Schemas.StrengthResultSchema, "strength_result"),
    });
    return completion.choices[0].message.parsed || null;
  } catch (error) {
    console.error("[aiParser] Strength parsing error:", error);
    return null;
  }
}

// =================================================================
// 🏂 Step 2C: Snowboard Parser
// =================================================================
async function parseSnowboard(text: string): Promise<Schemas.SnowboardResult | null> {
  // Simple extraction for snowboard
  const durationMatch = text.match(/(\d+)\s*(시간|분)/);
  const runCountMatch = text.match(/(\d+)\s*(회|번|런)/);

  return {
    name: "스노보드",
    duration_min: durationMatch ? (durationMatch[2] === '시간' ? parseInt(durationMatch[1]) * 60 : parseInt(durationMatch[1])) : null,
    run_count: runCountMatch ? parseInt(runCountMatch[1]) : null,
    note: text.includes('빡세게') ? '빡세게' : text.includes('가볍게') ? '가볍게' : null,
  };
}

// =================================================================
// 🎛️ Step 3: Orchestrator & Mapper
// =================================================================

/**
 * Map internal category to Workout category + type
 */
function mapToWorkoutCategoryAndType(
  internalCategory: Schemas.InternalCategory,
  name: string
): { category: WorkoutCategory; type: WorkoutType } {
  switch (internalCategory) {
    case 'cardio': {
      // Cardio type은 'cardio'
      // Category는 이름으로 판단
      const lowerName = name.toLowerCase();
      if (lowerName.includes('running') || lowerName.includes('조깅')) {
        return { category: 'running', type: 'cardio' };
      }
      return { category: 'gym', type: 'cardio' }; // 기본값: gym
    }
    case 'strength': {
      // Strength type은 'strength'
      // Category는 대부분 gym
      return { category: 'gym', type: 'strength' };
    }
    case 'snowboard': {
      // Snowboard는 category가 snowboard, type은 cardio 또는 skill
      return { category: 'snowboard', type: 'cardio' }; // 기본값 cardio
    }
    default:
      return { category: 'other', type: 'unknown' };
  }
}

/**
 * Determine target for strength exercises
 */
function determineTarget(name: string): WorkoutTarget {
  const lowerName = name.toLowerCase();

  // Core
  const coreKeywords = ['plank', 'crunch', 'leg raise', 'dead bug', 'core'];
  if (coreKeywords.some(kw => lowerName.includes(kw))) return 'core';

  // Upper
  const upperKeywords = ['bench', 'press', 'pull', 'row', 'lat', 'shoulder', 'chest', '가슴', '등'];
  if (upperKeywords.some(kw => lowerName.includes(kw))) return 'upper';

  // Lower
  const lowerKeywords = ['squat', 'deadlift', 'leg', 'lunge', 'calf', '하체', '스쿼트'];
  if (lowerKeywords.some(kw => lowerName.includes(kw))) return 'lower';

  // Full
  const fullKeywords = ['burpee', 'clean', 'snatch', 'kettlebell'];
  if (fullKeywords.some(kw => lowerName.includes(kw))) return 'full';

  return 'none';
}

/**
 * Sanitize: Convert 0 -> null
 */
function sanitize<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  const numericFields = ['distance_km', 'duration_min', 'speed_kph', 'floors', 'weight_kg', 'sets', 'reps', 'run_count'];

  numericFields.forEach(key => {
    if (result[key] !== undefined && result[key] !== null && result[key] <= 0) {
      result[key] = null;
    }
  });

  return result;
}

/**
 * Main entry point: Parse workout text to Workout[]
 */
export async function parseWithAI(input: string): Promise<Workout[]> {
  if (!input.trim()) {
    return [];
  }

  try {
    // Step 1: Shred
    const segments = await shredInput(input);

    // Step 2: Parse each segment in parallel
    const results = await Promise.all(segments.map(async (seg) => {
      let parsed: any = null;

      switch (seg.category) {
        case 'cardio':
          parsed = await parseCardio(seg.original_text, seg.item_name_hint);
          break;
        case 'strength':
          parsed = await parseStrength(seg.original_text, seg.item_name_hint);
          break;
        case 'snowboard':
          parsed = await parseSnowboard(seg.original_text);
          break;
      }

      if (!parsed) return null;

      // Map to Workout type
      const { category, type } = mapToWorkoutCategoryAndType(seg.category, parsed.name || seg.item_name_hint);
      const target = type === 'strength' ? determineTarget(parsed.name || '') : undefined;

      const workout: Workout = {
        name: parsed.name || seg.item_name_hint,
        category,
        type,
        target,

        // Cardio fields
        distance_km: parsed.distance_km ?? null,
        duration_min: parsed.duration_min ?? null,
        speed_kph: parsed.speed_kph ?? null,
        pace: parsed.pace ?? null,

        // Strength fields
        sets: parsed.sets ?? null,
        reps: parsed.reps ?? null,
        weight_kg: parsed.weight_kg ?? null,

        // Snowboard fields
        run_count: parsed.run_count ?? null,

        // Optional fields
        incline_percent: null,
        resistance_level: null,
        note: parsed.note ?? null,
      };

      return sanitize(workout);
    }));

    // Filter out nulls
    return results.filter((w): w is Workout => w !== null);
  } catch (error) {
    console.error("[aiParser] Parsing failed:", error);
    throw new Error('AI 파싱 실패: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}
