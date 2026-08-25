import { NotFoundError, ValidationError } from '../errors.js';
import { getPositionTitleById } from './positionTitleService.js';
import { MAX_RESULTS, MAX_AGE_DAYS } from './openaiClient.js';

const EDITABLE_STATUSES = ['New', 'In Progress', 'Rejected'];

const SELECT_COLUMNS = `id, position_title_id AS positionTitleId, posting_title AS postingTitle,
  description, company, url, location, published_date AS publishedDate, found_at AS foundAt,
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

export function saveSearchResults(db, positionTitleId, candidates) {
  getPositionTitleById(db, positionTitleId);

  const toSave = candidates
    .filter(isValidCandidate)
    .filter((candidate) => isRecentEnough(candidate.publishedDate))
    .slice(0, MAX_RESULTS);

  const insert = db.prepare(
    `INSERT INTO postings (position_title_id, posting_title, description, company, url, location, published_date)
     VALUES (@positionTitleId, @postingTitle, @description, @company, @url, @location, @publishedDate)
     ON CONFLICT(url) DO NOTHING`
  );

  const runAll = db.transaction((rows) => {
    let savedCount = 0;
    for (const row of rows) {
      const result = insert.run({
        positionTitleId,
        postingTitle: row.postingTitle.trim(),
        description: row.description ?? null,
        company: row.company ?? null,
        url: row.url.trim(),
        location: row.location ?? null,
        publishedDate: row.publishedDate ?? null
      });
      if (result.changes > 0) {
        savedCount += 1;
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
