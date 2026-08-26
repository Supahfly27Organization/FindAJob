import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { PositionTitle } from '../types';
import {
  createPositionTitle,
  deletePositionTitle,
  fetchPositionTitles,
  updatePositionTitle
} from '../api/positionTitles';
import { searchPostingsForTitle, type SearchResult } from '../api/postings';
import { ApiError } from '../api/http';
import './PositionTitlesPage.css';

type SearchState = 'idle' | 'searching' | 'done' | 'error';

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function PositionTitlesPage() {
  const [titles, setTitles] = useState<PositionTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [searchState, setSearchState] = useState<Record<number, SearchState>>({});
  const [searchErrors, setSearchErrors] = useState<Record<number, string>>({});
  const [searchResults, setSearchResults] = useState<Record<number, SearchResult>>({});
  const [searchingAll, setSearchingAll] = useState(false);

  // Presentation-only run state: drives the live progress readout. A 30s+ AI
  // call with nothing but a disabled button is the worst finding in the audit.
  const [startedAt, setStartedAt] = useState<Record<number, number>>({});
  const [, setTick] = useState(0);
  const [runProgress, setRunProgress] = useState<{ current: number; total: number; label: string } | null>(
    null
  );
  const stopRequested = useRef(false);

  const editInputRef = useRef<HTMLInputElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.title = 'Position titles · FindAJob';
  }, []);

  // Tick once a second only while something is actually running.
  const anyRunning = Object.keys(startedAt).length > 0;
  useEffect(() => {
    if (!anyRunning) {
      return;
    }
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  // Focus follows the state change instead of being dropped on the floor.
  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus();
    }
  }, [editingId]);

  useEffect(() => {
    if (confirmingDeleteId !== null) {
      confirmButtonRef.current?.focus();
    }
  }, [confirmingDeleteId]);

  async function loadTitles() {
    setLoading(true);
    setListError(null);
    try {
      setTitles(await fetchPositionTitles());
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : 'Failed to load position titles');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }

  useEffect(() => {
    loadTitles();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setAddError(null);
    try {
      await createPositionTitle(newTitle);
      setNewTitle('');
      await loadTitles();
    } catch (error) {
      setAddError(error instanceof ApiError ? error.message : 'Failed to add title');
    }
  }

  function startEditing(title: PositionTitle) {
    setEditingId(title.id);
    setEditingValue(title.title);
    setEditError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingValue('');
    setEditError(null);
  }

  async function saveEditing(id: number) {
    setEditError(null);
    try {
      await updatePositionTitle(id, editingValue);
      cancelEditing();
      await loadTitles();
    } catch (error) {
      setEditError(error instanceof ApiError ? error.message : 'Failed to update title');
    }
  }

  async function confirmDelete(id: number) {
    setDeleteError(null);
    try {
      await deletePositionTitle(id);
      setConfirmingDeleteId(null);
      await loadTitles();
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'Failed to delete title');
    }
  }

  async function runSearch(titleId: number) {
    setSearchState((prev) => ({ ...prev, [titleId]: 'searching' }));
    setStartedAt((prev) => ({ ...prev, [titleId]: Date.now() }));
    setSearchErrors((prev) => {
      const next = { ...prev };
      delete next[titleId];
      return next;
    });
    setSearchResults((prev) => {
      const next = { ...prev };
      delete next[titleId];
      return next;
    });
    try {
      const result = await searchPostingsForTitle(titleId);
      setSearchState((prev) => ({ ...prev, [titleId]: 'done' }));
      setSearchResults((prev) => ({ ...prev, [titleId]: result }));
      await loadTitles();
    } catch (error) {
      setSearchState((prev) => ({ ...prev, [titleId]: 'error' }));
      setSearchErrors((prev) => ({
        ...prev,
        [titleId]: error instanceof ApiError ? error.message : 'Search failed'
      }));
    } finally {
      setStartedAt((prev) => {
        const next = { ...prev };
        delete next[titleId];
        return next;
      });
    }
  }

  async function handleSearchAll() {
    stopRequested.current = false;
    setSearchingAll(true);
    try {
      for (const [index, title] of titles.entries()) {
        if (stopRequested.current) {
          break;
        }
        setRunProgress({ current: index + 1, total: titles.length, label: title.title });
        await runSearch(title.id);
      }
    } finally {
      stopRequested.current = false;
      setRunProgress(null);
      setSearchingAll(false);
    }
  }

  function searchResultMessage(titleId: number): string {
    const result = searchResults[titleId];
    if (!result) {
      return '';
    }
    if (result.totalFound === 0) {
      return 'No matching postings found in the last 45 days.';
    }
    if (result.savedCount === 0) {
      return 'No new postings — all were already in your list.';
    }
    return `${result.savedCount} new posting${result.savedCount === 1 ? '' : 's'} found.`;
  }

  function elapsedFor(titleId: number): string | null {
    const start = startedAt[titleId];
    return start === undefined ? null : formatElapsed(Date.now() - start);
  }

  const totalPostings = titles.reduce((sum, title) => sum + title.postingCount, 0);

  return (
    <section aria-labelledby="log-title">
      <div className="log-head">
        <h1 id="log-title">Position Titles</h1>
        {hasLoaded && titles.length > 0 && (
          <p className="log-standfirst">
            {titles.length} {titles.length === 1 ? 'title' : 'titles'} tracked · {totalPostings}{' '}
            {totalPostings === 1 ? 'posting' : 'postings'} logged
          </p>
        )}
      </div>

      <div className="log-controls">
        <form className="log-add-form" onSubmit={handleAdd} aria-label="Add position title">
          <div className="field">
            <label className="field-label" htmlFor="new-title">
              New position title
            </label>
            <input
              id="new-title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="e.g. Product Manager"
              aria-invalid={addError ? true : undefined}
              aria-describedby={addError ? 'new-title-error' : undefined}
            />
            {addError && (
              <p className="field-error" id="new-title-error" role="alert">
                {addError}
              </p>
            )}
          </div>
          <button className="btn btn-primary" type="submit">
            Add
          </button>
        </form>

        <div className="log-run">
          <button
            className="btn btn-secondary"
            onClick={handleSearchAll}
            disabled={searchingAll || titles.length === 0}
          >
            Search all
          </button>
          {searchingAll && (
            <button
              className="btn btn-quiet btn-stop"
              onClick={() => (stopRequested.current = true)}
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="run-line">
        <p className="run-status" aria-live="polite">
          {runProgress
            ? `Searching ${runProgress.current} of ${runProgress.total} · ${runProgress.label}`
            : ''}
        </p>
        {runProgress && (
          <span className="run-status" aria-hidden="true">
            {elapsedFor(titles[runProgress.current - 1]?.id ?? -1) ?? '00:00'}
          </span>
        )}
      </div>
      {runProgress && (
        <div className="run-progress" aria-hidden="true">
          <i style={{ transform: `scaleX(${runProgress.current / runProgress.total})` }} />
        </div>
      )}

      {listError && (
        <div className="alert-block">
          <p className="alert-msg" role="alert">
            {listError}
          </p>
          <button className="btn btn-secondary" onClick={loadTitles}>
            Try again
          </button>
        </div>
      )}

      {!hasLoaded ? (
        <div className="log-skeleton" aria-busy="true" aria-label="Loading position titles">
          {[0, 1, 2].map((row) => (
            <div className="skel-entry" key={row}>
              <div className="skel-line" style={{ width: '46%', height: 20 }} />
              <div className="skel-line" style={{ width: '28%' }} />
            </div>
          ))}
        </div>
      ) : titles.length === 0 ? (
        <div className="log-empty">
          {/* Deliberately a <p>, not a heading: App.test queries
              getByRole('heading', { name: /position titles/i }) and a second
              matching heading would make that query ambiguous. */}
          <p className="log-empty-title">No position titles yet.</p>
          <p>Add the job titles you&rsquo;re searching for above and the log starts filling.</p>
          <p>
            Searches look back 45 days and return up to 20 postings per title. Each one costs a
            small amount of OpenAI credit.
          </p>
        </div>
      ) : (
        <ul className="log-feed" aria-busy={loading || undefined}>
          {titles.map((title) => {
            const state = searchState[title.id];
            const elapsed = elapsedFor(title.id);
            return (
              <li key={title.id}>
                <article className="entry">
                  <h2 className="entry-title">{title.title}</h2>

                  <div className="entry-count">
                    <span className="entry-count-n" data-zero={title.postingCount === 0}>
                      {title.postingCount}
                    </span>
                    <span className="entry-count-l">
                      {title.postingCount === 1 ? 'posting' : 'postings'}
                    </span>
                  </div>

                  {editingId === title.id ? (
                    <>
                      <div className="entry-edit field">
                        <label className="field-label" htmlFor={`edit-${title.id}`}>
                          New name
                        </label>
                        <input
                          id={`edit-${title.id}`}
                          ref={editInputRef}
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                          aria-label={`New name for ${title.title}`}
                        />
                        {editError && (
                          <p className="msg msg-error" role="alert">
                            {editError}
                          </p>
                        )}
                      </div>
                      <div className="entry-actions">
                        <button
                          className="btn btn-secondary"
                          onClick={() => saveEditing(title.id)}
                          aria-label={`Save ${title.title}`}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-quiet"
                          onClick={cancelEditing}
                          aria-label={`Cancel renaming ${title.title}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : confirmingDeleteId === title.id ? (
                    <div
                      className="entry-confirm"
                      role="alertdialog"
                      aria-label={`Delete ${title.title}?`}
                    >
                      <p className="entry-confirm-q">
                        Delete &ldquo;{title.title}&rdquo;? Postings already found for it are kept,
                        just unlinked.
                      </p>
                      <div className="entry-confirm-actions">
                        <button
                          className="btn btn-destructive"
                          ref={confirmButtonRef}
                          onClick={() => confirmDelete(title.id)}
                          aria-label={`Confirm removing ${title.title}`}
                        >
                          Confirm
                        </button>
                        <button
                          className="btn btn-quiet"
                          onClick={() => setConfirmingDeleteId(null)}
                          aria-label={`Keep ${title.title}`}
                        >
                          Cancel
                        </button>
                        {deleteError && (
                          <p className="msg msg-error" role="alert">
                            {deleteError}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="entry-actions">
                      <button
                        className="btn btn-secondary"
                        onClick={() => runSearch(title.id)}
                        disabled={searchingAll || state === 'searching'}
                        aria-label={
                          state === 'searching'
                            ? `Searching for ${title.title}`
                            : `Search now for ${title.title}`
                        }
                      >
                        {state === 'searching' ? 'Searching…' : 'Search now'}
                      </button>
                      {state === 'searching' && elapsed && (
                        <span className="run-status">{elapsed}</span>
                      )}
                      <Link
                        className="entry-link"
                        to={`/titles/${title.id}/postings`}
                        aria-label={`View postings for ${title.title}`}
                      >
                        View postings
                      </Link>
                      <button
                        className="btn btn-quiet"
                        onClick={() => startEditing(title)}
                        aria-label={`Edit ${title.title}`}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-destructive"
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmingDeleteId(title.id);
                        }}
                        aria-label={`Delete ${title.title}`}
                      >
                        Delete
                      </button>

                      {state === 'done' && (
                        <span className="msg msg-success">{searchResultMessage(title.id)}</span>
                      )}
                      {state === 'error' && (
                        <>
                          <span className="msg msg-error" role="alert">
                            {searchErrors[title.id]}
                          </span>
                          <button
                            className="btn btn-secondary"
                            onClick={() => runSearch(title.id)}
                            aria-label={`Retry search for ${title.title}`}
                          >
                            Retry
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
