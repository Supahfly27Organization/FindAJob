import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Document, Packer, Paragraph } from 'docx';
import PDFDocument from 'pdfkit';

async function generateDocx(text, outputPath) {
  const paragraphs = text.split(/\r?\n/).map((line) => new Paragraph(line));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);
  await fsp.writeFile(outputPath, buffer);
}

function generatePdf(text, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    doc.on('error', reject);
    stream.on('finish', resolve);
    stream.on('error', reject);
    for (const line of text.split(/\r?\n/)) {
      doc.text(line);
    }
    doc.end();
  });
}

export async function generateResumeDocument(text, format, outputPath) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  if (format === 'docx') {
    await generateDocx(text, outputPath);
    return;
  }
  if (format === 'pdf') {
    await generatePdf(text, outputPath);
    return;
  }
  await fsp.writeFile(outputPath, text, 'utf-8');
}
