import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateResumeDocument } from '../src/services/resumeGenerationService.js';
import { extractResumeText } from '../src/services/resumeExtractionService.js';

let tmpDir;

beforeAll(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'findajob-generate-'));
});

afterAll(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

describe('generateResumeDocument', () => {
  it('writes a plain .txt file with the exact text, creating parent directories', async () => {
    const outputPath = path.join(tmpDir, 'nested', 'resume.txt');
    await generateResumeDocument('Jane Doe\nSoftware Engineer', 'txt', outputPath);
    expect(await fsp.readFile(outputPath, 'utf-8')).toBe('Jane Doe\nSoftware Engineer');
  });

  it('writes a .md file with the exact text', async () => {
    const outputPath = path.join(tmpDir, 'resume.md');
    await generateResumeDocument('# Jane Doe', 'md', outputPath);
    expect(await fsp.readFile(outputPath, 'utf-8')).toBe('# Jane Doe');
  });

  it('writes a .docx file whose text can be extracted back', async () => {
    const outputPath = path.join(tmpDir, 'resume.docx');
    await generateResumeDocument('Jane Doe\nSoftware Engineer at Acme', 'docx', outputPath);
    const text = await extractResumeText(outputPath, 'docx');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Software Engineer at Acme');
  });

  it('writes a .pdf file whose text can be extracted back', async () => {
    const outputPath = path.join(tmpDir, 'resume.pdf');
    await generateResumeDocument('Jane Doe\nSoftware Engineer at Acme', 'pdf', outputPath);
    const text = await extractResumeText(outputPath, 'pdf');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Software Engineer at Acme');
  });
});
