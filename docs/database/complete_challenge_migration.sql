-- Challenge Maker: Complete remaining migration steps
-- 컬럼 추가 후 남은 마이그레이션 단계
--
-- 작성일: 2026-01-20

-- ============================================
-- Step 1: Update CHECK constraint
-- ============================================

-- Drop the existing CHECK constraint on challenge_type
ALTER TABLE club_challenges DROP CONSTRAINT IF EXISTS club_challenges_challenge_type_check;

-- Recreate with 'custom' type added
ALTER TABLE club_challenges
ADD CONSTRAINT club_challenges_challenge_type_check
CHECK (challenge_type IN ('total_workouts', 'total_volume', 'total_duration', 'total_distance', 'custom'));

-- ============================================
-- Step 2: Add column comments
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
-- Step 3: Migrate existing data
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
-- Step 4: Verify migration
-- ============================================

-- Check columns exist
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'club_challenges' AND column_name IN ('rules', 'theme_color')
ORDER BY column_name;

-- Check data migration
SELECT
  id,
  title,
  challenge_type,
  target_value,
  rules,
  theme_color,
  created_at
FROM club_challenges
ORDER BY created_at DESC
LIMIT 5;

-- Summary
SELECT
  COUNT(*) as total_challenges,
  COUNT(rules) as with_rules,
  COUNT(theme_color) as with_theme
FROM club_challenges;
