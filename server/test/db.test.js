import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createDb } from '../src/db/index.js';

let tmpDbPath;

afterEach(() => {
  if (tmpDbPath && fs.existsSync(tmpDbPath)) {
    fs.rmSync(tmpDbPath, { force: true });
  }
  tmpDbPath = undefined;
});

describe('createDb', () => {
  it('creates the expected tables', () => {
    const db = createDb(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name)
      .filter((name) => name !== 'sqlite_sequence');
    expect(tables).toEqual(['position_titles', 'postings', 'settings']);
    db.close();
  });

  it('enforces unique, case-insensitive position titles', () => {
    const db = createDb(':memory:');
    db.prepare('INSERT INTO position_titles (title) VALUES (?)').run('Product Manager');
    expect(() =>
      db.prepare('INSERT INTO position_titles (title) VALUES (?)').run('product manager')
    ).toThrow();
    db.close();
  });

  it('rejects an invalid posting status', () => {
    const db = createDb(':memory:');
    db.prepare('INSERT INTO position_titles (title) VALUES (?)').run('QA Engineer');
    expect(() =>
      db
        .prepare(
          `INSERT INTO postings (position_title_id, posting_title, url, status)
           VALUES (1, 'QA Engineer', 'https://example.com/job/1', 'Bogus')`
        )
        .run()
    ).toThrow();
    db.close();
  });

  it('adds aggregator_name/aggregator_url to a fresh DB', () => {
    const db = createDb(':memory:');
    const columns = db.prepare('PRAGMA table_info(postings)').all().map((col) => col.name);
    expect(columns).toContain('aggregator_name');
    expect(columns).toContain('aggregator_url');
    db.close();
  });

  it('adds aggregator_name/aggregator_url to a pre-existing DB that predates them', () => {
    tmpDbPath = path.join(os.tmpdir(), `findajob-migration-test-${Date.now()}.db`);
    const legacyDb = new Database(tmpDbPath);
    legacyDb.exec(`
      CREATE TABLE postings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        posting_title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE
      );
    `);
    legacyDb.prepare('INSERT INTO postings (posting_title, url) VALUES (?, ?)').run(
      'Legacy Role',
      'https://example.com/legacy'
    );
    legacyDb.close();

    const migratedDb = createDb(tmpDbPath);
    const columns = migratedDb.prepare('PRAGMA table_info(postings)').all().map((col) => col.name);
    expect(columns).toContain('aggregator_name');
    expect(columns).toContain('aggregator_url');

    const row = migratedDb.prepare('SELECT * FROM postings WHERE url = ?').get('https://example.com/legacy');
    expect(row.posting_title).toBe('Legacy Role');
    expect(row.aggregator_name).toBeNull();
    migratedDb.close();
  });
});
