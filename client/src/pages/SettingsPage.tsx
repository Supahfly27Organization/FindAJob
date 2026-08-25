import { useEffect, useState, type FormEvent } from 'react';
import { fetchOpenAiKeyStatus, saveOpenAiKey, type OpenAiKeyStatus } from '../api/settings';
import { ApiError } from '../api/http';

export default function SettingsPage() {
  const [status, setStatus] = useState<OpenAiKeyStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadStatus() {
    setStatus(await fetchOpenAiKeyStatus());
  }

  useEffect(() => {
    loadStatus();
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

  return (
    <section>
      <h1>Settings</h1>

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
    </section>
  );
}
