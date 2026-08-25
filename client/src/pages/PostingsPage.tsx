import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Posting, PositionTitle } from '../types';
import { fetchPositionTitles } from '../api/positionTitles';
import {
  fetchPostingsForTitle,
  markPostingViewed,
  searchPostingsForTitle,
  updatePostingStatus
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
      if (result.savedCount === 0) {
        setSearchInfo('No matching postings found in the last 45 days.');
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
              <th>Actions</th>
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
                    <button onClick={() => handleOpen(posting)}>Open</button>
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
