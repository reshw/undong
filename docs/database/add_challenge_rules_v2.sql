-- Challenge Maker: Add rules JSONB column (v2 - Safe version)
-- Quest Builder를 위한 챌린지 테이블 확장
--
-- 작성일: 2026-01-20
-- 버전: 2.0 (뷰/테이블 구분 처리)

-- ============================================
-- Step 1: Check and add rules column
-- ============================================

DO $$
BEGIN
  -- Add rules column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_challenges' AND column_name = 'rules'
  ) THEN
    ALTER TABLE club_challenges ADD COLUMN rules JSONB;
    RAISE NOTICE 'Added rules column';
  ELSE
    RAISE NOTICE 'rules column already exists';
  END IF;

  -- Add theme_color column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_challenges' AND column_name = 'theme_color'
  ) THEN
    ALTER TABLE club_challenges ADD COLUMN theme_color TEXT DEFAULT '#8b5cf6';
    RAISE NOTICE 'Added theme_color column';
  ELSE
    RAISE NOTICE 'theme_color column already exists';
  END IF;
END $$;

-- ============================================
-- Step 2: Drop old CHECK constraint and recreate
-- ============================================

-- Drop the existing CHECK constraint on challenge_type
ALTER TABLE club_challenges DROP CONSTRAINT IF EXISTS club_challenges_challenge_type_check;

-- Recreate with 'custom' type added
ALTER TABLE club_challenges
ADD CONSTRAINT club_challenges_challenge_type_check
CHECK (challenge_type IN ('total_workouts', 'total_volume', 'total_duration', 'total_distance', 'custom'));

-- ============================================
-- Step 3: Add comments
-- ============================================

COMMENT ON COLUMN club_challenges.rules IS 'Quest Builder 필터링 규칙 (JSONB):
{
  target_metric: "volume_kg" | "adjusted_dist_km" | "duration_min" | "run_count" | "workout_count" | "attendance_days",
  filter: {
    category?: string[],
    type?: string[],
    keyword_include?: string[],
    keyword_exclude?: string[]
  },
  aggregation: "sum" | "count",
  goal_value: number,
  unit: string
}';

COMMENT ON COLUMN club_challenges.theme_color IS 'UI 테마 색상 (hex code)';

-- ============================================
-- Step 4: Migrate existing data
-- ============================================

-- Only update rows where rules is NULL
UPDATE club_challenges
SET rules = jsonb_build_object(
  'target_metric',
  CASE challenge_type
    WHEN 'total_volume' THEN 'volume_kg'
    WHEN 'total_distance' THEN 'adjusted_dist_km'
    WHEN 'total_duration' THEN 'duration_min'
    WHEN 'total_workouts' THEN 'workout_count'
    ELSE 'workout_count'
  END,
  'filter', jsonb_build_object(),
  'aggregation', 'sum',
  'goal_value', target_value,
  'unit',
  CASE challenge_type
    WHEN 'total_volume' THEN 'kg'
    WHEN 'total_distance' THEN 'km'
    WHEN 'total_duration' THEN '분'
    WHEN 'total_workouts' THEN '회'
    ELSE '회'
  END
)
WHERE rules IS NULL;

-- ============================================
-- Step 5: Verify
-- ============================================

SELECT
  id,
  title,
  challenge_type,
  rules,
  theme_color,
  created_at
FROM club_challenges
ORDER BY created_at DESC
LIMIT 5;
