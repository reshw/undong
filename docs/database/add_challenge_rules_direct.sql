-- Challenge Maker: Direct table modification
-- 뷰가 아닌 실제 테이블을 직접 수정하는 방식
--
-- 작성일: 2026-01-20

-- ============================================
-- Option 1: Try with schema prefix
-- ============================================

-- Add columns directly to the base table with explicit schema
DO $$
BEGIN
  -- Try adding rules column with schema prefix
  BEGIN
    EXECUTE 'ALTER TABLE public.club_challenges ADD COLUMN IF NOT EXISTS rules JSONB';
    RAISE NOTICE 'Added rules column to public.club_challenges';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add rules column: %', SQLERRM;
  END;

  -- Try adding theme_color column with schema prefix
  BEGIN
    EXECUTE 'ALTER TABLE public.club_challenges ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT ''#8b5cf6''';
    RAISE NOTICE 'Added theme_color column to public.club_challenges';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add theme_color column: %', SQLERRM;
  END;
END $$;

-- ============================================
-- Option 2: If it's a view, recreate it
-- ============================================

-- Check if club_challenges is a view
DO $$
DECLARE
  v_is_view boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_name = 'club_challenges'
  ) INTO v_is_view;

  IF v_is_view THEN
    RAISE NOTICE 'club_challenges is a VIEW. You need to drop and recreate it, or modify the underlying table.';
    RAISE NOTICE 'Please contact your database administrator or check the view definition.';
  ELSE
    RAISE NOTICE 'club_challenges is a TABLE (not a view)';
  END IF;
END $$;

-- ============================================
-- Show table/view information
-- ============================================

SELECT
  t.table_schema,
  t.table_name,
  t.table_type,
  CASE
    WHEN t.table_type = 'VIEW' THEN 'This is a view - cannot add columns directly'
    WHEN t.table_type = 'BASE TABLE' THEN 'This is a table - columns can be added'
    ELSE 'Unknown type'
  END as status
FROM information_schema.tables t
WHERE t.table_name = 'club_challenges';

-- Show existing columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'club_challenges'
ORDER BY ordinal_position;
