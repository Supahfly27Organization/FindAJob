import fs from 'node:fs';
import path from 'node:path';
import { ValidationError } from '../errors.js';
import { RESUME_TEMPLATE_DIR } from '../config.js';

const ALLOWED_FORMATS = ['docx', 'pdf', 'txt', 'md'];
const MAX_TEMPLATE_SIZE_BYTES = 10 * 1024 * 1024;

const PATH_KEY = 'resumeTemplatePath';
const NAME_KEY = 'resumeTemplateOriginalName';
const FORMAT_KEY = 'resumeTemplateFormat';

function getSetting(db, key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

function setSetting(db, key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export function getResumeTemplateStatus(db) {
  return {
    hasTemplate: Boolean(getSetting(db, NAME_KEY)),
    originalName: getSetting(db, NAME_KEY),
    format: getSetting(db, FORMAT_KEY)
  };
}

export function getResumeTemplateInfo(db) {
  const filePath = getSetting(db, PATH_KEY);
  const format = getSetting(db, FORMAT_KEY);
  if (!filePath || !format) {
    return null;
  }
  return { path: filePath, format };
}

export function saveResumeTemplate(db, file) {
  if (!file) {
    throw new ValidationError('Select a resume file to upload.');
  }
  if (file.size > MAX_TEMPLATE_SIZE_BYTES) {
    throw new ValidationError('Resume template must be 10MB or smaller.');
  }
  const ext = path.extname(file.originalname).toLowerCase().replace(/^\./, '');
  if (!ALLOWED_FORMATS.includes(ext)) {
    throw new ValidationError(`Unsupported file format. Supported formats: ${ALLOWED_FORMATS.join(', ')}.`);
  }

  fs.mkdirSync(RESUME_TEMPLATE_DIR, { recursive: true });

  const previousPath = getSetting(db, PATH_KEY);
  const newPath = path.join(RESUME_TEMPLATE_DIR, `template.${ext}`);

  fs.writeFileSync(newPath, file.buffer);
  if (previousPath && previousPath !== newPath && fs.existsSync(previousPath)) {
    fs.unlinkSync(previousPath);
  }

  setSetting(db, PATH_KEY, newPath);
  setSetting(db, NAME_KEY, file.originalname);
  setSetting(db, FORMAT_KEY, ext);

  return getResumeTemplateStatus(db);
}
