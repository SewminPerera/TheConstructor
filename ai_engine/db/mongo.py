import os
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

_client = None

def init_db(app):
    
    global _client
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    _client = MongoClient(uri, serverSelectionTimeoutMS=5000)


    try:
        _client.admin.command("ping")
        print("✅ MongoDB connected successfully")
    except ConnectionFailure as e:
        print(f"❌ MongoDB connection failed: {e}")
        raise


def get_db():
    
    if _client is None:
        raise RuntimeError("MongoDB not initialised. Call init_db(app) first.")
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/theconstructor")
    db_name = uri.rsplit("/", 1)[-1]
    return _client[db_name]
