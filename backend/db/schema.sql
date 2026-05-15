CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repos (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  url           TEXT NOT NULL,
  owner         TEXT,
  name          TEXT,
  status        TEXT DEFAULT 'pending',
  health_score  INTEGER,
  repo_context  TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
  id            TEXT PRIMARY KEY,
  repo_id       TEXT NOT NULL REFERENCES repos(id),
  path          TEXT,
  summary       TEXT,
  importance    TEXT,
  danger_score  INTEGER,
  blast_radius  TEXT
);

CREATE TABLE IF NOT EXISTS edges (
  id         TEXT PRIMARY KEY,
  repo_id    TEXT NOT NULL REFERENCES repos(id),
  from_file  TEXT,
  to_file    TEXT
);
CREATE TABLE IF NOT EXISTS onboarding_paths (
  id            TEXT PRIMARY KEY,
  analysis_id   TEXT NOT NULL REFERENCES repos(id),
  role          TEXT NOT NULL,
  roadmap_json  TEXT,a
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qna_history (
  id            TEXT PRIMARY KEY,
  analysis_id   TEXT NOT NULL REFERENCES repos(id),
  question      TEXT NOT NULL,
  answer        TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);