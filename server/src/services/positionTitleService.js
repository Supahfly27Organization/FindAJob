import { ValidationError, NotFoundError } from '../errors.js';

const MAX_TITLE_LENGTH = 200;

function normalizeTitle(rawTitle) {
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (!title) {
    throw new ValidationError('Title is required');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }
  return title;
}

function isUniqueConstraintError(error) {
  return typeof error.message === 'string' && error.message.includes('UNIQUE constraint failed');
}

export function createPositionTitle(db, rawTitle) {
  const title = normalizeTitle(rawTitle);
  try {
    const result = db.prepare('INSERT INTO position_titles (title) VALUES (?)').run(title);
    return getPositionTitleById(db, result.lastInsertRowid);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ValidationError('This title is already in your list');
    }
    throw error;
  }
}

export function listPositionTitles(db) {
  return db
    .prepare(
      `SELECT pt.id, pt.title, pt.created_at AS createdAt,
              COUNT(p.id) AS postingCount
       FROM position_titles pt
       LEFT JOIN postings p ON p.position_title_id = pt.id
       GROUP BY pt.id
       ORDER BY pt.title COLLATE NOCASE`
    )
    .all();
}

export function getPositionTitleById(db, id) {
  const row = db
    .prepare('SELECT id, title, created_at AS createdAt FROM position_titles WHERE id = ?')
    .get(id);
  if (!row) {
    throw new NotFoundError(`Position title ${id} not found`);
  }
  return row;
}

export function updatePositionTitle(db, id, rawTitle) {
  getPositionTitleById(db, id);
  const title = normalizeTitle(rawTitle);
  try {
    db.prepare('UPDATE position_titles SET title = ? WHERE id = ?').run(title, id);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ValidationError('This title is already in your list');
    }
    throw error;
  }
  return getPositionTitleById(db, id);
}

export function deletePositionTitle(db, id) {
  getPositionTitleById(db, id);
  const unlink = db.prepare(
    'UPDATE postings SET position_title_id = NULL WHERE position_title_id = ?'
  );
  const remove = db.prepare('DELETE FROM position_titles WHERE id = ?');
  const runDelete = db.transaction((titleId) => {
    const { changes: unlinkedPostingsCount } = unlink.run(titleId);
    remove.run(titleId);
    return unlinkedPostingsCount;
  });
  return { unlinkedPostingsCount: runDelete(id) };
}
