import { useEffect, useState, type FormEvent } from 'react';
import type { PositionTitle } from '../types';
import {
  createPositionTitle,
  deletePositionTitle,
  fetchPositionTitles,
  updatePositionTitle
} from '../api/positionTitles';
import { ApiError } from '../api/http';

export default function PositionTitlesPage() {
  const [titles, setTitles] = useState<PositionTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function loadTitles() {
    setLoading(true);
    setListError(null);
    try {
      setTitles(await fetchPositionTitles());
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : 'Failed to load position titles');
    } finally {
      setLoading(false);
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

  if (loading) {
    return <p>Loading position titles…</p>;
  }

  return (
    <section>
      <h1>Position Titles</h1>

      <form onSubmit={handleAdd} aria-label="Add position title">
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="e.g. Product Manager"
          aria-label="New position title"
        />
        <button type="submit">Add</button>
        {addError && <p role="alert">{addError}</p>}
      </form>

      {listError && <p role="alert">{listError}</p>}

      {titles.length === 0 ? (
        <p>No position titles yet. Add one above to start searching.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Postings found</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {titles.map((title) => (
              <tr key={title.id}>
                <td>
                  {editingId === title.id ? (
                    <>
                      <input
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                        aria-label={`Edit ${title.title}`}
                      />
                      {editError && <p role="alert">{editError}</p>}
                    </>
                  ) : (
                    title.title
                  )}
                </td>
                <td>{title.postingCount}</td>
                <td>
                  {editingId === title.id ? (
                    <>
                      <button onClick={() => saveEditing(title.id)}>Save</button>
                      <button onClick={cancelEditing}>Cancel</button>
                    </>
                  ) : confirmingDeleteId === title.id ? (
                    <>
                      <span>
                        Delete "{title.title}"? Postings already found for it are kept, just
                        unlinked.
                      </span>
                      <button onClick={() => confirmDelete(title.id)}>Confirm</button>
                      <button onClick={() => setConfirmingDeleteId(null)}>Cancel</button>
                      {deleteError && <p role="alert">{deleteError}</p>}
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditing(title)}>Edit</button>
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmingDeleteId(title.id);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
