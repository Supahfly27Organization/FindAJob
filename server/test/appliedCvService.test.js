import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { createDb } from '../src/db/index.js';
import { createPositionTitle } from '../src/services/positionTitleService.js';
import { saveSearchResults, listPostingsForTitle, updatePostingStatus } from '../src/services/postingService.js';
import { saveAppliedCv, getAppliedCv } from '../src/services/appliedCvService.js';
import { ValidationError, NotFoundError } from '../src/errors.js';
import { APPLIED_CVS_DIR } from '../src/config.js';

let db;
let posting;

function file(originalname, contents = 'cv contents', size) {
  const buffer = Buffer.from(contents);
  return { originalname, size: size ?? buffer.length, buffer };
}

beforeEach(() => {
  db = createDb(':memory:');
  const title = createPositionTitle(db, 'Product Manager');
  saveSearchResults(db, title.id, [
    { postingTitle: 'Senior Product Manager', url: 'https://example.com/job/1' }
  ]);
  [posting] = listPostingsForTitle(db, title.id);
});

afterEach(() => {
  fs.rmSync(APPLIED_CVS_DIR, { recursive: true, force: true });
});

describe('saveAppliedCv', () => {
  it('saves the file and marks the posting Applied', () => {
    const updated = saveAppliedCv(db, posting.id, file('my-cv.docx'));

    expect(updated.status).toBe('Applied');
    expect(updated.appliedCvOriginalName).toBe('my-cv.docx');
    expect(updated.appliedCvPath).toMatch(new RegExp(`posting-${posting.id}\\.docx$`));
    expect(fs.readFileSync(updated.appliedCvPath, 'utf-8')).toBe('cv contents');
  });

  it('accepts docx, pdf, txt and md', () => {
    for (const ext of ['docx', 'pdf', 'txt', 'md']) {
      expect(() => saveAppliedCv(db, posting.id, file(`cv.${ext}`))).not.toThrow();
    }
  });

  it('replaces a previously uploaded CV, removing the old file', () => {
    const first = saveAppliedCv(db, posting.id, file('old-cv.txt', 'old'));
    const second = saveAppliedCv(db, posting.id, file('new-cv.pdf', 'new'));

    expect(fs.existsSync(first.appliedCvPath)).toBe(false);
    expect(second.appliedCvOriginalName).toBe('new-cv.pdf');
    expect(fs.readFileSync(second.appliedCvPath, 'utf-8')).toBe('new');
  });

  it('keeps the CV on file when the status is later moved off Applied', () => {
    saveAppliedCv(db, posting.id, file('my-cv.txt'));
    const moved = updatePostingStatus(db, posting.id, 'Rejected');

    expect(moved.status).toBe('Rejected');
    expect(moved.appliedCvPath).toBeTruthy();
    expect(fs.existsSync(moved.appliedCvPath)).toBe(true);
  });

  it('rejects an unsupported file format without changing the status', () => {
    expect(() => saveAppliedCv(db, posting.id, file('cv.pages'))).toThrow(ValidationError);
    expect(() => saveAppliedCv(db, posting.id, file('cv.pages'))).toThrow(/unsupported file format/i);
    expect(listPostingsForTitle(db, posting.positionTitleId)[0].status).toBe('New');
  });

  it('rejects a file larger than 10MB', () => {
    expect(() => saveAppliedCv(db, posting.id, file('cv.docx', 'x', 11 * 1024 * 1024))).toThrow(/10MB/);
  });

  it('rejects when no file is provided', () => {
    expect(() => saveAppliedCv(db, posting.id, undefined)).toThrow(ValidationError);
  });

  it('throws NotFoundError for a missing posting', () => {
    expect(() => saveAppliedCv(db, 999, file('cv.docx'))).toThrow(NotFoundError);
  });
});

describe('getAppliedCv', () => {
  it('returns the stored path and original filename', () => {
    saveAppliedCv(db, posting.id, file('Noa CV - Acme.docx'));
    expect(getAppliedCv(db, posting.id)).toEqual({
      path: expect.stringMatching(/posting-\d+\.docx$/),
      originalName: 'Noa CV - Acme.docx'
    });
  });

  it('throws NotFoundError when no CV has been uploaded', () => {
    expect(() => getAppliedCv(db, posting.id)).toThrow(NotFoundError);
  });

  it('throws NotFoundError when the stored file has been deleted from disk', () => {
    const updated = saveAppliedCv(db, posting.id, file('cv.txt'));
    fs.unlinkSync(updated.appliedCvPath);

    expect(() => getAppliedCv(db, posting.id)).toThrow(NotFoundError);
  });
});
