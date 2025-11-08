# Simple Library CRUD App

Full-stack CRUD sample for a small library. The Flask backend exposes REST endpoints backed by Google Firestore, while the Vite/React frontend consumes those APIs to let admins manage authors, publishers, and books. Public users can browse the catalog, submit borrow requests, and leave ratings.

## Project structure

```
.
├── app.py                      # Flask API + Firestore integration
├── seed_data.py / clear_data.py# Helper scripts to populate or wipe Firestore
├── crud-client/                # Vite + React SPA
│   ├── src/                    # UI, hooks, API client
│   ├── package.json            # Frontend dependencies/scripts
│   └── README.md               # Client-specific notes
└── ...
```

## Prerequisites

- Python 3.12+
- Node.js 20+ and npm
- A Firebase/Google Cloud project with Firestore enabled and a service account JSON key

## Environment variables

Create a backend `.env` (sits next to `app.py`) with:

```
FIREBASE_SERVICE_ACCOUNT_B64=<base64-encoded service-account JSON>
FIREBASE_PROJECT_ID=<firebase-project-id>
ADMIN_USERNAME=<optional admin login, default "admin">
ADMIN_PASSWORD=<optional admin password, default "library123">
```

Encode your service account file with `base64 < service-account.json | pbcopy` (macOS) or `base64 -w0 service-account.json` (Linux).

For the frontend, add `crud-client/.env`:

```
VITE_API_BASE=http://localhost:5001/api
```

> ⚠️ Keep real `.env` files and service-account JSON out of Git. Commit redacted templates (e.g., `.env.example`) if you need to document keys.

## Backend setup

```bash
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install flask flask-cors firebase-admin python-dotenv
python app.py
```

`app.py` starts on `http://localhost:5001` and automatically enables CORS for the Vite dev server.

### Firestore helpers

- `python seed_data.py` loads sample authors, publishers, and books.
- `python clear_data.py` removes seeded collections.

Both scripts expect the same environment variables as `app.py`.

## Frontend setup

```bash
cd crud-client
npm install
npm run dev
```

Visit the Vite dev server (typically `http://localhost:5173`). The SPA talks to the backend via the `VITE_API_BASE` value.

## Key features

- Admin authentication via `/api/login` and bearer sessions.
- CRUD endpoints for authors, publishers, and books with pagination, search, and tag filtering.
- Borrow request queue and book rating workflow.
- React UI with reusable CRUD hooks, optimistic status badges, and responsive panels.

## Deployment notes

- Set the same environment variables in your hosting platform (no secret files on disk).
- The backend uses `FIREBASE_SERVICE_ACCOUNT_B64`, so you can safely inject credentials as plain text env vars.
- Build the frontend with `npm run build` and serve the static assets from your preferred host. Update `VITE_API_BASE` to your deployed API URL.

## Git hygiene

Add the following to `.gitignore` (if not already present) to keep secrets and build artifacts out of the repo:

```
.env
crud-client/.env
simple-library-web-app-firebase-adminsdk-*.json
venv/
__pycache__/
node_modules/
dist/
```

Feel free to expand on this README with deployment scripts, API docs, or screenshots as the project evolves.
