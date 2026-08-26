import { NotFoundError, ValidationError } from '../errors.js';
import { getPositionTitleById } from './positionTitleService.js';
import { MAX_RESULTS, MAX_AGE_DAYS } from './openaiClient.js';

const EDITABLE_STATUSES = ['New', 'In Progress', 'Rejected'];

const SELECT_COLUMNS = `id, position_title_id AS positionTitleId, posting_title AS postingTitle,
  description, company, url, aggregator_name AS aggregatorName, aggregator_url AS aggregatorUrl,
  location, published_date AS publishedDate, found_at AS foundAt,
  viewed, status, adapted_resume_path AS adaptedResumePath, applied_cv_path AS appliedCvPath,
  applied_cv_original_name AS appliedCvOriginalName`;

function toPosting(row) {
  return { ...row, viewed: Boolean(row.viewed) };
}

function isRecentEnough(publishedDate) {
  if (!publishedDate) {
    return true;
  }
  const parsed = new Date(publishedDate);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }
  const ageMs = Date.now() - parsed.getTime();
  return ageMs <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

// Scripts that have no business appearing in a URL for an Israeli job posting (Latin/Hebrew
// sites only). A percent-encoded Cyrillic/CJK/Hangul character is a strong signal the model
// fabricated a plausible-looking URL rather than returning a real one it found via web search.
const SUSPICIOUS_SCRIPT_PATTERN = /[Ѐ-ӿ一-鿿぀-ヿ가-힣]/;

function hasSuspiciousUrlEncoding(url) {
  try {
    return SUSPICIOUS_SCRIPT_PATTERN.test(decodeURIComponent(url));
  } catch {
    return true; // malformed percent-encoding is itself a bad sign
  }
}

// Per-domain checks for "this is a search/listing page, not a single posting". This is
// deliberately a BLOCKLIST (reject only known-bad patterns, keep everything else) rather than
// an allowlist (reject anything that doesn't match a "good" pattern) - an allowlist is far too
// brittle against real-world URL variety (e.g. LinkedIn's plain-numeric-id job links, no slug,
// no trailing dash) and silently discards good postings the moment the pattern doesn't cover a
// case, which is worse than occasionally missing a bad one.
function looksLikeJobListingPage(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false; // an unparseable URL is caught by the http(s) check, not duplicated here
  }
  const host = parsed.hostname.replace(/^www\./, '');
  const path = parsed.pathname;

  if (host.endsWith('linkedin.com')) {
    // Listing/category pages: /jobs/search/..., /jobs/collections/..., or a bare
    // "<slug>-jobs" category page. Anything under /jobs/view/ is always a single posting.
    if (path.includes('/jobs/view/')) {
      return false;
    }
    return /\/jobs\/(search|collections)\//i.test(path) || /-jobs\/?(?:$|\?)/i.test(path);
  }
  if (host.endsWith('indeed.com')) {
    // Known listing patterns: a bare "<title>-jobs-in-<place>" category page, or the
    // "q-<query>.html" search-results template. Real single postings (/viewjob?jk=...,
    // /rc/clk?jk=..., or other formats Indeed uses) are kept by not matching either.
    return /-jobs-in-/i.test(path) || /^\/q-.*\.html$/i.test(path);
  }
  if (host.endsWith('alljobs.co.il')) {
    return /searchresultsguest/i.test(url);
  }
  if (host.endsWith('drushim.co.il')) {
    return /\/jobs\/search\//i.test(path);
  }
  if (host.endsWith('builtin.com')) {
    return /\/search\//i.test(path);
  }

  return /searchresults/i.test(url) || /-jobs-in-/i.test(url);
}

function isValidCandidate(candidate) {
  if (
    !candidate ||
    typeof candidate.url !== 'string' ||
    typeof candidate.postingTitle !== 'string' ||
    !candidate.postingTitle.trim()
  ) {
    return false;
  }
  const url = candidate.url.trim();
  return (
    /^https?:\/\//i.test(url) &&
    !hasSuspiciousUrlEncoding(url) &&
    !looksLikeJobListingPage(url)
  );
}

// Near-duplicate detection for the same job posted under different URLs (e.g. LinkedIn vs.
// the company's own career page). URL-based dedup (the ON CONFLICT(url) below) only catches
// byte-identical links; this catches "same job, different link" by description similarity
// alone — word-overlap of the two ad texts, no company/title/location gating.
const DESCRIPTION_SIMILARITY_THRESHOLD = 0.5;

function normalizeForMatch(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(text) {
  return new Set(normalizeForMatch(text).split(' ').filter(Boolean));
}

function textSimilarity(a, b) {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) {
      intersection += 1;
    }
  }
  return intersection / (setA.size + setB.size - intersection);
}

function isLikelyDuplicate(candidate, existing) {
  return textSimilarity(candidate.description, existing.description) >= DESCRIPTION_SIMILARITY_THRESHOLD;
}

export function saveSearchResults(db, positionTitleId, candidates) {
  getPositionTitleById(db, positionTitleId);

  const toSave = candidates
    .filter(isValidCandidate)
    .filter((candidate) => isRecentEnough(candidate.publishedDate))
    .slice(0, MAX_RESULTS);

  const knownPostings = db.prepare('SELECT url, description FROM postings').all();

  const insert = db.prepare(
    `INSERT INTO postings (position_title_id, posting_title, description, company, url, aggregator_name, aggregator_url, location, published_date)
     VALUES (@positionTitleId, @postingTitle, @description, @company, @url, @aggregatorName, @aggregatorUrl, @location, @publishedDate)
     ON CONFLICT(url) DO NOTHING`
  );

  const runAll = db.transaction((rows) => {
    let savedCount = 0;
    for (const row of rows) {
      const url = row.url.trim();
      const isDuplicate = knownPostings.some(
        (existing) => existing.url === url || isLikelyDuplicate(row, existing)
      );
      if (isDuplicate) {
        continue;
      }

      const result = insert.run({
        positionTitleId,
        postingTitle: row.postingTitle.trim(),
        description: row.description ?? null,
        company: row.company ?? null,
        url,
        aggregatorName: row.aggregatorName ?? null,
        aggregatorUrl: row.aggregatorUrl ?? null,
        location: row.location ?? null,
        publishedDate: row.publishedDate ?? null
      });
      if (result.changes > 0) {
        savedCount += 1;
        knownPostings.push({ url, description: row.description ?? null });
      }
    }
    return savedCount;
  });

  return { totalFound: candidates.length, savedCount: runAll(toSave) };
}

export function listPostingsForTitle(db, positionTitleId, { status } = {}) {
  getPositionTitleById(db, positionTitleId);
  const rows = status
    ? db
        .prepare(
          `SELECT ${SELECT_COLUMNS} FROM postings WHERE position_title_id = ? AND status = ? ORDER BY found_at DESC`
        )
        .all(positionTitleId, status)
    : db
        .prepare(`SELECT ${SELECT_COLUMNS} FROM postings WHERE position_title_id = ? ORDER BY found_at DESC`)
        .all(positionTitleId);
  return rows.map(toPosting);
}

export function getPostingById(db, id) {
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM postings WHERE id = ?`).get(id);
  if (!row) {
    throw new NotFoundError(`Posting ${id} not found`);
  }
  return toPosting(row);
}

export function markPostingViewed(db, id) {
  getPostingById(db, id);
  db.prepare('UPDATE postings SET viewed = 1 WHERE id = ?').run(id);
  return getPostingById(db, id);
}

export function setAdaptedResumePath(db, id, path) {
  db.prepare('UPDATE postings SET adapted_resume_path = ? WHERE id = ?').run(path, id);
}

// Marking a posting Applied is only reachable through the applied-CV upload flow
// (appliedCvService.saveAppliedCv), so the status always matches a CV on file.
export function setAppliedCv(db, id, filePath, originalName) {
  db.prepare(
    `UPDATE postings SET applied_cv_path = ?, applied_cv_original_name = ?, status = 'Applied' WHERE id = ?`
  ).run(filePath, originalName, id);
  return getPostingById(db, id);
}

export function updatePostingStatus(db, id, status) {
  getPostingById(db, id);
  if (!EDITABLE_STATUSES.includes(status)) {
    throw new ValidationError(
      `Status must be one of: ${EDITABLE_STATUSES.join(', ')}. Marking a posting Applied requires uploading the CV you used.`
    );
  }
  db.prepare('UPDATE postings SET status = ? WHERE id = ?').run(status, id);
  return getPostingById(db, id);
}
