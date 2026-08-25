import { ValidationError, UpstreamError } from '../errors.js';
import { getOpenAiKey } from './settingsService.js';
import { getPositionTitleById } from './positionTitleService.js';
import { saveSearchResults } from './postingService.js';
import { searchJobPostings } from './openaiClient.js';

export async function searchPostingsForTitle(db, positionTitleId, { fetchPostings = searchJobPostings } = {}) {
  const title = getPositionTitleById(db, positionTitleId);

  const apiKey = getOpenAiKey(db);
  if (!apiKey) {
    throw new ValidationError('Configure your OpenAI API key in Settings before searching.');
  }

  let candidates;
  try {
    candidates = await fetchPostings(apiKey, title.title);
  } catch {
    throw new UpstreamError('Search failed. Please try again.');
  }

  return saveSearchResults(db, positionTitleId, candidates);
}
