import type { Handler, HandlerEvent } from "@netlify/functions";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

// ==========================================
// Inline Schemas (to avoid import issues)
// ==========================================

const InternalCategoryEnum = z.enum(["cardio", "strength", "snowboard"]);

const ShreddedSegmentSchema = z.object({
  original_text: z.string().describe("운동별로 분리된 문장"),
  category: InternalCategoryEnum.describe("담당 부서"),
  item_name_hint: z.string().describe("운동 이름 힌트"),
});

const ShredderResponseSchema = z.object({
  segments: z.array(ShreddedSegmentSchema),
});

const CardioNames = z.enum([
  "running", "stepmill", "rowing", "cycle", "swimming",
  "hiking", "jump_rope", "elliptical", "other"
]);

const CardioResultSchema = z.object({
  reasoning: z.string(),
  name: CardioNames,
  distance_km: z.union([z.number(), z.null()]),
  duration_min: z.union([z.number(), z.null()]),
  speed_kph: z.union([z.number(), z.null()]),
  pace: z.string().nullable(),
  floors: z.union([z.number(), z.null()]),
});

const StrengthResultSchema = z.object({
  reasoning: z.string(),
  name: z.string(),
  weight_kg: z.union([z.number(), z.null()]),
  sets: z.union([z.number(), z.null()]),
  reps: z.union([z.number(), z.null()]),
});

const SnowboardResultSchema = z.object({
  name: z.string(),
  duration_min: z.union([z.number(), z.null()]),
  run_count: z.union([z.number(), z.null()]),
  note: z.string().nullable(),
});

type ShreddedSegment = z.infer<typeof ShreddedSegmentSchema>;
type InternalCategory = z.infer<typeof InternalCategoryEnum>;

// ==========================================
// OpenAI Client
// ==========================================

// NOTE: Use OPENAI_API_KEY (backend env var), NOT VITE_OPENAI_API_KEY (frontend)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const MODEL = "gpt-4o-mini";

// ==========================================
// Shredder
// ==========================================

async function shredInput(input: string): Promise<ShreddedSegment[]> {
  const completion = await openai.beta.chat.completions.parse({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `
You are a Text Shredder. Split workout logs into distinct segments.

[RULES]
1. Split by Activity: "Run 30m and Bench 60kg" -> 2 segments
2. Keep numbers with exercise: "Squat 100kg 5 sets" is ONE segment
3. Assign Category: 'strength' for weights, 'cardio' for running/cycling, 'snowboard' for snowboard

[EXAMPLES]
In: "런닝 20분 뛰고 벤치 60 5세트"
Out: [
  { original_text: "런닝 20분", category: "cardio", item_name_hint: "running" },
  { original_text: "벤치 60 5세트", category: "strength", item_name_hint: "bench_press" }
]
`
      },
      { role: "user", content: input },
    ],
    response_format: zodResponseFormat(ShredderResponseSchema, "shredder_output"),
  });

  return completion.choices[0].message.parsed?.segments || [];
}

// ==========================================
// Specialists
// ==========================================

async function parseCardio(text: string, hint: string) {
  const completion = await openai.beta.chat.completions.parse({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `
You are a Cardio Specialist.

[RULES]
1. "~로" -> Speed (e.g. "6km로" -> speed_kph: 6)
2. "~를" -> Distance (e.g. "6km를" -> distance_km: 6)
3. Stepmill: Use 'floors' field, NOT distance
4. Use NULL for missing data, NEVER 0
`
      },
      { role: "user", content: `Hint: ${hint}\nInput: ${text}` },
    ],
    response_format: zodResponseFormat(CardioResultSchema, "cardio_result"),
  });
  return completion.choices[0].message.parsed || null;
}

async function parseStrength(text: string, hint: string) {
  const completion = await openai.beta.chat.completions.parse({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `
You are a Strength Specialist.

[RULES]
1. "kg/키로" -> weight_kg
2. "세트" -> sets
3. "회/개" -> reps
4. Bodyweight exercises: weight_kg = NULL
`
      },
      { role: "user", content: `Hint: ${hint}\nInput: ${text}` },
    ],
    response_format: zodResponseFormat(StrengthResultSchema, "strength_result"),
  });
  return completion.choices[0].message.parsed || null;
}

async function parseSnowboard(text: string) {
  const durationMatch = text.match(/(\d+)\s*(시간|분)/);
  const runCountMatch = text.match(/(\d+)\s*(회|번|런)/);

  return {
    name: "스노보드",
    duration_min: durationMatch ? (durationMatch[2] === '시간' ? parseInt(durationMatch[1]) * 60 : parseInt(durationMatch[1])) : null,
    run_count: runCountMatch ? parseInt(runCountMatch[1]) : null,
    note: text.includes('빡세게') ? '빡세게' : text.includes('가볍게') ? '가볍게' : null,
  };
}

// ==========================================
// Mapper
// ==========================================

function mapToWorkout(seg: ShreddedSegment, parsed: any) {
  const category = seg.category === 'cardio' ? 'gym' :
                   seg.category === 'strength' ? 'gym' :
                   seg.category === 'snowboard' ? 'snowboard' : 'other';

  const type = seg.category === 'cardio' ? 'cardio' :
               seg.category === 'strength' ? 'strength' :
               seg.category === 'snowboard' ? 'cardio' : 'unknown';

  const target = type === 'strength' ? determineTarget(parsed.name || '') : undefined;

  return {
    name: parsed.name || seg.item_name_hint,
    category,
    type,
    target,
    distance_km: parsed.distance_km ?? null,
    duration_min: parsed.duration_min ?? null,
    speed_kph: parsed.speed_kph ?? null,
    pace: parsed.pace ?? null,
    sets: parsed.sets ?? null,
    reps: parsed.reps ?? null,
    weight_kg: parsed.weight_kg ?? null,
    run_count: parsed.run_count ?? null,
    incline_percent: null,
    resistance_level: null,
    note: parsed.note ?? null,
  };
}

function determineTarget(name: string) {
  const lowerName = name.toLowerCase();
  if (['plank', 'crunch', 'core'].some(kw => lowerName.includes(kw))) return 'core';
  if (['bench', 'press', 'pull', 'row', 'lat', 'shoulder', 'chest'].some(kw => lowerName.includes(kw))) return 'upper';
  if (['squat', 'deadlift', 'leg', 'lunge', 'calf'].some(kw => lowerName.includes(kw))) return 'lower';
  if (['burpee', 'clean', 'snatch', 'kettlebell'].some(kw => lowerName.includes(kw))) return 'full';
  return 'none';
}

// ==========================================
// Main Handler
// ==========================================

export const handler: Handler = async (event: HandlerEvent) => {
  // 1. Check Method
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // 2. Check API Key (Fail fast)
  if (!process.env.OPENAI_API_KEY) {
    console.error("🔥 FATAL: OPENAI_API_KEY is missing in Netlify environment variables.");
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server Configuration Error",
        details: "Missing OPENAI_API_KEY in environment variables"
      }),
    };
  }

  try {
    // 3. Parse Request Body
    const { text } = JSON.parse(event.body || "{}");

    if (!text || typeof text !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing or invalid 'text' field" }),
      };
    }

    console.log("[parse-workout] Processing text:", text.substring(0, 50) + "...");

    // 4. Shred Input
    const segments = await shredInput(text);
    console.log("[parse-workout] Shredded into", segments.length, "segments");

    // 5. Parse Each Segment
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

      return parsed ? mapToWorkout(seg, parsed) : null;
    }));

    const workouts = results.filter(w => w !== null);
    console.log("[parse-workout] Successfully parsed", workouts.length, "workouts");

    return {
      statusCode: 200,
      body: JSON.stringify({ workouts }),
    };
  } catch (error) {
    console.error("🔥 [parse-workout] Error:", error);

    // Return detailed error for debugging
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "AI Processing Failed",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }),
    };
  }
};
