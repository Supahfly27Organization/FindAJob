import { apiFetch, apiUpload } from './http';
import type { Posting } from '../types';

export interface SearchResult {
  totalFound: number;
  savedCount: number;
}

export function searchPostingsForTitle(positionTitleId: number): Promise<SearchResult> {
  return apiFetch<SearchResult>(`/api/position-titles/${positionTitleId}/search`, {
    method: 'POST'
  });
}

export function fetchPostingsForTitle(positionTitleId: number, status?: string): Promise<Posting[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<Posting[]>(`/api/position-titles/${positionTitleId}/postings${query}`);
}

export function markPostingViewed(id: number): Promise<Posting> {
  return apiFetch<Posting>(`/api/postings/${id}/viewed`, { method: 'PUT' });
}

export function updatePostingStatus(id: number, status: string): Promise<Posting> {
  return apiFetch<Posting>(`/api/postings/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

export function adaptResumeForPosting(id: number): Promise<Posting> {
  return apiFetch<Posting>(`/api/postings/${id}/adapt-resume`, { method: 'POST' });
}

// Uploading the CV she actually submitted is what moves a posting to "Applied" —
// there is deliberately no way to set that status without a file (Story 3.3).
export function uploadAppliedCv(id: number, file: File): Promise<Posting> {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<Posting>(`/api/postings/${id}/applied-cv`, formData);
}
