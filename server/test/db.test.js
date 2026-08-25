import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/index.js';

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
});
