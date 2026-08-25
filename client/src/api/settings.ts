import { apiFetch } from './http';

export interface OpenAiKeyStatus {
  hasKey: boolean;
  maskedKey: string | null;
}

export function fetchOpenAiKeyStatus(): Promise<OpenAiKeyStatus> {
  return apiFetch<OpenAiKeyStatus>('/api/settings/openai-key');
}

export function saveOpenAiKey(apiKey: string): Promise<OpenAiKeyStatus> {
  return apiFetch<OpenAiKeyStatus>('/api/settings/openai-key', {
    method: 'PUT',
    body: JSON.stringify({ apiKey })
  });
}
