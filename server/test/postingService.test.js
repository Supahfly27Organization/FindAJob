import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { createPositionTitle } from '../src/services/positionTitleService.js';
import {
  saveSearchResults,
  listPostingsForTitle,
  getPostingById,
  markPostingViewed,
  updatePostingStatus,
  setAdaptedResumePath
} from '../src/services/postingService.js';
import { ValidationError, NotFoundError } from '../src/errors.js';

let db;
let title;

beforeEach(() => {
  db = createDb(':memory:');
  title = createPositionTitle(db, 'Product Manager');
});

describe('saveSearchResults', () => {
  it('saves valid candidates', () => {
    const result = saveSearchResults(db, title.id, [
      {
        postingTitle: 'Senior Product Manager',
        description: 'Great role',
        company: 'Acme',
        url: 'https://example.com/job/1',
        location: 'Tel Aviv',
        publishedDate: '2026-08-01'
      }
    ]);
    expect(result).toEqual({ totalFound: 1, savedCount: 1 });
    expect(listPostingsForTitle(db, title.id)).toHaveLength(1);
  });

  it('saves the aggregator name and URL when provided', () => {
    saveSearchResults(db, title.id, [
      {
        postingTitle: 'Senior Product Manager',
        url: 'https://www.linkedin.com/jobs/view/senior-product-manager-1234567890',
        aggregatorName: 'LinkedIn',
        aggregatorUrl: 'https://www.linkedin.com/jobs/view/senior-product-manager-1234567890'
      }
    ]);
    const [posting] = listPostingsForTitle(db, title.id);
    expect(posting.aggregatorName).toBe('LinkedIn');
    expect(posting.aggregatorUrl).toBe('https://www.linkedin.com/jobs/view/senior-product-manager-1234567890');
  });

  it('saves null aggregator fields when not provided', () => {
    saveSearchResults(db, title.id, [
      { postingTitle: 'Direct Role', url: 'https://example.com/careers/direct-role' }
    ]);
    const [posting] = listPostingsForTitle(db, title.id);
    expect(posting.aggregatorName).toBeNull();
    expect(posting.aggregatorUrl).toBeNull();
  });

  it('treats a different URL as a duplicate when company/title/location and description all match closely', () => {
    saveSearchResults(db, title.id, [
      {
        postingTitle: 'Senior Product Manager',
        description: 'Own the roadmap for our core platform and lead a team of five engineers.',
        company: 'Acme Inc.',
        url: 'https://www.linkedin.com/jobs/view/senior-product-manager-1234567890',
        location: 'Tel Aviv'
      }
    ]);

    const result = saveSearchResults(db, title.id, [
      {
        postingTitle: 'Senior Product Manager',
        description: 'Own the roadmap for our core platform, leading a team of 5 engineers.',
        company: 'Acme',
        url: 'https://careers.acme.com/jobs/senior-pm',
        location: 'Tel Aviv, Israel'
      }
    ]);

    expect(result.savedCount).toBe(0);
    expect(listPostingsForTitle(db, title.id)).toHaveLength(1);
  });

  it('does not treat matching company/title/location as a duplicate when descriptions differ', () => {
    saveSearchResults(db, title.id, [
      {
        postingTitle: 'Senior Product Manager',
        description: 'Lead our fintech payments squad building new checkout flows.',
        company: 'Acme',
        url: 'https://www.linkedin.com/jobs/view/senior-product-manager-1234567890',
        location: 'Tel Aviv'
      }
    ]);

    const result = saveSearchResults(db, title.id, [
      {
        postingTitle: 'Senior Product Manager',
        description: 'Lead our data platform team building the analytics warehouse.',
        company: 'Acme',
        url: 'https://careers.acme.com/jobs/senior-pm-2',
        location: 'Tel Aviv'
      }
    ]);

    expect(result.savedCount).toBe(1);
    expect(listPostingsForTitle(db, title.id)).toHaveLength(2);
  });

  it('does not treat postings at different companies as duplicates even with matching title/location/description', () => {
    const description = 'Own the roadmap for our core platform and lead a team of five engineers.';
    saveSearchResults(db, title.id, [
      {
        postingTitle: 'Senior Product Manager',
        description,
        company: 'Acme',
        url: 'https://www.linkedin.com/jobs/view/senior-product-manager-1234567890',
        location: 'Tel Aviv'
      }
    ]);

    const result = saveSearchResults(db, title.id, [
      {
        postingTitle: 'Senior Product Manager',
        description,
        company: 'Wixel',
        url: 'https://careers.wixel.com/jobs/senior-pm',
        location: 'Tel Aviv'
      }
    ]);

    expect(result.savedCount).toBe(1);
    expect(listPostingsForTitle(db, title.id)).toHaveLength(2);
  });

  it('discards candidates whose URL decodes to an unexpected script (a fabrication signal)', () => {
    const result = saveSearchResults(db, title.id, [
      {
        postingTitle: 'Fabricated Role',
        url: 'https://il.indeed.com/ved/VP-R%D0%A6-Factify-job',
        publishedDate: '2026-08-01'
      }
    ]);
    expect(result.savedCount).toBe(0);
    expect(listPostingsForTitle(db, title.id)).toHaveLength(0);
  });

  it('discards a candidate whose URL is a category/listing page instead of a single posting', () => {
    const result = saveSearchResults(db, title.id, [
      {
        postingTitle: 'Listing Page Role',
        url: 'https://il.linkedin.com/jobs/research-and-development-manager-jobs',
        publishedDate: '2026-08-01'
      },
      {
        postingTitle: 'Search Results Role',
        url: 'https://www.alljobs.co.il/SearchResultsGuest.aspx?city=&page=1&position=258&region=&type=4',
        publishedDate: '2026-08-01'
      },
      {
        postingTitle: 'Indeed Category Role',
        url: 'https://il.indeed.com/VP-R%26D-jobs-in-Israel',
        publishedDate: '2026-08-01'
      }
    ]);
    expect(result.savedCount).toBe(0);
    expect(listPostingsForTitle(db, title.id)).toHaveLength(0);
  });

  it('keeps a real per-posting URL even when its path contains the word "search"', () => {
    const result = saveSearchResults(db, title.id, [
      {
        postingTitle: 'Real AllJobs Posting',
        url: 'https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=8740882',
        publishedDate: '2026-08-01'
      },
      {
        postingTitle: 'Real Indeed Posting',
        url: 'https://il.indeed.com/viewjob?jk=da83e8dd32a40bf1',
        publishedDate: '2026-08-01'
      },
      {
        postingTitle: 'Real LinkedIn Posting',
        url: 'https://il.linkedin.com/jobs/view/r-d-manager-at-dialog-4455848013',
        publishedDate: '2026-08-01'
      }
    ]);
    expect(result.savedCount).toBe(3);
  });

  it('discards candidates missing a url', () => {
    const result = saveSearchResults(db, title.id, [
      { postingTitle: 'No URL Role', publishedDate: '2026-08-01' }
    ]);
    expect(result.savedCount).toBe(0);
    expect(listPostingsForTitle(db, title.id)).toHaveLength(0);
  });

  it('discards candidates with a non-http(s) URL scheme', () => {
    const result = saveSearchResults(db, title.id, [
      { postingTitle: 'Malicious Role', url: 'javascript:alert(1)', publishedDate: '2026-08-01' }
    ]);
    expect(result.savedCount).toBe(0);
    expect(listPostingsForTitle(db, title.id)).toHaveLength(0);
  });

  it('discards candidates missing a posting title', () => {
    const result = saveSearchResults(db, title.id, [
      { url: 'https://example.com/job/no-title', publishedDate: '2026-08-01' }
    ]);
    expect(result.savedCount).toBe(0);
  });

  it('discards candidates published more than 45 days ago', () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = saveSearchResults(db, title.id, [
      { postingTitle: 'Old Role', url: 'https://example.com/job/old', publishedDate: oldDate }
    ]);
    expect(result.savedCount).toBe(0);
  });

  it('keeps candidates with an unparseable published date', () => {
    const result = saveSearchResults(db, title.id, [
      { postingTitle: 'Undated Role', url: 'https://example.com/job/undated', publishedDate: 'unknown' }
    ]);
    expect(result.savedCount).toBe(1);
  });

  it('caps saved candidates at 20 per run', () => {
    const candidates = Array.from({ length: 25 }, (_, i) => ({
      postingTitle: `Role ${i}`,
      url: `https://example.com/job/${i}`,
      publishedDate: '2026-08-01'
    }));
    const result = saveSearchResults(db, title.id, candidates);
    expect(result.savedCount).toBe(20);
    expect(result.totalFound).toBe(25);
  });

  it('dedupes against an existing posting by url without resetting its status', () => {
    saveSearchResults(db, title.id, [
      { postingTitle: 'Role', url: 'https://example.com/job/dup', publishedDate: '2026-08-01' }
    ]);
    const [existing] = listPostingsForTitle(db, title.id);
    updatePostingStatus(db, existing.id, 'In Progress');

    const result = saveSearchResults(db, title.id, [
      { postingTitle: 'Role (again)', url: 'https://example.com/job/dup', publishedDate: '2026-08-02' }
    ]);
    expect(result.savedCount).toBe(0);
    const [unchanged] = listPostingsForTitle(db, title.id);
    expect(unchanged.status).toBe('In Progress');
  });

  it('throws NotFoundError for a missing position title', () => {
    expect(() => saveSearchResults(db, 999, [])).toThrow(NotFoundError);
  });
});

describe('listPostingsForTitle', () => {
  it('filters by status', () => {
    saveSearchResults(db, title.id, [
      { postingTitle: 'A', url: 'https://example.com/a' },
      { postingTitle: 'B', url: 'https://example.com/b' }
    ]);
    const [a] = listPostingsForTitle(db, title.id);
    updatePostingStatus(db, a.id, 'Rejected');

    expect(listPostingsForTitle(db, title.id, { status: 'Rejected' })).toHaveLength(1);
    expect(listPostingsForTitle(db, title.id, { status: 'New' })).toHaveLength(1);
  });

  it('throws NotFoundError for a missing position title', () => {
    expect(() => listPostingsForTitle(db, 999)).toThrow(NotFoundError);
  });
});

describe('markPostingViewed', () => {
  it('sets viewed to true without changing status', () => {
    saveSearchResults(db, title.id, [{ postingTitle: 'A', url: 'https://example.com/a' }]);
    const [posting] = listPostingsForTitle(db, title.id);
    expect(posting.viewed).toBe(false);

    const updated = markPostingViewed(db, posting.id);
    expect(updated.viewed).toBe(true);
    expect(updated.status).toBe('New');
  });

  it('throws NotFoundError for a missing posting', () => {
    expect(() => markPostingViewed(db, 999)).toThrow(NotFoundError);
  });
});

describe('updatePostingStatus', () => {
  it('updates to a valid status', () => {
    saveSearchResults(db, title.id, [{ postingTitle: 'A', url: 'https://example.com/a' }]);
    const [posting] = listPostingsForTitle(db, title.id);
    const updated = updatePostingStatus(db, posting.id, 'In Progress');
    expect(updated.status).toBe('In Progress');
  });

  it('rejects "Applied" (requires the Plan 4 CV-upload flow)', () => {
    saveSearchResults(db, title.id, [{ postingTitle: 'A', url: 'https://example.com/a' }]);
    const [posting] = listPostingsForTitle(db, title.id);
    expect(() => updatePostingStatus(db, posting.id, 'Applied')).toThrow(ValidationError);
  });

  it('rejects an unrecognized status', () => {
    saveSearchResults(db, title.id, [{ postingTitle: 'A', url: 'https://example.com/a' }]);
    const [posting] = listPostingsForTitle(db, title.id);
    expect(() => updatePostingStatus(db, posting.id, 'Bogus')).toThrow(ValidationError);
  });

  it('throws NotFoundError for a missing posting', () => {
    expect(() => updatePostingStatus(db, 999, 'Rejected')).toThrow(NotFoundError);
  });
});

describe('setAdaptedResumePath', () => {
  it('sets the adapted resume path on the posting', () => {
    saveSearchResults(db, title.id, [{ postingTitle: 'A', url: 'https://example.com/a' }]);
    const [posting] = listPostingsForTitle(db, title.id);

    setAdaptedResumePath(db, posting.id, '/data/adapted-resumes/posting-1.txt');

    expect(getPostingById(db, posting.id).adaptedResumePath).toBe('/data/adapted-resumes/posting-1.txt');
  });
});

describe('getPostingById', () => {
  it('throws NotFoundError for a missing posting', () => {
    expect(() => getPostingById(db, 999)).toThrow(NotFoundError);
  });
});
