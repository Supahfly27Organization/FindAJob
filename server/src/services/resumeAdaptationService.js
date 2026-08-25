import path from 'node:path';
import { ValidationError, UpstreamError } from '../errors.js';
import { getOpenAiKey } from './settingsService.js';
import { getResumeTemplateInfo } from './resumeTemplateService.js';
import { getPostingById, setAdaptedResumePath } from './postingService.js';
import { extractResumeText } from './resumeExtractionService.js';
import { generateResumeDocument } from './resumeGenerationService.js';
import { adaptResumeText } from './openaiClient.js';
import { ADAPTED_RESUMES_DIR } from '../config.js';

export async function adaptResumeForPosting(db, postingId, { adaptResume = adaptResumeText } = {}) {
  const posting = getPostingById(db, postingId);

  const apiKey = getOpenAiKey(db);
  if (!apiKey) {
    throw new ValidationError('Configure your OpenAI API key in Settings before adapting your resume.');
  }

  const template = getResumeTemplateInfo(db);
  if (!template) {
    throw new ValidationError('Configure your resume template in Settings before adapting your resume.');
  }

  const templateText = await extractResumeText(template.path, template.format);

  let result;
  try {
    result = await adaptResume(apiKey, templateText, posting);
  } catch (error) {
    console.error('[resume-adaptation] OpenAI call failed for posting', postingId, error);
    if (error?.status === 401) {
      throw new ValidationError('Your OpenAI API key was rejected. Update it in Settings.');
    }
    throw new UpstreamError('Resume adaptation failed. Please try again.');
  }

  if (result.retainedPositionCount < result.originalPositionCount) {
    throw new UpstreamError(
      'The adapted resume appears to have dropped part of your work history. Please try again.'
    );
  }

  const outputPath = path.join(ADAPTED_RESUMES_DIR, `posting-${postingId}.${template.format}`);
  await generateResumeDocument(result.adaptedResumeText, template.format, outputPath);

  setAdaptedResumePath(db, postingId, outputPath);
  return getPostingById(db, postingId);
}
