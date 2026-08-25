import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Posting, PositionTitle } from '../types';
import { fetchPositionTitles } from '../api/positionTitles';
import {
  fetchPostingsForTitle,
  markPostingViewed,
  searchPostingsForTitle,
  updatePostingStatus,
  adaptResumeForPosting
} from '../api/postings';
import { ApiError } from '../api/http';

const EDITABLE_STATUSES = ['New', 'In Progress', 'Rejected'] as const;
const DESCRIPTION_PREVIEW_LENGTH = 120;

export default function PostingsPage() {
  const { id } = useParams<{ id: string }>();
  const positionTitleId = Number(id);

  const [title, setTitle] = useState<PositionTitle | null>(null);
  const [postings, setPostings] = useState<Posting[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [adaptingId, setAdaptingId] = useState<number | null>(null);
  const [adaptConfirmId, setAdaptConfirmId] = useState<number | null>(null);
  const [adaptErrors, setAdaptErrors] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    setListError(null);
    try {
      const [titles, foundPostings] = await Promise.all([
        fetchPositionTitles(),
        fetchPostingsForTitle(positionTitleId, statusFilter || undefined)
      ]);
      setTitle(titles.find((t) => t.id === positionTitleId) ?? null);
      setPostings(foundPostings);
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : 'Failed to load postings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [positionTitleId, statusFilter]);

  async function handleSearch() {
    setSearching(true);
    setSearchError(null);
    setSearchInfo(null);
    try {
      const result = await searchPostingsForTitle(positionTitleId);
      if (result.totalFound === 0) {
        setSearchInfo('No matching postings found in the last 45 days.');
      } else if (result.savedCount === 0) {
        setSearchInfo(
          `No new postings — all ${result.totalFound} result${result.totalFound === 1 ? '' : 's'} were already in your list.`
        );
      }
      await load();
    } catch (error) {
      setSearchError(error instanceof ApiError ? error.message : 'Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleOpen(posting: Posting) {
    window.open(posting.url, '_blank', 'noopener,noreferrer');
    if (!posting.viewed) {
      try {
        const updated = await markPostingViewed(posting.id);
        setPostings((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } catch {
        // The tab already opened; the viewed flag will pick up on next load.
      }
    }
  }

  async function handleStatusChange(posting: Posting, status: string) {
    setStatusError(null);
    try {
      const updated = await updatePostingStatus(posting.id, status);
      setPostings((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      setStatusError(error instanceof ApiError ? error.message : 'Failed to update status');
    }
  }

  async function performAdapt(posting: Posting) {
    setAdaptingId(posting.id);
    setAdaptConfirmId((prev) => (prev === posting.id ? null : prev));
    setAdaptErrors((prev) => ({ ...prev, [posting.id]: '' }));
    try {
      const updated = await adaptResumeForPosting(posting.id);
      setPostings((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      setAdaptErrors((prev) => ({
        ...prev,
        [posting.id]: error instanceof ApiError ? error.message : 'Failed to adapt resume'
      }));
    } finally {
      setAdaptingId(null);
    }
  }

  function handleAdaptClick(posting: Posting) {
    if (posting.adaptedResumePath) {
      setAdaptConfirmId(posting.id);
      return;
    }
    performAdapt(posting);
  }

  if (loading) {
    return <p>Loading postings…</p>;
  }

  return (
    <section>
      <p>
        <Link to="/titles">&larr; Back to Position Titles</Link>
      </p>
      <h1>Postings for {title?.title ?? `Position Title ${positionTitleId}`}</h1>

      <button onClick={handleSearch} disabled={searching}>
        {searching ? 'Searching…' : 'Search now'}
      </button>
      {searchError && <p role="alert">{searchError}</p>}
      {searchInfo && <p>{searchInfo}</p>}

      <label>
        Filter by status:{' '}
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All</option>
          <option value="New">New</option>
          <option value="Applied">Applied</option>
          <option value="In Progress">In Progress</option>
          <option value="Rejected">Rejected</option>
        </select>
      </label>

      {listError && <p role="alert">{listError}</p>}
      {statusError && <p role="alert">{statusError}</p>}

      {postings.length === 0 ? (
        <p>No postings found yet. Run a search to get started.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Description</th>
              <th>Published</th>
              <th>Viewed</th>
              <th>Status</th>
              <th>Company</th>
              <th>Location</th>
              <th>Source</th>
              <th>Actions</th>
              <th>Resume</th>
            </tr>
          </thead>
          <tbody>
            {postings.map((posting) => {
              const description = posting.description ?? '';
              const isExpanded = expandedId === posting.id;
              const isLong = description.length > DESCRIPTION_PREVIEW_LENGTH;
              return (
                <tr key={posting.id}>
                  <td>{posting.postingTitle}</td>
                  <td>
                    {isLong && !isExpanded ? `${description.slice(0, DESCRIPTION_PREVIEW_LENGTH)}…` : description}
                    {isLong && (
                      <button onClick={() => setExpandedId(isExpanded ? null : posting.id)}>
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </td>
                  <td>{posting.publishedDate ?? '—'}</td>
                  <td>{posting.viewed ? 'Yes' : 'No'}</td>
                  <td>
                    {posting.status === 'Applied' ? (
                      posting.status
                    ) : (
                      <select
                        value={posting.status}
                        onChange={(event) => handleStatusChange(posting, event.target.value)}
                        aria-label={`Status for ${posting.postingTitle}`}
                      >
                        {EDITABLE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>{posting.company ?? '—'}</td>
                  <td>{posting.location ?? '—'}</td>
                  <td>
                    {posting.aggregatorName ? (
                      posting.aggregatorUrl ? (
                        <a href={posting.aggregatorUrl} target="_blank" rel="noopener noreferrer">
                          {posting.aggregatorName}
                        </a>
                      ) : (
                        posting.aggregatorName
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <button onClick={() => handleOpen(posting)}>Open</button>
                  </td>
                  <td>
                    {posting.adaptedResumePath && (
                      <div>
                        <a
                          href={`/api/postings/${posting.id}/adapted-resume`}
                          download
                          aria-label={`Download adapted resume for ${posting.postingTitle}`}
                        >
                          Download adapted resume
                        </a>
                      </div>
                    )}
                    {adaptConfirmId === posting.id ? (
                      <span>
                        Replace existing adapted resume?{' '}
                        <button
                          onClick={() => performAdapt(posting)}
                          aria-label={`Yes, replace resume for ${posting.postingTitle}`}
                        >
                          Yes, replace
                        </button>{' '}
                        <button
                          onClick={() => setAdaptConfirmId(null)}
                          aria-label={`Cancel replacing resume for ${posting.postingTitle}`}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdaptClick(posting)}
                        disabled={adaptingId === posting.id}
                        aria-label={`Adapt resume for ${posting.postingTitle}`}
                      >
                        {adaptingId === posting.id
                          ? 'Adapting…'
                          : posting.adaptedResumePath
                            ? 'Re-adapt resume'
                            : 'Adapt my resume'}
                      </button>
                    )}
                    {adaptErrors[posting.id] && <p role="alert">{adaptErrors[posting.id]}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
