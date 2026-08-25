PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS position_titles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS postings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_title_id INTEGER REFERENCES position_titles(id) ON DELETE SET NULL,
  posting_title TEXT NOT NULL,
  description TEXT,
  company TEXT,
  url TEXT NOT NULL UNIQUE,
  location TEXT,
  published_date TEXT,
  found_at TEXT NOT NULL DEFAULT (datetime('now')),
  viewed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Applied', 'In Progress', 'Rejected')),
  adapted_resume_path TEXT,
  applied_cv_path TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
