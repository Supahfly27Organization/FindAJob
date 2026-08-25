import { useEffect, useState, type FormEvent } from 'react';
import { fetchOpenAiKeyStatus, saveOpenAiKey, type OpenAiKeyStatus } from '../api/settings';
import {
  fetchResumeTemplateStatus,
  uploadResumeTemplate,
  type ResumeTemplateStatus
} from '../api/resumeTemplate';
import { ApiError } from '../api/http';

export default function SettingsPage() {
  const [status, setStatus] = useState<OpenAiKeyStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [templateStatus, setTemplateStatus] = useState<ResumeTemplateStatus | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  async function loadStatus() {
    setLoadError(null);
    try {
      setStatus(await fetchOpenAiKeyStatus());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load API key status');
    }
  }

  async function loadTemplateStatus() {
    setTemplateLoadError(null);
    try {
      setTemplateStatus(await fetchResumeTemplateStatus());
    } catch (err) {
      setTemplateLoadError(err instanceof ApiError ? err.message : 'Failed to load resume template status');
    }
  }

  useEffect(() => {
    loadStatus();
    loadTemplateStatus();
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await saveOpenAiKey(apiKey);
      setStatus(updated);
      setApiKey('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  }

  async function handleTemplateUpload(event: FormEvent) {
    event.preventDefault();
    setTemplateError(null);
    if (!templateFile) {
      setTemplateError('Select a resume file first.');
      return;
    }
    setUploadingTemplate(true);
    try {
      const updated = await uploadResumeTemplate(templateFile);
      setTemplateStatus(updated);
      setTemplateFile(null);
    } catch (err) {
      setTemplateError(err instanceof ApiError ? err.message : 'Failed to upload resume template');
    } finally {
      setUploadingTemplate(false);
    }
  }

  return (
    <section>
      <h1>Settings</h1>

      {loadError && <p role="alert">{loadError}</p>}

      <h2>OpenAI API key</h2>
      {status?.hasKey ? (
        <p>Current key on file: {status.maskedKey}</p>
      ) : (
        <p>No API key configured yet. Search and resume adaptation won't work until one is set.</p>
      )}

      <form onSubmit={handleSave}>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-..."
          aria-label="OpenAI API key"
        />
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>

      <h2>Resume template</h2>
      {templateLoadError && <p role="alert">{templateLoadError}</p>}
      {templateStatus?.hasTemplate ? (
        <p>
          Current template: {templateStatus.originalName} ({templateStatus.format})
        </p>
      ) : (
        <p>No resume template configured yet. Resume adaptation won't work until one is set.</p>
      )}

      <form onSubmit={handleTemplateUpload}>
        <input
          type="file"
          accept=".docx,.pdf,.txt,.md"
          aria-label="Resume template file"
          onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={uploadingTemplate}>
          {uploadingTemplate ? 'Uploading…' : 'Upload'}
        </button>
        {templateError && <p role="alert">{templateError}</p>}
      </form>
    </section>
  );
}
