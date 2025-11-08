import { useEffect, useMemo, useState } from "react";
import {
  listAuthors,
  createAuthor,
  updateAuthor,
  deleteAuthor
} from "../api";
import { getErrorMessage, useCrudList } from "../hooks/useCrudList";

const emptyForm = { name: "", email: "" };
const LIMIT_OPTIONS = [5, 10, 20, 50];

export default function Authors({ isAdmin = false }) {
  const {
    items,
    meta,
    loading,
    error,
    refresh,
    params,
    replaceParams
  } = useCrudList(listAuthors, {
    initialParams: { limit: 10, offset: 0, q: "" }
  });

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState(params.q ?? "");

  useEffect(() => {
    if (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    }
  }, [error]);

  useEffect(() => {
    setSearch(params.q ?? "");
  }, [params.q]);

  useEffect(() => {
    if (!isAdmin) {
      setStatus(null);
      setEditing(null);
      setForm(emptyForm);
    }
  }, [isAdmin]);

  const hasQuery = Boolean((params.q ?? "").trim());
  const resetDisabled = loading || (!hasQuery && !search.trim());

  const pagination = useMemo(() => {
    const total = meta?.total ?? items.length;
    const offset = meta?.offset ?? params.offset ?? 0;
    const limit = meta?.limit ?? params.limit ?? (items.length || 1);
    const start = total === 0 ? 0 : offset + 1;
    const end = total === 0 ? 0 : Math.min(total, offset + items.length);
    const hasMore = meta?.has_more ?? end < total;
    return { total, offset, limit, start, end, hasMore };
  }, [items.length, meta, params.limit, params.offset]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setStatus(null);

    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();
    if (!trimmedName) {
      setStatus({ type: "error", message: "Name is required." });
      return;
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus({ type: "error", message: "Email looks invalid." });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateAuthor(editing, {
          name: trimmedName,
          email: trimmedEmail
        });
        setStatus({ type: "success", message: "Author updated." });
      } else {
        await createAuthor({ name: trimmedName, email: trimmedEmail });
        setStatus({ type: "success", message: "Author created." });
      }
      resetForm();
      await refresh();
    } catch (err) {
      console.error("Save author failed", err);
      setStatus({ type: "error", message: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this author?")) return;
    setStatus(null);
    setDeleting(id);
    try {
      await deleteAuthor(id);
      setStatus({ type: "success", message: "Author deleted." });
      await refresh();
    } catch (err) {
      console.error("Delete author failed", err);
      setStatus({ type: "error", message: getErrorMessage(err) });
    } finally {
      setDeleting(null);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    replaceParams({
      ...params,
      q: search.trim(),
      offset: 0
    });
  };

  const handleResetSearch = () => {
    setSearch("");
    replaceParams({
      ...params,
      q: "",
      offset: 0
    });
  };

  const handleLimitChange = (e) => {
    const nextLimit = Number(e.target.value) || 10;
    replaceParams({
      ...params,
      limit: nextLimit,
      offset: 0
    });
  };

  const handlePrevPage = () => {
    if (pagination.offset === 0) return;
    replaceParams({
      ...params,
      offset: Math.max(0, pagination.offset - pagination.limit)
    });
  };

  const handleNextPage = () => {
    if (!pagination.hasMore) return;
    replaceParams({
      ...params,
      offset: pagination.offset + pagination.limit
    });
  };

  return (
    <section className="page-panel fade-in" aria-label="Authors">

      <form className="list-controls" onSubmit={handleSearchSubmit}>
        <input
          placeholder="Search authors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          Search
        </button>
        <button
          type="button"
          onClick={handleResetSearch}
          disabled={resetDisabled}
        >
          Reset
        </button>
        <label className="limit-select">
          <span>Page size</span>
          <select
            value={pagination.limit}
            onChange={handleLimitChange}
            disabled={loading}
          >
            {LIMIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </form>

      {isAdmin && (
        <form onSubmit={submit}>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={saving}
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={saving}
          />
          <button disabled={saving}>
            {saving ? "Saving..." : editing ? "Update" : "Create"}
          </button>
          {editing && (
            <button type="button" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
          )}
        </form>
      )}

      {status && (
        <div className={`status ${status.type}`}>{status.message}</div>
      )}
      {loading && <div className="status info">Loading authors…</div>}

      {pagination.total > 0 && (
        <div className="list-meta">
          <span>
            Showing {pagination.start}-{pagination.end} of {pagination.total}
          </span>
          <div className="pager">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={loading || pagination.offset === 0}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={loading || !pagination.hasMore}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !loading ? (
        <div className="empty-state">
          {hasQuery ? "No authors match your filters." : "No authors yet."}
        </div>
      ) : (
        <div className="table-wrap mt-8">
          <table>
            <thead>
              <tr>
                {isAdmin && <th>ID</th>}
                <th>Name</th>
                <th>Email</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  {isAdmin && <td>{a.id}</td>}
                  <td>{a.name}</td>
                  <td>{a.email || "—"}</td>
                  {isAdmin && (
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(a.id);
                          setForm({ name: a.name ?? "", email: a.email ?? "" });
                        }}
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`button-danger${
                          deleting === a.id ? " busy" : ""
                        }`}
                        onClick={() => onDelete(a.id)}
                        disabled={saving || deleting === a.id}
                      >
                        {deleting === a.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
