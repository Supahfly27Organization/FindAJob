import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDb } from '../src/db/index.js';
import { createPositionTitle } from '../src/services/positionTitleService.js';
import { saveOpenAiKey } from '../src/services/settingsService.js';
import { searchPostingsForTitle } from '../src/services/searchService.js';
import { listPostingsForTitle } from '../src/services/postingService.js';
import { ValidationError, UpstreamError, NotFoundError } from '../src/errors.js';

let db;
let title;

beforeEach(() => {
  db = createDb(':memory:');
  title = createPositionTitle(db, 'Product Manager');
});

describe('searchPostingsForTitle', () => {
  it('throws ValidationError when no API key is configured', async () => {
    await expect(searchPostingsForTitle(db, title.id)).rejects.toThrow(ValidationError);
  });

  it('saves postings returned by the injected search function', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    const fetchPostings = vi.fn().mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1', publishedDate: '2026-08-01' }
    ]);

    const result = await searchPostingsForTitle(db, title.id, { fetchPostings });

    expect(fetchPostings).toHaveBeenCalledWith('sk-test1234567890', 'Product Manager');
    expect(result).toEqual({ totalFound: 1, savedCount: 1 });
    expect(listPostingsForTitle(db, title.id)).toHaveLength(1);
  });

  it('wraps a failed search call in an UpstreamError', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    const fetchPostings = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(searchPostingsForTitle(db, title.id, { fetchPostings })).rejects.toThrow(UpstreamError);
  });

  it('reports a rejected API key as a ValidationError instead of a generic UpstreamError', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    const authError = new Error('Incorrect API key provided');
    authError.status = 401;
    const fetchPostings = vi.fn().mockRejectedValue(authError);

    await expect(searchPostingsForTitle(db, title.id, { fetchPostings })).rejects.toThrow(ValidationError);
    await expect(searchPostingsForTitle(db, title.id, { fetchPostings })).rejects.toThrow(/rejected/i);
  });

  it('throws NotFoundError for a missing position title', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    await expect(searchPostingsForTitle(db, 999, { fetchPostings: vi.fn() })).rejects.toThrow(
      NotFoundError
    );
  });
});
