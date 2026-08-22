

# What you need to install

Install these on your computer first.

1. Python 3.11 from python.org. When installing, tick the box that says Add Python to PATH.
2. Node.js 18 or newer from nodejs.org.
3. Git from git-scm.com.
4. A free MongoDB Atlas account from mongodb.com/atlas. After making the account, copy the connection string. It looks something like mongodb+srv://username:password@cluster.mongodb.net.

# How the project is split

There are two folders.

ai_engine is the backend. It is written in Python and runs the AI and the database.

client is the frontend. It is the website made with React.

Both of them have to be running at the same time for the project to work.

## Setup

# Get the code

Open a terminal and run

git clone <your-repo-url> Constructor
cd Constructor

# Backend setup

cd ai_engine
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

The pip install part takes around 5 to 10 minutes the first time because it downloads PyTorch and the YOLO model. Just wait until it finishes.

The libraries it installs are:
flask
flask-cors
flask-jwt-extended
pymongo
python-dotenv
bcrypt
ultralytics
opencv-python
numpy
ezdxf
matplotlib

After that, make a file called .env inside the ai_engine folder. Put this inside it.

MONGO_URI=your-mongodb-connection-string-here
JWT_SECRET_KEY=any-random-string

Paste your real Mongo connection string in place of the placeholder.

# Frontend setup

Open a new terminal and run

cd Constructor\client
npm install

This takes around 2 minutes. It installs React, Vite, Axios, jsPDF and Cypress.

# Running the project

You need two terminals open.

In the first terminal run the backend.

cd ai_engine
venv\Scripts\activate
python app.py

You should see a line that says Running on http://127.0.0.1:8000.

In the second terminal run the frontend.

cd client
npm run dev

You should see a line that says Local: http://localhost:5173.

Now open http://localhost:5173 in your browser and the website will load.

If both terminals are running without red errors you are good to go. Open USER_MANUAL.md to see how to actually use the site.
