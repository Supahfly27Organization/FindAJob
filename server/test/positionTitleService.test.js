import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import {
  createPositionTitle,
  listPositionTitles,
  updatePositionTitle,
  deletePositionTitle
} from '../src/services/positionTitleService.js';
import { ValidationError, NotFoundError } from '../src/errors.js';

let db;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('createPositionTitle', () => {
  it('creates a title with no postings yet', () => {
    createPositionTitle(db, 'Product Manager');
    expect(listPositionTitles(db)).toEqual([
      expect.objectContaining({ title: 'Product Manager', postingCount: 0 })
    ]);
  });

  it('trims whitespace before saving', () => {
    const created = createPositionTitle(db, '  Product Manager  ');
    expect(created.title).toBe('Product Manager');
  });

  it('rejects an empty title', () => {
    expect(() => createPositionTitle(db, '   ')).toThrow(ValidationError);
  });

  it('rejects a duplicate title case-insensitively', () => {
    createPositionTitle(db, 'Product Manager');
    expect(() => createPositionTitle(db, 'product manager')).toThrow(
      'This title is already in your list'
    );
  });

  it('rejects a title longer than 200 characters', () => {
    expect(() => createPositionTitle(db, 'a'.repeat(201))).toThrow(ValidationError);
  });
});

describe('updatePositionTitle', () => {
  it('updates the title while keeping linked postings', () => {
    const created = createPositionTitle(db, 'Product Manger');
    db.prepare(
      'INSERT INTO postings (position_title_id, posting_title, url) VALUES (?, ?, ?)'
    ).run(created.id, 'Product Manger', 'https://example.com/job/1');

    const updated = updatePositionTitle(db, created.id, 'Product Manager');
    expect(updated.title).toBe('Product Manager');
    expect(listPositionTitles(db)[0].postingCount).toBe(1);
  });

  it('rejects updating to a title that already exists elsewhere', () => {
    createPositionTitle(db, 'Product Manager');
    const other = createPositionTitle(db, 'QA Engineer');
    expect(() => updatePositionTitle(db, other.id, 'Product Manager')).toThrow(
      'This title is already in your list'
    );
  });

  it('throws NotFoundError for a missing id', () => {
    expect(() => updatePositionTitle(db, 999, 'Anything')).toThrow(NotFoundError);
  });
});

describe('deletePositionTitle', () => {
  it('unlinks postings instead of deleting them', () => {
    const created = createPositionTitle(db, 'QA Engineer');
    db.prepare(
      'INSERT INTO postings (position_title_id, posting_title, url) VALUES (?, ?, ?)'
    ).run(created.id, 'QA Engineer', 'https://example.com/job/2');

    const result = deletePositionTitle(db, created.id);
    expect(result.unlinkedPostingsCount).toBe(1);

    const posting = db
      .prepare('SELECT position_title_id FROM postings WHERE url = ?')
      .get('https://example.com/job/2');
    expect(posting.position_title_id).toBeNull();
    expect(listPositionTitles(db)).toEqual([]);
  });

  it('throws NotFoundError for a missing id', () => {
    expect(() => deletePositionTitle(db, 999)).toThrow(NotFoundError);
  });
});
