import { apiFetch } from './http';
import type { PositionTitle } from '../types';

export function fetchPositionTitles(): Promise<PositionTitle[]> {
  return apiFetch<PositionTitle[]>('/api/position-titles');
}

export function createPositionTitle(title: string): Promise<PositionTitle> {
  return apiFetch<PositionTitle>('/api/position-titles', {
    method: 'POST',
    body: JSON.stringify({ title })
  });
}

export function updatePositionTitle(id: number, title: string): Promise<PositionTitle> {
  return apiFetch<PositionTitle>(`/api/position-titles/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title })
  });
}

export function deletePositionTitle(id: number): Promise<{ unlinkedPostingsCount: number }> {
  return apiFetch(`/api/position-titles/${id}`, { method: 'DELETE' });
}
