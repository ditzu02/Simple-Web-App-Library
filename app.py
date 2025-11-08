from flask import Flask, request, jsonify
from flask_cors import CORS
import os, json, base64, secrets
from dotenv import load_dotenv
from pathlib import Path
from functools import wraps

# Load environment variables from backend .env, with fallback to the frontend env for local dev.
_backend_env = Path(__file__).parent / ".env"
_frontend_env = Path(__file__).parent / "crud-client" / ".env"
dotenv_path = _backend_env if _backend_env.exists() else _frontend_env
load_dotenv(dotenv_path=dotenv_path)

# Firebase Admin
import firebase_admin
from firebase_admin import credentials, firestore

app = Flask(__name__)
CORS(app)

# --- Firestore init (from env, no file on disk) ---
sa_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_B64")
if not sa_b64:
    raise RuntimeError("Missing FIREBASE_SERVICE_ACCOUNT_B64")
sa_json = json.loads(base64.b64decode(sa_b64).decode("utf-8"))

cred = credentials.Certificate(sa_json)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred, {"projectId": os.getenv("FIREBASE_PROJECT_ID")})
db = firestore.client()

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "library123")
_admin_tokens = set()
ADMIN_SESSIONS = "admin_sessions"

# Auth helpers
def _extract_token():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None

def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _extract_token()
        if token:
            if token in _admin_tokens:
                return fn(*args, **kwargs)
            try:
                if db.collection(ADMIN_SESSIONS).document(token).get().exists:
                    _admin_tokens.add(token)
                    return fn(*args, **kwargs)
            except Exception:
                # fall through to unauthorized
                pass
        return json_error("Unauthorized", 401)
    return wrapper

# Collections
AUTHORS = "authors"
PUBLISHERS = "publishers"
BOOKS = "books"
BORROW_REQUESTS = "borrows"
RATINGS = "ratings"

TAG_OPTIONS = [
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
]

# Helpers
def doc_to_dict(doc):
    d = doc.to_dict() or {}
    d["id"] = doc.id
    return d

def list_all(col):
    return [doc_to_dict(d) for d in db.collection(col).stream()]

def get_one(col, id):
    ref = db.collection(col).document(id).get()
    return doc_to_dict(ref) if ref.exists else None

from datetime import datetime, timezone

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def json_error(message, status=400):
    return jsonify({"error": message}), status

def require_fields(data, required):
    missing = [f for f in required if not data.get(f)]
    if missing:
        return False, f"Missing required field(s): {', '.join(missing)}"
    return True, None

def to_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

def parse_limit(value, default=10, max_limit=100):
    n = to_int(value, default)
    if n is None:
        return default
    if n < 1:
        return 1
    if max_limit is not None and n > max_limit:
        return max_limit
    return n

def parse_offset(value, default=0):
    n = to_int(value, default)
    if n is None:
        return default
    return max(0, n)

def paginate(items, limit, offset):
    total = len(items)
    size = max(1, limit or 1)
    start = max(0, offset)
    end = min(start + size, total)
    return {
        "items": items[start:end],
        "total": total,
        "limit": size,
        "offset": offset,
        "has_more": end < total,
    }

def exists(col, id):
    return db.collection(col).document(id).get().exists

def create(col, data):
    ref = db.collection(col).document()  # auto-id
    payload = (data or {}).copy()
    # timestamps
    ts = now_iso()
    payload.setdefault("createdAt", ts)
    payload["updatedAt"] = ts
    ref.set(payload)
    return doc_to_dict(ref.get())

def update_one(col, id, data):
    ref = db.collection(col).document(id)
    snap = ref.get()
    if not snap.exists:
        return None
    payload = (data or {}).copy()
    payload["updatedAt"] = now_iso()
    ref.update(payload)
    return doc_to_dict(ref.get())

def delete_one(col, id):
    ref = db.collection(col).document(id)
    if not ref.get().exists:
        return False
    ref.delete()
    return True

def sanitize_tags(value):
    if not value:
        return []
    if isinstance(value, str):
        tags = [value]
    else:
        tags = value
    allowed = set(TAG_OPTIONS)
    cleaned = []
    for tag in tags:
        t = (tag or "").strip()
        if t and t in allowed and t not in cleaned:
            cleaned.append(t)
    return cleaned

def create_borrow_record(book, data):
    payload = {
        "book_id": book["id"],
        "book_title": book.get("title"),
        "name": data.get("name", "").strip(),
        "email": data.get("email", "").strip(),
        "notes": (data.get("notes") or "").strip(),
        "status": "pending",
        "createdAt": now_iso()
    }
    ref = db.collection(BORROW_REQUESTS).document()
    ref.set(payload)
    payload["id"] = ref.id
    return payload

def record_rating(book_id, rating, notes=None, name=None):
    entry = {
        "book_id": book_id,
        "rating": rating,
        "notes": (notes or "").strip(),
        "name": (name or "").strip(),
        "createdAt": now_iso()
    }
    db.collection(RATINGS).add(entry)
    return entry

# --- Auth endpoints ---
@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        token = secrets.token_urlsafe(32)
        _admin_tokens.add(token)
        db.collection(ADMIN_SESSIONS).document(token).set(
            {"createdAt": now_iso()}
        )
        return jsonify({"token": token})
    return json_error("Invalid credentials", 401)

@app.post("/api/logout")
@require_admin
def logout():
    token = _extract_token()
    if token:
        _admin_tokens.discard(token)
        try:
            db.collection(ADMIN_SESSIONS).document(token).delete()
        except Exception:
            pass
    return jsonify({"ok": True})

@app.get("/api/session")
@require_admin
def session_info():
    return jsonify({"ok": True})

# --- Authors ---
@app.get("/api/authors")
def authors_list():
    items = list_all(AUTHORS)
    q = (request.args.get("q") or "").strip().lower()
    if q:
        items = [i for i in items if q in (i.get("name", "") or "").lower()]
    limit = parse_limit(request.args.get("limit"), default=10)
    offset = parse_offset(request.args.get("offset"), 0)
    return jsonify(paginate(items, limit, offset))

@app.get("/api/authors/<id>")
def authors_get(id):
    x = get_one(AUTHORS, id)
    return (jsonify(x), 200) if x else (jsonify({"error":"Not found"}), 404)

@app.post("/api/authors")
@require_admin
def authors_create():
    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["name"])
    if not ok:
        return json_error(msg, 400)
    return jsonify(create(AUTHORS, data)), 201

@app.put("/api/authors/<id>")
@require_admin
def authors_update(id):
    x = update_one(AUTHORS, id, request.json)
    return (jsonify(x), 200) if x else (jsonify({"error":"Not found"}), 404)

@app.delete("/api/authors/<id>")
@require_admin
def authors_delete(id):
    return ("", 204) if delete_one(AUTHORS, id) else (jsonify({"error":"Not found"}), 404)

# --- Publishers ---
@app.get("/api/pubs")
def pubs_list():
    items = list_all(PUBLISHERS)
    q = (request.args.get("q") or "").strip().lower()
    if q:
        items = [i for i in items if q in (i.get("name", "") or "").lower()]
    city_filter = (request.args.get("city") or "").strip().lower()
    if city_filter:
        items = [
            i for i in items
            if city_filter in (i.get("city", "") or "").lower()
        ]
    limit = parse_limit(request.args.get("limit"), default=10)
    offset = parse_offset(request.args.get("offset"), 0)
    return jsonify(paginate(items, limit, offset))

@app.get("/api/pubs/<id>")
def pubs_get(id):
    x = get_one(PUBLISHERS, id)
    return (jsonify(x), 200) if x else (jsonify({"error":"Not found"}), 404)

@app.post("/api/pubs")
@require_admin
def pubs_create():
    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["name"])
    if not ok:
        return json_error(msg, 400)
    return jsonify(create(PUBLISHERS, data)), 201

@app.put("/api/pubs/<id>")
@require_admin
def pubs_update(id):
    x = update_one(PUBLISHERS, id, request.json)
    return (jsonify(x), 200) if x else (jsonify({"error":"Not found"}), 404)

@app.delete("/api/pubs/<id>")
@require_admin
def pubs_delete(id):
    return ("", 204) if delete_one(PUBLISHERS, id) else (jsonify({"error":"Not found"}), 404)

# --- Books ---
@app.get("/api/books")
def books_list():
    items = list_all(BOOKS)
    q = (request.args.get("q") or "").strip().lower()
    if q:
        items = [i for i in items if q in (i.get("title", "") or "").lower()]
    author_filter = (request.args.get("author_id") or "").strip()
    if author_filter:
        items = [i for i in items if (i.get("author_id") or "") == author_filter]
    publisher_filter = (request.args.get("publisher_id") or "").strip()
    if publisher_filter:
        items = [i for i in items if (i.get("publisher_id") or "") == publisher_filter]
    tag_filter_param = (request.args.get("tags") or "").strip()
    if tag_filter_param:
        tag_filters = {t.strip() for t in tag_filter_param.split(",") if t.strip()}
        if tag_filters:
            items = [
                i for i in items
                if tag_filters.issubset(set(i.get("tags") or []))
            ]
    limit = parse_limit(request.args.get("limit"), default=10)
    offset = parse_offset(request.args.get("offset"), 0)
    return jsonify(paginate(items, limit, offset))

@app.get("/api/books/<id>")
def books_get(id):
    x = get_one(BOOKS, id)
    return (jsonify(x), 200) if x else (jsonify({"error":"Not found"}), 404)

@app.post("/api/books")
@require_admin
def books_create():
    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["title", "author_id", "publisher_id"])
    if not ok:
        return json_error(msg, 400)
    # Coerce year if provided
    if "year" in data:
        coerced = to_int(data.get("year"))
        if coerced is None:
            return json_error("year must be an integer", 400)
        data["year"] = coerced
    # Referential integrity checks
    if not exists(AUTHORS, data["author_id"]):
        return json_error("author_id does not exist", 400)
    if not exists(PUBLISHERS, data["publisher_id"]):
        return json_error("publisher_id does not exist", 400)
    data["tags"] = sanitize_tags(data.get("tags"))
    data.setdefault("rating_sum", 0)
    data.setdefault("rating_count", 0)
    data.setdefault("rating_avg", 0)
    return jsonify(create(BOOKS, data)), 201

@app.put("/api/books/<id>")
@require_admin
def books_update(id):
    data = request.get_json(silent=True) or {}
    if "year" in data:
        coerced = to_int(data.get("year"))
        if coerced is None:
            return json_error("year must be an integer", 400)
        data["year"] = coerced
    if "author_id" in data and not exists(AUTHORS, data["author_id"]):
        return json_error("author_id does not exist", 400)
    if "publisher_id" in data and not exists(PUBLISHERS, data["publisher_id"]):
        return json_error("publisher_id does not exist", 400)
    if "tags" in data:
        data["tags"] = sanitize_tags(data.get("tags"))
    x = update_one(BOOKS, id, data)
    return (jsonify(x), 200) if x else (jsonify({"error":"Not found"}), 404)

@app.delete("/api/books/<id>")
@require_admin
def books_delete(id):
    return ("", 204) if delete_one(BOOKS, id) else (jsonify({"error":"Not found"}), 404)

@app.post("/api/books/<id>/borrow")
def books_borrow(id):
    book = get_one(BOOKS, id)
    if not book:
        return json_error("Book not found", 404)
    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["name", "email"])
    if not ok:
        return json_error(msg, 400)
    record = create_borrow_record(book, data)
    return jsonify({"ok": True, "request": record}), 201

@app.get("/api/borrows")
@require_admin
def borrows_list():
    docs = db.collection(BORROW_REQUESTS).order_by("createdAt", direction=firestore.Query.DESCENDING).stream()
    return jsonify([doc_to_dict(doc) for doc in docs])

@app.post("/api/books/<id>/rate")
def books_rate(id):
    book_ref = db.collection(BOOKS).document(id)
    book_snapshot = book_ref.get()
    if not book_snapshot.exists:
        return json_error("Book not found", 404)
    data = request.get_json(silent=True) or {}
    rating = to_int(data.get("rating"))
    if rating is None or rating < 1 or rating > 5:
        return json_error("rating must be an integer between 1 and 5", 400)
    notes = (data.get("notes") or "").strip()
    name = (data.get("name") or "").strip()
    book_data = book_snapshot.to_dict() or {}
    rating_sum = int(book_data.get("rating_sum") or 0) + rating
    rating_count = int(book_data.get("rating_count") or 0) + 1
    rating_avg = rating_sum / rating_count if rating_count else 0
    book_ref.update({
        "rating_sum": rating_sum,
        "rating_count": rating_count,
        "rating_avg": rating_avg,
        "updatedAt": now_iso()
    })
    record_rating(id, rating, notes=notes, name=name)
    return jsonify({
        "ok": True,
        "rating_avg": rating_avg,
        "rating_count": rating_count
    }), 201

# --- Health endpoint ---
@app.get("/api/health")
def health():
    try:
        list(db.collections())
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}, 500

if __name__ == "__main__":
    app.run(debug=True, port=5001)
