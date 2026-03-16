import os

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from routes.auth    import auth_bp
from routes.analyze import analyze_bp
from db import init_db

# -----------------------------
# App setup
# -----------------------------
app = Flask(__name__)
CORS(app)

app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "tc-secret-key-2025")
jwt = JWTManager(app)

# Register blueprints
app.register_blueprint(auth_bp)
try:
    app.register_blueprint(analyze_bp)
except Exception as e:
    print(f"⚠️  analyze_bp not registered: {e}")

# Init DB
try:
    init_db(app)
except Exception as e:
    print(f"⚠️  DB init failed: {e}")


if __name__ == "__main__":
    app.run(port=8000, debug=True)
