import { apiFetch, apiUpload } from './http';

export interface ResumeTemplateStatus {
  hasTemplate: boolean;
  originalName: string | null;
  format: string | null;
}

export function fetchResumeTemplateStatus(): Promise<ResumeTemplateStatus> {
  return apiFetch<ResumeTemplateStatus>('/api/settings/resume-template');
}

export function uploadResumeTemplate(file: File): Promise<ResumeTemplateStatus> {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<ResumeTemplateStatus>('/api/settings/resume-template', formData);
}
