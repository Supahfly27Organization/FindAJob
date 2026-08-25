import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './SettingsPage';

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  let call = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const response = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return {
        ok: response.status < 400,
        status: response.status,
        json: async () => response.body
      } as Response;
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SettingsPage', () => {
  it('shows that no key is configured initially', async () => {
    mockFetchSequence([{ status: 200, body: { hasKey: false, maskedKey: null } }]);
    render(<SettingsPage />);
    expect(await screen.findByText(/no api key configured/i)).toBeInTheDocument();
  });

  it('shows the masked key once one is saved', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      { status: 200, body: { hasKey: true, maskedKey: '••••mnop' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no api key configured/i);

    await user.type(screen.getByLabelText(/openai api key/i), 'sk-abcdefghijklmnop');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/••••mnop/)).toBeInTheDocument();
  });

  it('shows a validation error when saving fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      { status: 400, body: { message: 'That does not look like a valid OpenAI API key' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no api key configured/i);

    await user.type(screen.getByLabelText(/openai api key/i), 'nope');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That does not look like a valid OpenAI API key'
    );
  });

  it('shows an error when the initial status fetch fails', async () => {
    mockFetchSequence([{ status: 500, body: { message: 'Failed to load API key status' } }]);
    render(<SettingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load API key status');
  });
});
