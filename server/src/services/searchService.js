import { ValidationError, UpstreamError } from '../errors.js';
import { getOpenAiKey } from '../config.js';
import { getPositionTitleById } from './positionTitleService.js';
import { saveSearchResults } from './postingService.js';
import { searchJobPostings } from './openaiClient.js';

export async function searchPostingsForTitle(db, positionTitleId, { fetchPostings = searchJobPostings } = {}) {
  const title = getPositionTitleById(db, positionTitleId);

  const apiKey = getOpenAiKey();
  if (!apiKey) {
    throw new ValidationError('Set OPENAI_API_KEY in the .env file at the project root, then restart the app.');
  }

  let candidates;
  try {
    candidates = await fetchPostings(apiKey, title.title);
  } catch (error) {
    console.error('[search] OpenAI call failed for position title', positionTitleId, error);
    if (error?.status === 401) {
      throw new ValidationError('Your OpenAI API key was rejected. Update OPENAI_API_KEY in .env and restart the app.');
    }
    throw new UpstreamError('Search failed. Please try again.');
  }

  return saveSearchResults(db, positionTitleId, candidates);
}
