import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import { getResumeTemplateInfo } from '../src/services/resumeTemplateService.js';
import { RESUME_TEMPLATE_FORMATS, resumeTemplatePathFor } from '../src/config.js';

afterEach(() => {
  for (const format of RESUME_TEMPLATE_FORMATS) {
    fs.rmSync(resumeTemplatePathFor(format), { force: true });
  }
});

describe('getResumeTemplateInfo', () => {
  it('returns null when no Resume file exists at the repo root', () => {
    expect(getResumeTemplateInfo()).toBeNull();
  });

  it('finds Resume.docx at the repo root', () => {
    fs.writeFileSync(resumeTemplatePathFor('docx'), 'fake docx bytes');
    expect(getResumeTemplateInfo()).toEqual({ path: resumeTemplatePathFor('docx'), format: 'docx' });
  });

  it.each(RESUME_TEMPLATE_FORMATS)('accepts Resume.%s', (format) => {
    fs.writeFileSync(resumeTemplatePathFor(format), 'resume contents');
    expect(getResumeTemplateInfo()).toEqual({ path: resumeTemplatePathFor(format), format });
  });

  it('prefers .docx when several Resume files exist', () => {
    fs.writeFileSync(resumeTemplatePathFor('txt'), 'text resume');
    fs.writeFileSync(resumeTemplatePathFor('docx'), 'fake docx bytes');
    expect(getResumeTemplateInfo().format).toBe('docx');
  });

  it('returns null again once the file is removed', () => {
    fs.writeFileSync(resumeTemplatePathFor('txt'), 'text resume');
    fs.rmSync(resumeTemplatePathFor('txt'));
    expect(getResumeTemplateInfo()).toBeNull();
  });
});
