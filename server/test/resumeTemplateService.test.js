import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { createDb } from '../src/db/index.js';
import {
  getResumeTemplateStatus,
  getResumeTemplateInfo,
  saveResumeTemplate
} from '../src/services/resumeTemplateService.js';
import { ValidationError } from '../src/errors.js';
import { RESUME_TEMPLATE_DIR } from '../src/config.js';

let db;

beforeEach(() => {
  db = createDb(':memory:');
});

afterEach(() => {
  fs.rmSync(RESUME_TEMPLATE_DIR, { recursive: true, force: true });
});

describe('getResumeTemplateStatus', () => {
  it('reports no template configured initially', () => {
    expect(getResumeTemplateStatus(db)).toEqual({ hasTemplate: false, originalName: null, format: null });
  });

  it('reports hasTemplate: false when the underlying file has been deleted', () => {
    saveResumeTemplate(db, { originalname: 'resume.txt', size: 10, buffer: Buffer.from('hello') });
    const info = getResumeTemplateInfo(db);
    fs.unlinkSync(info.path);

    const status = getResumeTemplateStatus(db);
    expect(status.hasTemplate).toBe(false);
  });
});

describe('saveResumeTemplate', () => {
  it('saves a valid .docx template and reports it back', () => {
    const file = { originalname: 'resume.docx', size: 1024, buffer: Buffer.from('fake docx bytes') };
    const status = saveResumeTemplate(db, file);
    expect(status).toEqual({ hasTemplate: true, originalName: 'resume.docx', format: 'docx' });
    expect(getResumeTemplateStatus(db)).toEqual(status);
  });

  it('exposes the saved file path and format via getResumeTemplateInfo', () => {
    const file = { originalname: 'resume.txt', size: 10, buffer: Buffer.from('hello') };
    saveResumeTemplate(db, file);
    const info = getResumeTemplateInfo(db);
    expect(info.format).toBe('txt');
    expect(info.path).toMatch(/template\.txt$/);
    expect(fs.readFileSync(info.path, 'utf-8')).toBe('hello');
  });

  it('returns null from getResumeTemplateInfo when no template is set', () => {
    expect(getResumeTemplateInfo(db)).toBeNull();
  });

  it('returns null from getResumeTemplateInfo when the underlying file has been deleted', () => {
    const file = { originalname: 'resume.txt', size: 10, buffer: Buffer.from('hello') };
    saveResumeTemplate(db, file);
    const info = getResumeTemplateInfo(db);
    fs.unlinkSync(info.path);

    expect(getResumeTemplateInfo(db)).toBeNull();
  });

  it('replaces a previous template when a new one is uploaded', () => {
    saveResumeTemplate(db, { originalname: 'old.docx', size: 10, buffer: Buffer.from('old') });
    const status = saveResumeTemplate(db, { originalname: 'new.pdf', size: 10, buffer: Buffer.from('new') });
    expect(status).toEqual({ hasTemplate: true, originalName: 'new.pdf', format: 'pdf' });
    expect(getResumeTemplateInfo(db).format).toBe('pdf');
  });

  it('rejects an unsupported file format', () => {
    const file = { originalname: 'resume.pages', size: 10, buffer: Buffer.from('x') };
    expect(() => saveResumeTemplate(db, file)).toThrow(ValidationError);
    expect(() => saveResumeTemplate(db, file)).toThrow(/unsupported file format/i);
  });

  it('rejects a file larger than 10MB', () => {
    const file = { originalname: 'resume.docx', size: 11 * 1024 * 1024, buffer: Buffer.alloc(0) };
    expect(() => saveResumeTemplate(db, file)).toThrow(ValidationError);
    expect(() => saveResumeTemplate(db, file)).toThrow(/10MB/);
  });

  it('rejects when no file is provided', () => {
    expect(() => saveResumeTemplate(db, undefined)).toThrow(ValidationError);
  });
});
