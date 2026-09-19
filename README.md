# Simple E-commerce Store

## Current Phase

Phase 01 — Project Foundation & Database Connection

## Stack

Frontend:
- HTML
- CSS
- JavaScript

Backend:
- Node.js
- Express.js

Database:
- PostgreSQL

## Project Structure

```
simple-ecommerce-store/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── assets/
│       └── images/
└── backend/
    ├── src/
    │   ├── server.js
    │   ├── config/
    │   │   └── database.js
    │   ├── routes/
    │   │   └── health.routes.js
    │   ├── controllers/
    │   │   └── health.controller.js
    │   ├── services/
    │   │   └── health.service.js
    │   └── middleware/
    │       └── error.middleware.js
    ├── .env
    ├── .env.example
    ├── .gitignore
    └── package.json
├── .gitignore
└── README.md
```

## Local Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend will start on `http://localhost:5000`.

### Frontend

Serve the `/frontend` folder using a local development server such as VS Code Live Server (or any static file server).

Open `http://localhost:5500` (or the port Live Server assigns).

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your local PostgreSQL configuration:

```bash
cp backend/.env.example backend/.env
```

**Do NOT commit `backend/.env`.** The `.gitignore` already excludes it.

## API

### Health Check

```http
GET /api/health
```

Returns:

```json
{
  "success": true,
  "message": "API is healthy",
  "database": "connected"
}
```

## Current Status

Only the project foundation and database connection have been implemented in this phase:

- Express.js backend with structured route → controller → service pattern
- PostgreSQL connection pool configured via environment variables
- Database connectivity verified on startup
- CORS configured for local frontend development
- Simple frontend page that displays backend and database status

Future phases will add product listings, shopping cart, user authentication, order processing, and more.