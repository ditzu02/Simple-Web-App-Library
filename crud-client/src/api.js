import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:5001/api"
});

// Authors
export const listAuthors = (params = {}) =>
  api.get("/authors", { params }).then((r) => r.data);
export const getAuthor = (id) =>
  api.get(`/authors/${id}`).then((r) => r.data);
export const createAuthor = (data) =>
  api.post("/authors", data).then((r) => r.data);
export const updateAuthor = (id, data) =>
  api.put(`/authors/${id}`, data).then((r) => r.data);
export const deleteAuthor = (id) => api.delete(`/authors/${id}`);

// Publishers
export const listPubs = (params = {}) =>
  api.get("/pubs", { params }).then((r) => r.data);
export const createPub = (data) =>
  api.post("/pubs", data).then((r) => r.data);
export const updatePub = (id, data) =>
  api.put(`/pubs/${id}`, data).then((r) => r.data);
export const deletePub = (id) => api.delete(`/pubs/${id}`);

// Books
export const listBooks = (params = {}) =>
  api.get("/books", { params }).then((r) => r.data);
export const createBook = (data) =>
  api.post("/books", data).then((r) => r.data);
export const updateBook = (id, data) =>
  api.put(`/books/${id}`, data).then((r) => r.data);
export const deleteBook = (id) => api.delete(`/books/${id}`);
export const borrowBook = (id, data) =>
  api.post(`/books/${id}/borrow`, data).then((r) => r.data);
export const rateBook = (id, data) =>
  api.post(`/books/${id}/rate`, data).then((r) => r.data);

// Borrow requests (admin)
export const listBorrowRequests = () =>
  api.get("/borrows").then((r) => r.data);

// Auth helpers
export const setAdminToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const loginAdmin = async (credentials) => {
  const res = await api.post("/login", credentials);
  return res.data.token;
};

export const logoutAdmin = async () => {
  await api.post("/logout");
};

export const verifySession = async () => {
  await api.get("/session");
};
