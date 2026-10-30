# BlogCraft – Corrected API (Week 3)

This is the corrected implementation used for the Week 3 debugging exercise.

## Requirements
- Node.js 20+
- npm

## Install and configure
```bash
npm install
```
Copy `.env.example` to `.env` and set `JWT_SECRET` to a random value of at least 32 characters.

PowerShell:
```powershell
Copy-Item .env.example .env
```

macOS/Linux:
```bash
cp .env.example .env
```

## Run
```bash
npm start
```
Health check: `http://localhost:3000/api/health`

## Test
```bash
npm test
```

The test suite uses an in-memory SQLite database. It covers validation, authentication, ownership checks, pagination, parameterized search, comments, and cascading deletion.

## API endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/health`
- `GET /api/posts?page=1&limit=10&q=keyword`
- `POST /api/posts`
- `PATCH /api/posts/:id`
- `DELETE /api/posts/:id`
- `GET /api/posts/:postId/comments`
- `POST /api/posts/:postId/comments`
- `PATCH /api/comments/:id`
- `DELETE /api/comments/:id`

Protected routes require `Authorization: Bearer <token>`.

## Important
The `starter/` folder in the parent project contains deliberately insecure code for the debugging exercise. Do not run it with real data or expose it to a network. Run and assess the corrected code in this folder.
