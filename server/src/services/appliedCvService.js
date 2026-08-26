import fs from 'node:fs';
import path from 'node:path';
import { NotFoundError, ValidationError } from '../errors.js';
import { APPLIED_CVS_DIR } from '../config.js';
import { getPostingById, setAppliedCv } from './postingService.js';

const ALLOWED_FORMATS = ['docx', 'pdf', 'txt', 'md'];
const MAX_CV_SIZE_BYTES = 10 * 1024 * 1024;

// The CV she actually submitted for a posting — distinct from the AI-adapted draft
// (adapted_resume_path). One file per posting, overwritten when she re-uploads.
export function saveAppliedCv(db, postingId, file) {
  const posting = getPostingById(db, postingId);

  if (!file) {
    throw new ValidationError('Select the CV file you used for this application.');
  }
  if (file.size > MAX_CV_SIZE_BYTES) {
    throw new ValidationError('Applied CV must be 10MB or smaller.');
  }
  const ext = path.extname(file.originalname).toLowerCase().replace(/^\./, '');
  if (!ALLOWED_FORMATS.includes(ext)) {
    throw new ValidationError(`Unsupported file format. Supported formats: ${ALLOWED_FORMATS.join(', ')}.`);
  }

  fs.mkdirSync(APPLIED_CVS_DIR, { recursive: true });

  const previousPath = posting.appliedCvPath;
  const newPath = path.join(APPLIED_CVS_DIR, `posting-${postingId}.${ext}`);

  // Written before the DB update: if the disk write fails the status stays put
  // (Story 3.3 edge case — a failed upload must not leave a posting marked Applied).
  fs.writeFileSync(newPath, file.buffer);
  if (previousPath && previousPath !== newPath && fs.existsSync(previousPath)) {
    fs.unlinkSync(previousPath);
  }

  return setAppliedCv(db, postingId, newPath, file.originalname);
}

export function getAppliedCv(db, postingId) {
  const posting = getPostingById(db, postingId);
  if (!posting.appliedCvPath || !fs.existsSync(posting.appliedCvPath)) {
    throw new NotFoundError('No applied CV has been uploaded for this posting yet.');
  }
  return {
    path: posting.appliedCvPath,
    originalName: posting.appliedCvOriginalName || path.basename(posting.appliedCvPath)
  };
}
