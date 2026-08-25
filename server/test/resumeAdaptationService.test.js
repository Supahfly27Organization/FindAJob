import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { createDb } from '../src/db/index.js';
import { createPositionTitle } from '../src/services/positionTitleService.js';
import { saveSearchResults } from '../src/services/postingService.js';
import { saveOpenAiKey } from '../src/services/settingsService.js';
import { saveResumeTemplate, getResumeTemplateInfo } from '../src/services/resumeTemplateService.js';
import { adaptResumeForPosting } from '../src/services/resumeAdaptationService.js';
import { ValidationError, UpstreamError, NotFoundError } from '../src/errors.js';
import { RESUME_TEMPLATE_DIR, ADAPTED_RESUMES_DIR } from '../src/config.js';

let db;
let posting;

beforeEach(() => {
  db = createDb(':memory:');
  const title = createPositionTitle(db, 'Product Manager');
  saveSearchResults(db, title.id, [
    { postingTitle: 'Senior PM', description: 'Lead the product', company: 'Acme', url: 'https://example.com/job/1' }
  ]);
  [posting] = db.prepare('SELECT id FROM postings').all();
});

afterEach(() => {
  fs.rmSync(RESUME_TEMPLATE_DIR, { recursive: true, force: true });
  fs.rmSync(ADAPTED_RESUMES_DIR, { recursive: true, force: true });
});

describe('adaptResumeForPosting', () => {
  it('throws ValidationError when no API key is configured', async () => {
    saveResumeTemplate(db, { originalname: 'resume.txt', size: 10, buffer: Buffer.from('Jane Doe') });
    await expect(adaptResumeForPosting(db, posting.id)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when no resume template is configured', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    await expect(adaptResumeForPosting(db, posting.id)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError (not a generic error) when the configured template file has been deleted from disk', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, { originalname: 'resume.txt', size: 10, buffer: Buffer.from('Jane Doe') });
    fs.unlinkSync(getResumeTemplateInfo(db).path);

    await expect(adaptResumeForPosting(db, posting.id)).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError for a missing posting', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, { originalname: 'resume.txt', size: 10, buffer: Buffer.from('Jane Doe') });
    await expect(adaptResumeForPosting(db, 999)).rejects.toThrow(NotFoundError);
  });

  it('generates and saves an adapted resume using the injected adapter', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, {
      originalname: 'resume.txt',
      size: 10,
      buffer: Buffer.from('Jane Doe\nPM at Acme')
    });
    const adaptResume = vi.fn().mockResolvedValue({
      adaptedResumeText: 'Jane Doe\nSenior PM at Acme',
      originalPositionCount: 1,
      retainedPositionCount: 1
    });

    const updated = await adaptResumeForPosting(db, posting.id, { adaptResume });

    expect(adaptResume).toHaveBeenCalledWith(
      'sk-test1234567890',
      'Jane Doe\nPM at Acme',
      expect.objectContaining({ id: posting.id, postingTitle: 'Senior PM' })
    );
    expect(updated.adaptedResumePath).toMatch(/posting-\d+\.txt$/);
    expect(fs.readFileSync(updated.adaptedResumePath, 'utf-8')).toBe('Jane Doe\nSenior PM at Acme');
  });

  it('throws an UpstreamError when the adaptation drops a position', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, {
      originalname: 'resume.txt',
      size: 10,
      buffer: Buffer.from('Jane Doe\nPM at Acme\nQA at Beta')
    });
    const adaptResume = vi.fn().mockResolvedValue({
      adaptedResumeText: 'Jane Doe\nSenior PM at Acme',
      originalPositionCount: 2,
      retainedPositionCount: 1
    });

    await expect(adaptResumeForPosting(db, posting.id, { adaptResume })).rejects.toThrow(UpstreamError);
  });

  it('wraps a failed adaptation call in an UpstreamError', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, { originalname: 'resume.txt', size: 10, buffer: Buffer.from('Jane Doe') });
    const adaptResume = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(adaptResumeForPosting(db, posting.id, { adaptResume })).rejects.toThrow(UpstreamError);
  });

  it('reports a rejected API key as a ValidationError instead of a generic UpstreamError', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, { originalname: 'resume.txt', size: 10, buffer: Buffer.from('Jane Doe') });
    const authError = new Error('Incorrect API key provided');
    authError.status = 401;
    const adaptResume = vi.fn().mockRejectedValue(authError);

    await expect(adaptResumeForPosting(db, posting.id, { adaptResume })).rejects.toThrow(ValidationError);
  });
});
