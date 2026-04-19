-- ECOS Patient Simulé — initial Supabase schema
-- Run in Supabase SQL Editor (Project → SQL Editor → New query → paste & run).

-- ================================================================
-- 1. Tables
-- ================================================================

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  sdd_number INTEGER,
  subject_number INTEGER DEFAULT 1,
  title TEXT NOT NULL,
  specialty TEXT DEFAULT '',
  des_group INTEGER DEFAULT 0,
  format TEXT NOT NULL,
  source_pdf TEXT DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  student_instructions JSONB NOT NULL DEFAULT '{}',
  patient JSONB,
  qa_pairs JSONB NOT NULL DEFAULT '[]',
  conditional_responses JSONB NOT NULL DEFAULT '[]',
  evaluation_grid JSONB NOT NULL DEFAULT '{"tasks":[],"communication_rubrics":[]}',
  reference_sheet TEXT,
  iconography JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'abandoned')),
  chat_history JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id),
  user_id TEXT,
  task_scores JSONB NOT NULL DEFAULT '[]',
  communication_scores JSONB NOT NULL DEFAULT '[]',
  total_score NUMERIC,
  max_score NUMERIC,
  percentage NUMERIC,
  strengths JSONB NOT NULL DEFAULT '[]',
  improvements JSONB NOT NULL DEFAULT '[]',
  summary TEXT DEFAULT '',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_case_id ON sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_session_id ON evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_case_id ON evaluations(case_id);
CREATE INDEX IF NOT EXISTS idx_cases_format ON cases(format);

-- ================================================================
-- 2. Row Level Security — permissive for thesis demo (no auth yet)
-- ================================================================

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- cases: anon may read everything
DROP POLICY IF EXISTS "Anyone can read cases" ON cases;
CREATE POLICY "Anyone can read cases" ON cases FOR SELECT USING (true);

-- sessions: anon may create/read/update their own (by id)
DROP POLICY IF EXISTS "Anyone can read sessions" ON sessions;
CREATE POLICY "Anyone can read sessions" ON sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can create sessions" ON sessions;
CREATE POLICY "Anyone can create sessions" ON sessions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update sessions" ON sessions;
CREATE POLICY "Anyone can update sessions" ON sessions FOR UPDATE USING (true);

-- evaluations: anon may create/read
DROP POLICY IF EXISTS "Anyone can read evaluations" ON evaluations;
CREATE POLICY "Anyone can read evaluations" ON evaluations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can create evaluations" ON evaluations;
CREATE POLICY "Anyone can create evaluations" ON evaluations FOR INSERT WITH CHECK (true);

-- Note: Case seeding uses the service_role key (bypasses RLS entirely).
