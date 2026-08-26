import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { createDb } from '../src/db/index.js';
import { createPositionTitle } from '../src/services/positionTitleService.js';
import { saveSearchResults } from '../src/services/postingService.js';
import { adaptResumeForPosting } from '../src/services/resumeAdaptationService.js';
import { ValidationError, UpstreamError, NotFoundError } from '../src/errors.js';
import { ADAPTED_RESUMES_DIR, RESUME_TEMPLATE_FORMATS, resumeTemplatePathFor } from '../src/config.js';

let db;
let posting;

// Both inputs are now files/env at the repo root, not DB rows: OPENAI_API_KEY in .env
// (blanked suite-wide by vitest.config.js) and Resume.<format> at the project root.
function configureApiKey() {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test1234567890');
}

function writeTemplate(contents, format = 'txt') {
  fs.writeFileSync(resumeTemplatePathFor(format), contents);
}

beforeEach(() => {
  db = createDb(':memory:');
  const title = createPositionTitle(db, 'Product Manager');
  saveSearchResults(db, title.id, [
    { postingTitle: 'Senior PM', description: 'Lead the product', company: 'Acme', url: 'https://example.com/job/1' }
  ]);
  [posting] = db.prepare('SELECT id FROM postings').all();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const format of RESUME_TEMPLATE_FORMATS) {
    fs.rmSync(resumeTemplatePathFor(format), { force: true });
  }
  fs.rmSync(ADAPTED_RESUMES_DIR, { recursive: true, force: true });
});

describe('adaptResumeForPosting', () => {
  it('throws ValidationError when OPENAI_API_KEY is not set', async () => {
    writeTemplate('Jane Doe');
    await expect(adaptResumeForPosting(db, posting.id)).rejects.toThrow(ValidationError);
    await expect(adaptResumeForPosting(db, posting.id)).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it('throws ValidationError when there is no Resume file at the project root', async () => {
    configureApiKey();
    await expect(adaptResumeForPosting(db, posting.id)).rejects.toThrow(ValidationError);
    await expect(adaptResumeForPosting(db, posting.id)).rejects.toThrow(/Resume\.docx/);
  });

  it('throws NotFoundError for a missing posting', async () => {
    configureApiKey();
    writeTemplate('Jane Doe');
    await expect(adaptResumeForPosting(db, 999)).rejects.toThrow(NotFoundError);
  });

  it('generates and saves an adapted resume using the injected adapter', async () => {
    configureApiKey();
    writeTemplate('Jane Doe\nPM at Acme');
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
    configureApiKey();
    writeTemplate('Jane Doe\nPM at Acme\nQA at Beta');
    const adaptResume = vi.fn().mockResolvedValue({
      adaptedResumeText: 'Jane Doe\nSenior PM at Acme',
      originalPositionCount: 2,
      retainedPositionCount: 1
    });

    await expect(adaptResumeForPosting(db, posting.id, { adaptResume })).rejects.toThrow(UpstreamError);
  });

  it('wraps a failed adaptation call in an UpstreamError', async () => {
    configureApiKey();
    writeTemplate('Jane Doe');
    const adaptResume = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(adaptResumeForPosting(db, posting.id, { adaptResume })).rejects.toThrow(UpstreamError);
  });

  it('reports a rejected API key as a ValidationError instead of a generic UpstreamError', async () => {
    configureApiKey();
    writeTemplate('Jane Doe');
    const authError = new Error('Incorrect API key provided');
    authError.status = 401;
    const adaptResume = vi.fn().mockRejectedValue(authError);

    await expect(adaptResumeForPosting(db, posting.id, { adaptResume })).rejects.toThrow(ValidationError);
  });
});
