# Test Plan

## Test environment

- Node.js 20 or later
- npm
- Corrected project in `fixed/`
- Isolated in-memory SQLite database for automated tests

## Automated test cases

| ID | Test scenario | Expected result |
|---|---|---|
| TC-01 | Call health endpoint | 200 and status `ok` |
| TC-02 | Register with invalid fields | 400 |
| TC-03 | Register valid user | 201 |
| TC-04 | Register duplicate email with different casing | 409 |
| TC-05 | Create post without a token | 401 |
| TC-06 | Create post with invalid title/content | 400 |
| TC-07 | Create a valid published post | 201 |
| TC-08 | List posts with page and limit | 200 and bounded result count |
| TC-09 | Search for a known title keyword | Matching record returned |
| TC-10 | Send injection-like search input | Treated as data; no SQL execution |
| TC-11 | Update another user's post | 403 |
| TC-12 | Delete another user's post | 403 |
| TC-13 | Add an empty comment | 400 |
| TC-14 | Add comment to published post | 201 |
| TC-15 | Edit comment as a different user | 403 |
| TC-16 | Delete parent post | 200; child comments cascade-delete |
| TC-17 | Delete a missing post | 404 |

## Run

```bash
npm install
npm test
```

## Manual Postman checks

1. Register two separate users.
2. Log in as both users and retain their tokens.
3. Create a post as User A.
4. Try to update the post as User B; expect 403.
5. Update the post as User A; expect success.
6. Add a comment as User A and list comments.
7. Try to edit the comment as User B; expect 403.
8. Delete the post as User A and verify its comments are no longer present.

## Evidence checklist

- [ ] Screenshot of server startup.
- [ ] Screenshot of `GET /api/health`.
- [ ] Screenshot of successful registration and login.
- [ ] Screenshot of 401 for missing token.
- [ ] Screenshot of 403 for a non-owner update.
- [ ] Screenshot of paginated post list.
- [ ] Screenshot of comment creation.
- [ ] Screenshot of `npm test` output.
- [ ] Record actual Node.js version and execution date.

## Execution record

| Date | Node version | Command | Actual result |
|---|---|---|---|
| Complete after local run | To be recorded | `npm test` | Pending |
