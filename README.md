# Week 3 – Debugging, Testing, and Error Resolution

This package contains a deliberately defective starter API, a corrected implementation, automated regression tests, and the accompanying debugging report.

## Package layout

- `starter/` – intentionally buggy sample used to reproduce the debugging scenario. Do not deploy it.
- `fixed/` – corrected BlogCraft API source code and automated tests.
- `docs/` – debugging report, test plan, setup guide, and change log.

## Environment

- Node.js 20 or later
- npm
- Postman or cURL (for manual API checks)

## Run the corrected project

Open a terminal in `fixed/`:

```bash
npm install
```

Create `.env` from `.env.example`:

PowerShell:
```powershell
Copy-Item .env.example .env
```

macOS/Linux:
```bash
cp .env.example .env
```

Set `JWT_SECRET` to a random value of at least 32 characters, then run:

```bash
npm start
```

Health endpoint: `http://localhost:3000/api/health`

Run automated tests:

```bash
npm test
```

The tests use an in-memory SQLite database, so they do not overwrite the local development database.

## Main fixes

1. Replaced plaintext password storage with bcrypt hashing.
2. Moved the JWT secret to environment configuration and added token verification.
3. Replaced string-concatenated SQL with parameterized queries.
4. Added bounded pagination and search input limits.
5. Added authentication and ownership checks for content mutations.
6. Added schema validation and clear 400/401/403/404/409 responses.
7. Enabled SQLite foreign keys and added indexes for common list queries.
8. Added regression tests for the reported behaviours.

## Important

The automated tests are supplied but must be run in the target environment. Do not claim that they passed until `npm test` has been executed. Add screenshots or terminal output as actual evidence before submission.
