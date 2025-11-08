import { useEffect, useMemo, useState } from "react";
import {
  listPubs,
  createPub,
  updatePub,
  deletePub
} from "../api";
import { getErrorMessage, useCrudList } from "../hooks/useCrudList";

const emptyForm = { name: "", city: "" };
const LIMIT_OPTIONS = [5, 10, 20, 50];

export default function Publishers({ isAdmin = false }) {
  const {
    items,
    meta,
    loading,
    error,
    refresh,
    params,
    replaceParams
  } = useCrudList(listPubs, {
    initialParams: { limit: 10, offset: 0, q: "", city: "" }
  });

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState(params.q ?? "");
  const [city, setCity] = useState(params.city ?? "");

  useEffect(() => {
    if (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    }
  }, [error]);

  useEffect(() => {
    setSearch(params.q ?? "");
    setCity(params.city ?? "");
  }, [params.city, params.q]);

  useEffect(() => {
    if (!isAdmin) {
      setStatus(null);
      setEditing(null);
      setForm(emptyForm);
    }
  }, [isAdmin]);

  const filtersActive =
    !!((params.q ?? "").trim()) || !!((params.city ?? "").trim());
  const resetDisabled =
    loading || (!filtersActive && !search.trim() && !city.trim());

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
    const trimmedCity = form.city.trim();
    if (!trimmedName) {
      setStatus({ type: "error", message: "Name is required." });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updatePub(editing, { name: trimmedName, city: trimmedCity });
        setStatus({ type: "success", message: "Publisher updated." });
      } else {
        await createPub({ name: trimmedName, city: trimmedCity });
        setStatus({ type: "success", message: "Publisher created." });
      }
      resetForm();
      await refresh();
    } catch (err) {
      console.error("Save publisher failed", err);
      setStatus({ type: "error", message: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this publisher?")) return;
    setStatus(null);
    setDeleting(id);
    try {
      await deletePub(id);
      setStatus({ type: "success", message: "Publisher deleted." });
      await refresh();
    } catch (err) {
      console.error("Delete publisher failed", err);
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
      city: city.trim(),
      offset: 0
    });
  };

  const handleResetFilters = () => {
    setSearch("");
    setCity("");
    replaceParams({
      ...params,
      q: "",
      city: "",
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
    <section className="page-panel fade-in" aria-label="Publishers">

      <form className="list-controls" onSubmit={handleSearchSubmit}>
        <input
          placeholder="Search publishers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading}
        />
        <input
          placeholder="Filter by city…"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          Apply
        </button>
        <button
          type="button"
          onClick={handleResetFilters}
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
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
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
      {loading && <div className="status info">Loading publishers…</div>}

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
          {filtersActive
            ? "No publishers match your filters."
            : "No publishers yet."}
        </div>
      ) : (
        <div className="table-wrap mt-8">
          <table>
            <thead>
              <tr>
                {isAdmin && <th>ID</th>}
                <th>Name</th>
                <th>City</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  {isAdmin && <td>{p.id}</td>}
                  <td>{p.name}</td>
                  <td>{p.city || "—"}</td>
                  {isAdmin && (
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(p.id);
                          setForm({ name: p.name ?? "", city: p.city ?? "" });
                        }}
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`button-danger${
                          deleting === p.id ? " busy" : ""
                        }`}
                        onClick={() => onDelete(p.id)}
                        disabled={saving || deleting === p.id}
                      >
                        {deleting === p.id ? "Deleting…" : "Delete"}
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
