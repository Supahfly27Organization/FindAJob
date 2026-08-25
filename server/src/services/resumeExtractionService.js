import fs from 'node:fs/promises';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export async function extractResumeText(filePath, format) {
  if (format === 'docx') {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value.trim();
  }
  if (format === 'pdf') {
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }
  const text = await fs.readFile(filePath, 'utf-8');
  return text.trim();
}
