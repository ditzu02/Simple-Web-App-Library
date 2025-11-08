import base64
import json
import os
from pathlib import Path

from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

BASE_DIR = Path(__file__).parent

# Load whichever env file is available (backend first, then frontend)
for env_candidate in (BASE_DIR / ".env", BASE_DIR / "crud-client" / ".env"):
    if env_candidate.exists():
        load_dotenv(env_candidate)
        break


def ensure_app():
    sa_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_B64")
    if not sa_b64:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_B64 not set")

    sa_json = json.loads(base64.b64decode(sa_b64))
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(
            credentials.Certificate(sa_json),
            {"projectId": os.getenv("FIREBASE_PROJECT_ID")},
        )


def purge_collection(db, collection_name, batch_size=500):
    total_deleted = 0
    while True:
        docs = list(db.collection(collection_name).limit(batch_size).stream())
        if not docs:
            break
        for doc in docs:
            doc.reference.delete()
            total_deleted += 1
    return total_deleted


def main():
    ensure_app()
    db = firestore.client()
    collections = [
        "authors",
        "publishers",
        "books",
        "borrows",
        "ratings",
        "admin_sessions",
    ]
    for collection_name in collections:
        print(f"Clearing {collection_name}…", flush=True)
        deleted = purge_collection(db, collection_name)
        print(f"  Deleted {deleted} document(s).", flush=True)
    print("All targeted collections cleared.")


if __name__ == "__main__":
    main()
