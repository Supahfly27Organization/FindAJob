import { NotFoundError, ValidationError } from '../errors.js';
import { getPositionTitleById } from './positionTitleService.js';
import { MAX_RESULTS, MAX_AGE_DAYS } from './openaiClient.js';

const EDITABLE_STATUSES = ['New', 'In Progress', 'Rejected'];

const SELECT_COLUMNS = `id, position_title_id AS positionTitleId, posting_title AS postingTitle,
  description, company, url, aggregator_name AS aggregatorName, aggregator_url AS aggregatorUrl,
  location, published_date AS publishedDate, found_at AS foundAt,
  viewed, status, adapted_resume_path AS adaptedResumePath, applied_cv_path AS appliedCvPath`;

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

function isValidCandidate(candidate) {
  return (
    candidate &&
    typeof candidate.url === 'string' &&
    /^https?:\/\//i.test(candidate.url.trim()) &&
    typeof candidate.postingTitle === 'string' &&
    candidate.postingTitle.trim()
  );
}

// Near-duplicate detection for the same job posted under different URLs (e.g. LinkedIn vs.
// the company's own career page). URL-based dedup (the ON CONFLICT(url) below) only catches
// byte-identical links; this catches "same job, different link" by requiring company + title
// + location to look like the same role, and only THEN using description similarity as the
// deciding factor — company/title/location alone are too weak on their own (two genuinely
// different roles can share all three), and description alone is too weak too (unrelated
// postings can reuse boilerplate).
const TITLE_SIMILARITY_THRESHOLD = 0.6;
const DESCRIPTION_SIMILARITY_THRESHOLD = 0.5;
const COMPANY_SUFFIX_PATTERN = /\b(inc|ltd|llc|corp|co|gmbh|plc)\b/g;

function normalizeForMatch(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCompanyName(text) {
  return normalizeForMatch(text).replace(COMPANY_SUFFIX_PATTERN, '').replace(/\s+/g, ' ').trim();
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

function isCloseLocationMatch(a, b) {
  const normA = normalizeForMatch(a);
  const normB = normalizeForMatch(b);
  if (!normA || !normB) {
    return true; // missing location on either side isn't enough to rule out a match
  }
  return normA === normB || normA.includes(normB) || normB.includes(normA);
}

function isLikelyDuplicate(candidate, existing) {
  const candidateCompany = normalizeCompanyName(candidate.company);
  if (!candidateCompany || candidateCompany !== normalizeCompanyName(existing.company)) {
    return false;
  }

  const candidateTitle = normalizeForMatch(candidate.postingTitle);
  const titleIsClose =
    candidateTitle === normalizeForMatch(existing.postingTitle) ||
    textSimilarity(candidate.postingTitle, existing.postingTitle) >= TITLE_SIMILARITY_THRESHOLD;
  if (!titleIsClose) {
    return false;
  }

  if (!isCloseLocationMatch(candidate.location, existing.location)) {
    return false;
  }

  // Company + title + location look like the same job — description similarity is the tiebreaker.
  return textSimilarity(candidate.description, existing.description) >= DESCRIPTION_SIMILARITY_THRESHOLD;
}

export function saveSearchResults(db, positionTitleId, candidates) {
  getPositionTitleById(db, positionTitleId);

  const toSave = candidates
    .filter(isValidCandidate)
    .filter((candidate) => isRecentEnough(candidate.publishedDate))
    .slice(0, MAX_RESULTS);

  const knownPostings = db
    .prepare('SELECT url, posting_title AS postingTitle, company, location, description FROM postings')
    .all();

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
        knownPostings.push({
          url,
          postingTitle: row.postingTitle.trim(),
          company: row.company ?? null,
          location: row.location ?? null,
          description: row.description ?? null
        });
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

export function updatePostingStatus(db, id, status) {
  getPostingById(db, id);
  if (!EDITABLE_STATUSES.includes(status)) {
    throw new ValidationError(
      `Status must be one of: ${EDITABLE_STATUSES.join(', ')}. Marking a posting Applied requires uploading the CV you used (coming soon).`
    );
  }
  db.prepare('UPDATE postings SET status = ? WHERE id = ?').run(status, id);
  return getPostingById(db, id);
}
