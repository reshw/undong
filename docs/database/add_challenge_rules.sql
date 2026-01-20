-- Challenge Maker: Add rules JSONB column
-- Quest Builder를 위한 챌린지 테이블 확장
--
-- 작성일: 2026-01-20

-- 1. rules JSONB 컬럼 추가 (필터링 로직 저장)
ALTER TABLE club_challenges
ADD COLUMN IF NOT EXISTS rules JSONB;

-- 2. theme_color 컬럼 추가 (UI 테마 색상)
ALTER TABLE club_challenges
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#8b5cf6';

-- 3. challenge_type에 'custom' 타입 추가
-- 기존: 'total_workouts' | 'total_volume' | 'total_duration' | 'total_distance'
-- 추가: 'custom' (rules JSONB 기반 챌린지)
ALTER TABLE club_challenges
ALTER COLUMN challenge_type TYPE TEXT;

-- 4. 코멘트 업데이트
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

-- 5. 기존 챌린지 데이터 마이그레이션 (rules 자동 생성)
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

-- 6. 확인
SELECT id, title, challenge_type, rules, theme_color
FROM club_challenges
ORDER BY created_at DESC
LIMIT 5;
