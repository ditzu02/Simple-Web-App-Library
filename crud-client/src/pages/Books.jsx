import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listBooks,
  createBook,
  updateBook,
  deleteBook,
  listAuthors,
  listPubs,
  borrowBook,
  listBorrowRequests,
  rateBook
} from "../api";
import { getErrorMessage, useCrudList } from "../hooks/useCrudList";

const BOOK_TAG_OPTIONS = [
  "Science Fiction",
  "Fantasy",
  "Mystery",
  "Historical",
  "Romance",
  "Non-fiction",
  "Biography",
  "Young Adult",
  "Horror",
  "Adventure",
  "Classic",
  "Thriller",
  "Humor",
  "Political",
  "Novella"
];

const emptyForm = () => ({
  title: "",
  year: "",
  author_id: "",
  publisher_id: "",
  tags: []
});
const LIMIT_OPTIONS = [5, 10, 20, 50];

export default function Books({ isAdmin = false }) {
  const booksData = useCrudList(listBooks, {
    initialParams: {
      limit: 10,
      offset: 0,
      q: "",
      author_id: "",
      publisher_id: "",
      tags: ""
    }
  });
  const authorsData = useCrudList(listAuthors, {
    initialParams: { limit: 100, offset: 0, q: "" }
  });
  const publishersData = useCrudList(listPubs, {
    initialParams: { limit: 100, offset: 0, q: "" }
  });

  const {
    items: books,
    meta: booksMeta,
    loading: booksLoading,
    error: booksError,
    refresh: refreshBooks,
    params: bookParams,
    replaceParams: replaceBookParams
  } = booksData;
  const {
    items: authors,
    loading: authorsLoading,
    error: authorsError,
    refresh: refreshAuthors
  } = authorsData;
  const {
    items: publishers,
    loading: publishersLoading,
    error: publishersError,
    refresh: refreshPublishers
  } = publishersData;

  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [status, setStatus] = useState(null);

  const [search, setSearch] = useState(bookParams.q ?? "");
  const [filterAuthor, setFilterAuthor] = useState(bookParams.author_id ?? "");
  const [filterPublisher, setFilterPublisher] = useState(
    bookParams.publisher_id ?? ""
  );
  const [filterTags, setFilterTags] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [borrowFormState, setBorrowFormState] = useState({
    open: false,
    book: null,
    name: "",
    email: "",
    notes: ""
  });
  const [borrowBusy, setBorrowBusy] = useState(false);
  const [borrowMessage, setBorrowMessage] = useState(null);
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [borrowError, setBorrowError] = useState(null);
  const [ratingFormState, setRatingFormState] = useState({
    open: false,
    book: null,
    rating: 5,
    notes: ""
  });
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingMessage, setRatingMessage] = useState(null);

  const refreshBorrowRequests = useCallback(async () => {
    if (!isAdmin) return;
    setBorrowLoading(true);
    try {
      const data = await listBorrowRequests();
      setBorrowRequests(data);
      setBorrowError(null);
    } catch (err) {
      setBorrowError(getErrorMessage(err));
    } finally {
      setBorrowLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    refreshBorrowRequests();
  }, [refreshBorrowRequests]);

  useEffect(() => {
    const err = booksError || authorsError || publishersError;
    if (err) setStatus({ type: "error", message: getErrorMessage(err) });
  }, [authorsError, booksError, publishersError]);

  useEffect(() => {
    setSearch(bookParams.q ?? "");
    setFilterAuthor(bookParams.author_id ?? "");
    setFilterPublisher(bookParams.publisher_id ?? "");
  }, [bookParams.author_id, bookParams.publisher_id, bookParams.q]);

  useEffect(() => {
    const tagParam = bookParams.tags;
    if (typeof tagParam === "string" && tagParam.trim()) {
      setFilterTags(
        tagParam.split(",").map((t) => t.trim()).filter(Boolean)
      );
    } else {
      setFilterTags([]);
    }
  }, [bookParams.tags]);

  useEffect(() => {
    if (!isAdmin) {
      setStatus(null);
      setEditing(null);
      setForm(emptyForm());
      setBorrowFormState({
        open: false,
        book: null,
        name: "",
        email: "",
        notes: ""
      });
      setBorrowMessage(null);
      setBorrowRequests([]);
      setBorrowError(null);
      setBorrowBusy(false);
      setRatingFormState({
        open: false,
        book: null,
        rating: 5,
        notes: ""
      });
      setRatingMessage(null);
      setRatingBusy(false);
    }
  }, [isAdmin]);

  const authorMap = useMemo(() => {
    const map = new Map();
    authors.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [authors]);

  const publisherMap = useMemo(() => {
    const map = new Map();
    publishers.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [publishers]);

  const toggleFormTag = (tag) => {
    setForm((prev) => {
      const current = prev.tags || [];
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      return { ...prev, tags: next };
    });
  };

  const toggleFilterTag = (tag) => {
    setFilterTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  const renderStars = (avg) => {
    const clamped = Math.min(5, Math.max(0, Number(avg) || 0));
    const full = Math.round(clamped);
    return "★".repeat(full) + "☆".repeat(5 - full);
  };

  const closeBorrowForm = () => {
    setBorrowFormState({
      open: false,
      book: null,
      name: "",
      email: "",
      notes: ""
    });
  };

  const closeRatingForm = () => {
    setRatingFormState({
      open: false,
      book: null,
      rating: 5,
      notes: ""
    });
  };

  const pagination = useMemo(() => {
    const total = booksMeta?.total ?? books.length;
    const offset = booksMeta?.offset ?? bookParams.offset ?? 0;
    const limit = booksMeta?.limit ?? bookParams.limit ?? (books.length || 1);
    const start = total === 0 ? 0 : offset + 1;
    const end = total === 0 ? 0 : Math.min(total, offset + books.length);
    const hasMore = booksMeta?.has_more ?? end < total;
    return { total, offset, limit, start, end, hasMore };
  }, [bookParams.limit, bookParams.offset, books.length, booksMeta]);

  const openBorrowForm = (book) => {
    setBorrowMessage(null);
    closeRatingForm();
    setBorrowFormState({
      open: true,
      book,
      name: "",
      email: "",
      notes: ""
    });
  };

  const openRatingForm = (book) => {
    setRatingMessage(null);
    closeBorrowForm();
    setRatingFormState({
      open: true,
      book,
      rating: 5,
      notes: ""
    });
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEditing(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setStatus(null);

    const payload = {
      title: form.title.trim(),
      year: form.year,
      author_id: form.author_id,
      publisher_id: form.publisher_id
    };

    if (!payload.title) {
      setStatus({ type: "error", message: "Title is required." });
      return;
    }
    if (!payload.author_id) {
      setStatus({ type: "error", message: "Please choose an author." });
      return;
    }
    if (!payload.publisher_id) {
      setStatus({ type: "error", message: "Please choose a publisher." });
      return;
    }
    payload.tags = Array.isArray(form.tags) ? form.tags : [];
    if (payload.year) {
      const yearNumber = Number(payload.year);
      if (!Number.isInteger(yearNumber) || yearNumber < 0) {
        setStatus({
          type: "error",
          message: "Year must be a positive integer."
        });
        return;
      }
      payload.year = yearNumber;
    } else {
      delete payload.year;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateBook(editing, payload);
        setStatus({ type: "success", message: "Book updated." });
      } else {
        await createBook(payload);
        setStatus({ type: "success", message: "Book created." });
      }
      resetForm();
      await refreshBooks();
    } catch (err) {
      console.error("Save book failed", err);
      setStatus({ type: "error", message: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this book?")) return;
    setStatus(null);
    setDeleting(id);
    try {
      await deleteBook(id);
      setStatus({ type: "success", message: "Book deleted." });
      await refreshBooks();
    } catch (err) {
      console.error("Delete book failed", err);
      setStatus({ type: "error", message: getErrorMessage(err) });
    } finally {
      setDeleting(null);
    }
  };

  const submitBorrowRequest = async (e) => {
    e.preventDefault();
    if (!borrowFormState.book) return;
    const trimmedName = borrowFormState.name.trim();
    const trimmedEmail = borrowFormState.email.trim();
    if (!trimmedName || !trimmedEmail) {
      setBorrowMessage({
        type: "error",
        message: "Please provide your name and email."
      });
      return;
    }
    setBorrowBusy(true);
    setBorrowMessage(null);
    try {
      await borrowBook(borrowFormState.book.id, {
        name: trimmedName,
        email: trimmedEmail,
        notes: borrowFormState.notes
      });
      setBorrowMessage({
        type: "success",
        message: `Borrow request submitted for "${borrowFormState.book.title}".`
      });
      closeBorrowForm();
      await refreshBorrowRequests();
    } catch (err) {
      setBorrowMessage({
        type: "error",
        message: getErrorMessage(err, "Unable to submit request")
      });
    } finally {
      setBorrowBusy(false);
    }
  };

  const submitRating = async (e) => {
    e.preventDefault();
    if (!ratingFormState.book) return;
    const ratingValue = Number(ratingFormState.rating);
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      setRatingMessage({
        type: "error",
        message: "Please choose a rating between 1 and 5."
      });
      return;
    }
    setRatingBusy(true);
    setRatingMessage(null);
    try {
      await rateBook(ratingFormState.book.id, {
        rating: ratingValue,
        notes: ratingFormState.notes
      });
      setRatingMessage({
        type: "success",
        message: `Thanks! You rated "${ratingFormState.book.title}".`
      });
      closeRatingForm();
      await refreshBooks();
    } catch (err) {
      setRatingMessage({
        type: "error",
        message: getErrorMessage(err, "Unable to submit rating")
      });
    } finally {
      setRatingBusy(false);
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    replaceBookParams({
      ...bookParams,
      q: search.trim(),
      author_id: filterAuthor,
      publisher_id: filterPublisher,
      tags: filterTags.join(","),
      offset: 0
    });
  };

  const handleResetFilters = () => {
    setSearch("");
    setFilterAuthor("");
    setFilterPublisher("");
    setFilterTags([]);
    replaceBookParams({
      ...bookParams,
      q: "",
      author_id: "",
      publisher_id: "",
      tags: "",
      offset: 0
    });
  };

  const handleLimitChange = (e) => {
    const nextLimit = Number(e.target.value) || 10;
    replaceBookParams({
      ...bookParams,
      limit: nextLimit,
      offset: 0
    });
  };

  const handlePrevPage = () => {
    if (pagination.offset === 0) return;
    replaceBookParams({
      ...bookParams,
      offset: Math.max(0, pagination.offset - pagination.limit)
    });
  };

  const handleNextPage = () => {
    if (!pagination.hasMore) return;
    replaceBookParams({
      ...bookParams,
      offset: pagination.offset + pagination.limit
    });
  };

  const reloadReferences = async () => {
    await Promise.all([refreshAuthors(), refreshPublishers()]);
  };

  const loadingAny = booksLoading || authorsLoading || publishersLoading;
  const filtersActive = Boolean(
    (bookParams.q && bookParams.q.trim()) ||
      bookParams.author_id ||
      bookParams.publisher_id ||
      (bookParams.tags && bookParams.tags.trim())
  );
  const localFiltersDirty = Boolean(
    (search && search.trim()) ||
      filterAuthor ||
      filterPublisher ||
      filterTags.length
  );
  const resetDisabled = booksLoading || (!filtersActive && !localFiltersDirty);

  useEffect(() => {
    if (filtersActive) {
      setFiltersOpen(true);
    }
  }, [filtersActive]);

  return (
    <section className="page-panel fade-in" aria-label="Books">

      <div className="filters-panel">
        <button
          type="button"
          className="filters-toggle"
          onClick={() => setFiltersOpen((prev) => !prev)}
          aria-expanded={filtersOpen}
          aria-controls="books-filter-form"
        >
          {filtersOpen ? "Hide filters" : "Show filters"}
          {filtersActive && !filtersOpen ? " • active" : ""}
        </button>
        {filtersOpen && (
        <form
          id="books-filter-form"
          className="list-controls open"
          onSubmit={handleFilterSubmit}
        >
        <input
          placeholder="Search books…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={booksLoading}
        />
        <select
          value={filterAuthor}
          onChange={(e) => setFilterAuthor(e.target.value)}
          disabled={authorsLoading}
        >
          <option value="">All authors</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={filterPublisher}
          onChange={(e) => setFilterPublisher(e.target.value)}
          disabled={publishersLoading}
        >
          <option value="">All publishers</option>
          {publishers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="tag-filter">
          {BOOK_TAG_OPTIONS.map((tag) => (
            <label
              key={`filter-${tag}`}
              className={`tag-checkbox ${
                filterTags.includes(tag) ? "active" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={filterTags.includes(tag)}
                onChange={() => toggleFilterTag(tag)}
                disabled={booksLoading}
              />
              {tag}
            </label>
          ))}
        </div>
        <button type="submit" disabled={booksLoading}>
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
            disabled={booksLoading}
          >
            {LIMIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        </form>
        )}
      </div>

      {isAdmin && (
        <form onSubmit={submit}>
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            disabled={saving}
          />
          <input
            placeholder="Year"
            value={form.year}
            type="number"
            min="0"
            onChange={(e) => setForm({ ...form, year: e.target.value })}
            disabled={saving}
          />
          <select
            value={form.author_id}
            onChange={(e) => setForm({ ...form, author_id: e.target.value })}
            disabled={saving || authorsLoading}
          >
            <option value="">Select Author</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        <select
          value={form.publisher_id}
          onChange={(e) =>
            setForm({ ...form, publisher_id: e.target.value })
          }
          disabled={saving || publishersLoading}
        >
          <option value="">Select Publisher</option>
          {publishers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="tag-selector">
          <span className="tag-selector-label">Tags</span>
          <div className="tag-options">
            {BOOK_TAG_OPTIONS.map((tag) => (
              <label
                key={`form-${tag}`}
                className={`tag-checkbox ${
                  (form.tags || []).includes(tag) ? "active" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={(form.tags || []).includes(tag)}
                  onChange={() => toggleFormTag(tag)}
                  disabled={saving}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>

        <button disabled={saving}>
          {saving ? "Saving..." : editing ? "Update" : "Create"}
        </button>
          {editing && (
            <button type="button" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={reloadReferences}
            disabled={loadingAny}
          >
            {loadingAny ? "Refreshing…" : "Reload references"}
          </button>
        </form>
      )}

      {status && (
        <div className={`status ${status.type}`}>{status.message}</div>
      )}
      {loadingAny && <div className="status info">Loading data…</div>}

      {pagination.total > 0 && (
        <div className="list-meta">
          <span>
            Showing {pagination.start}-{pagination.end} of {pagination.total}
          </span>
          <div className="pager">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={booksLoading || pagination.offset === 0}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={booksLoading || !pagination.hasMore}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {books.length === 0 && !booksLoading ? (
        <div className="empty-state">
          {filtersActive ? "No books match your filters." : "No books yet."}
        </div>
      ) : (
        <div className="table-wrap mt-8">
          <table>
            <thead>
              <tr>
                {isAdmin && <th>ID</th>}
                <th>Title</th>
                <th>Tags</th>
                <th>Year</th>
                <th>Author</th>
                <th>Publisher</th>
                <th>Rating</th>
                <th>{isAdmin ? "Admin" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => {
                const ratingAvg = Number(b.rating_avg ?? 0);
                const ratingCount = Number(b.rating_count ?? 0);
                return (
                  <tr key={b.id}>
                    {isAdmin && <td>{b.id}</td>}
                    <td>{b.title}</td>
                    <td>
                      <div className="tag-list">
                        {(b.tags || []).map((tag) => (
                          <span key={`${b.id}-${tag}`} className="tag-pill">
                            {tag}
                          </span>
                        ))}
                        {(!b.tags || b.tags.length === 0) && (
                          <span className="tag-pill tag-pill-empty">—</span>
                        )}
                      </div>
                    </td>
                    <td>{b.year || "—"}</td>
                    <td>{authorMap.get(b.author_id) || "—"}</td>
                    <td>{publisherMap.get(b.publisher_id) || "—"}</td>
                    <td>
                      <div className="rating-display">
                        <span className="stars">{renderStars(ratingAvg)}</span>
                        <span className="rating-value">
                          {ratingAvg.toFixed(1)} ({ratingCount})
                        </span>
                      </div>
                    </td>
                    <td className="action-cell">
                      {isAdmin ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(b.id);
                              setForm({
                                title: b.title ?? "",
                                year: b.year ?? "",
                                author_id: b.author_id ?? "",
                                publisher_id: b.publisher_id ?? "",
                                tags: Array.isArray(b.tags) ? [...b.tags] : []
                              });
                            }}
                            disabled={saving}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`button-danger${
                              deleting === b.id ? " busy" : ""
                            }`}
                            onClick={() => onDelete(b.id)}
                            disabled={saving || deleting === b.id}
                          >
                            {deleting === b.id ? "Deleting…" : "Delete"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openBorrowForm(b)}
                            disabled={borrowBusy || ratingBusy}
                          >
                            Borrow
                          </button>
                          <button
                            type="button"
                            onClick={() => openRatingForm(b)}
                            disabled={ratingBusy || borrowBusy}
                          >
                            Rate
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isAdmin && (
        <div className="reader-actions mt-8">
          <div className="borrow-section">
            {borrowMessage && (
              <div className={`status ${borrowMessage.type}`}>
                {borrowMessage.message}
              </div>
            )}
            {borrowFormState.open ? (
              <form className="borrow-form" onSubmit={submitBorrowRequest}>
                <div className="borrow-form-title">
                  Borrow “{borrowFormState.book?.title}”
                </div>
                <div className="form-row">
                  <input
                    placeholder="Your name"
                    value={borrowFormState.name}
                    onChange={(e) =>
                      setBorrowFormState((prev) => ({
                        ...prev,
                        name: e.target.value
                      }))
                    }
                    disabled={borrowBusy}
                  />
                  <input
                    placeholder="Your email"
                    type="email"
                    value={borrowFormState.email}
                    onChange={(e) =>
                      setBorrowFormState((prev) => ({
                        ...prev,
                        email: e.target.value
                      }))
                    }
                    disabled={borrowBusy}
                  />
                </div>
                <textarea
                  placeholder="Notes (optional)"
                  value={borrowFormState.notes}
                  onChange={(e) =>
                    setBorrowFormState((prev) => ({
                      ...prev,
                      notes: e.target.value
                    }))
                  }
                  disabled={borrowBusy}
                />
                <div className="borrow-actions">
                  <button type="submit" disabled={borrowBusy}>
                    {borrowBusy ? "Sending…" : "Submit request"}
                  </button>
                  <button
                    type="button"
                    onClick={closeBorrowForm}
                    disabled={borrowBusy}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p className="borrow-hint">
                Select “Borrow” beside a book to ask for a loan.
              </p>
            )}
          </div>

          <div className="rating-section">
            {ratingMessage && (
              <div className={`status ${ratingMessage.type}`}>
                {ratingMessage.message}
              </div>
            )}
            {ratingFormState.open ? (
              <form className="rating-form" onSubmit={submitRating}>
                <div className="rating-form-title">
                  Rate “{ratingFormState.book?.title}”
                </div>
                <div className="form-row">
                  <select
                    value={ratingFormState.rating}
                    onChange={(e) =>
                      setRatingFormState((prev) => ({
                        ...prev,
                        rating: Number(e.target.value)
                      }))
                    }
                    disabled={ratingBusy}
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} {value === 1 ? "star" : "stars"}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  placeholder="Share your thoughts (optional)"
                  value={ratingFormState.notes}
                  onChange={(e) =>
                    setRatingFormState((prev) => ({
                      ...prev,
                      notes: e.target.value
                    }))
                  }
                  disabled={ratingBusy}
                />
                <div className="borrow-actions">
                  <button type="submit" disabled={ratingBusy}>
                    {ratingBusy ? "Sending…" : "Submit rating"}
                  </button>
                  <button
                    type="button"
                    onClick={closeRatingForm}
                    disabled={ratingBusy}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p className="rating-hint">
                Choose “Rate” beside a book to leave a score.
              </p>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="borrow-requests mt-8">
          <div className="borrow-requests-header">
            <span>Borrow requests</span>
            <button
              type="button"
              onClick={refreshBorrowRequests}
              disabled={borrowLoading}
            >
              {borrowLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {borrowError && <div className="status error">{borrowError}</div>}
          {borrowLoading ? (
            <div className="status info">Loading requests…</div>
          ) : borrowRequests.length === 0 ? (
            <div className="empty-state">No borrow requests yet.</div>
          ) : (
            <div className="table-wrap mt-8">
              <table>
                <thead>
                  <tr>
                    <th>Requested</th>
                    <th>Book</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Notes</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowRequests.map((req) => (
                    <tr key={req.id}>
                      <td>
                        {req.createdAt
                          ? new Date(req.createdAt).toLocaleString()
                          : "—"}
                      </td>
                      <td>{req.book_title || "—"}</td>
                      <td>{req.name || "—"}</td>
                      <td>
                        {req.email ? (
                          <a href={`mailto:${req.email}`}>{req.email}</a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{req.notes || "—"}</td>
                      <td>
                        <span className={`status-tag status-${req.status || "pending"}`}>
                          {req.status || "pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
