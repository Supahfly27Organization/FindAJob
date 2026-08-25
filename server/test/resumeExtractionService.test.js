import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Document, Packer, Paragraph } from 'docx';
import PDFDocument from 'pdfkit';
import { extractResumeText } from '../src/services/resumeExtractionService.js';

let tmpDir;

beforeAll(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'findajob-extract-'));
});

afterAll(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

describe('extractResumeText', () => {
  it('extracts text from a plain .txt file', async () => {
    const filePath = path.join(tmpDir, 'resume.txt');
    await fsp.writeFile(filePath, 'Jane Doe\nSoftware Engineer', 'utf-8');
    expect(await extractResumeText(filePath, 'txt')).toBe('Jane Doe\nSoftware Engineer');
  });

  it('extracts text from a .md file', async () => {
    const filePath = path.join(tmpDir, 'resume.md');
    await fsp.writeFile(filePath, '# Jane Doe\n\nSoftware Engineer', 'utf-8');
    expect(await extractResumeText(filePath, 'md')).toBe('# Jane Doe\n\nSoftware Engineer');
  });

  it('extracts text from a .docx file', async () => {
    const filePath = path.join(tmpDir, 'resume.docx');
    const doc = new Document({
      sections: [{ children: [new Paragraph('Jane Doe'), new Paragraph('Software Engineer at Acme')] }]
    });
    await fsp.writeFile(filePath, await Packer.toBuffer(doc));

    const text = await extractResumeText(filePath, 'docx');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Software Engineer at Acme');
  });

  it('extracts text from a .pdf file', async () => {
    const filePath = path.join(tmpDir, 'resume.pdf');
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', reject);
      doc.text('Jane Doe');
      doc.text('Software Engineer at Acme');
      doc.end();
    });

    const text = await extractResumeText(filePath, 'pdf');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Software Engineer at Acme');
  });
});
