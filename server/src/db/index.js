import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so additive columns for
// tables that already existed before they were added to schema.sql are applied here,
// each wrapped to ignore the "duplicate column name" error on a DB that already has it.
// schema.sql's CREATE TABLE stays the source of truth for a fresh DB's shape.
const ADDITIVE_COLUMNS = [
  'ALTER TABLE postings ADD COLUMN aggregator_name TEXT',
  'ALTER TABLE postings ADD COLUMN aggregator_url TEXT',
  'ALTER TABLE postings ADD COLUMN applied_cv_original_name TEXT'
];

export function createDb(filePath) {
  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  for (const statement of ADDITIVE_COLUMNS) {
    try {
      db.exec(statement);
    } catch (error) {
      if (!/duplicate column name/i.test(error.message)) {
        throw error;
      }
    }
  }
  return db;
}
