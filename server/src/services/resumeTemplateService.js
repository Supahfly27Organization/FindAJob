import fs from 'node:fs';
import { RESUME_TEMPLATE_FORMATS, resumeTemplatePathFor } from '../config.js';

// The resume template is simply `Resume.<format>` at the repo root — David keeps the file
// alongside the code instead of uploading it, so there is no Settings page and nothing
// about the template is stored in the DB.
export function getResumeTemplateInfo() {
  for (const format of RESUME_TEMPLATE_FORMATS) {
    const path = resumeTemplatePathFor(format);
    if (fs.existsSync(path)) {
      return { path, format };
    }
  }
  return null;
}
