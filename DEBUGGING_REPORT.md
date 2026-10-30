# Debugging and Resolution Report

## 1. Introduction

The purpose of this exercise was to simulate the debugging of a backend API that contained functional defects, security weaknesses, and performance bottlenecks. A small blog API was used as the working example. The initial code was reviewed through static inspection, then the affected behaviours were represented in a corrected implementation and covered by regression tests.

The debugging work focused on reproducible issues rather than cosmetic changes. Each issue was considered in terms of its impact, the likely cause, the corrective change, and the test that should prevent the same defect from returning.

## 2. Debugging methodology

The following sequence was used:

1. Read the existing routes and identify how request data moves into database operations.
2. Review authentication, password handling, authorization, and SQL construction.
3. Inspect queries for unbounded reads and missing indexes.
4. Check database relationships and behaviour when parent records are missing or deleted.
5. Define expected behaviour for valid and invalid requests.
6. Apply fixes in the corrected implementation.
7. Add integration tests for both successful operations and negative cases.
8. Run the tests locally and retain the actual output as verification evidence.

## 3. Issues identified

### Issue 1 – Plaintext password storage

**Observed problem:** The starter registration route inserted the submitted password directly into the database.

**Risk:** Anyone who obtains a database copy could read users' original passwords. This also creates a serious risk if users reuse passwords on other services.

**Root cause:** Password hashing was not included in the registration and login flow.

**Resolution:** The corrected implementation hashes passwords with bcrypt before storage. Login uses bcrypt comparison instead of comparing plaintext database values. The database field is named `password_hash` to make its purpose explicit.

**Verification:** Register a user, then inspect the stored record and confirm that the stored value is not equal to the submitted password. Login with the correct password should succeed; an incorrect password should return 401.

### Issue 2 – Hard-coded JWT secret and missing token verification

**Observed problem:** The starter code signed tokens using a literal secret and did not use authentication middleware to protect write operations.

**Risk:** A secret embedded in source code can be copied or exposed. Without token verification on protected routes, callers can perform actions without proving their identity.

**Root cause:** Authentication was treated as a login response rather than a requirement enforced at each protected endpoint.

**Resolution:** The corrected server reads `JWT_SECRET` from the environment and refuses to start when it is missing or too short. Authentication middleware verifies Bearer tokens and attaches the verified user identity to the request.

**Verification:** Requests without a token and requests with an invalid token must return 401. A valid token should allow an authenticated operation.

### Issue 3 – SQL injection through search query concatenation

**Observed problem:** The starter list endpoint concatenated the search query directly into SQL text.

**Risk:** Crafted input could alter the query rather than being treated as search text.

**Root cause:** Dynamic query input was inserted into SQL syntax instead of being passed as a parameter.

**Resolution:** The corrected implementation uses placeholders and passes the search term as a bound parameter. The search string is also trimmed and capped in length.

**Verification:** Search using a normal keyword and an injection-like string. The endpoint should return matching records only and should not expose unrelated rows or fail with a SQL error.

### Issue 4 – Unbounded list query and missing pagination

**Observed problem:** The starter endpoint loaded every matching post into memory for each request.

**Risk:** As the table grows, response time, memory usage, and database work increase. Large responses also waste network bandwidth.

**Root cause:** The list endpoint had no page size, offset, or maximum result limit.

**Resolution:** The corrected endpoint supports `page` and `limit`, enforces a maximum page size of 50, and returns pagination metadata. Indexes support common filtering and ordering patterns.

**Verification:** Request page 1 with limit 1 and confirm that no more than one item is returned. Try a limit greater than 50 and confirm that the applied limit is bounded.

### Issue 5 – Missing authentication and ownership checks for post updates

**Observed problem:** The starter API accepted a user identifier from the request body when creating posts and allowed updates without checking who owned the post.

**Risk:** A caller could create content under another user's identity or modify another user's content.

**Root cause:** The API trusted client-supplied ownership data instead of using the authenticated identity.

**Resolution:** The corrected create route obtains the user ID from the verified JWT. Update and delete routes load the target record and compare its owner ID with the authenticated user ID.

**Verification:** Create two accounts. Attempt to update or delete the first account's post using the second account's token. The API should return 403. The owner should be able to update or delete it.

### Issue 6 – Missing validation and incomplete error handling

**Observed problem:** The starter routes accepted missing, empty, or incorrectly formatted fields and did not consistently distinguish missing resources from successful updates.

**Risk:** Invalid records can enter the database, while clients receive misleading success responses.

**Root cause:** Request validation and resource existence checks were not part of the route workflow.

**Resolution:** Zod schemas validate registration, post, and comment payloads. Routes check whether the requested post or comment exists before updating or deleting it and return 400, 404, or 409 where appropriate.

**Verification:** Submit invalid registration, short post content, and empty comments. Each should be rejected with 400. Request a non-existent record and confirm a 404 response.

### Issue 7 – Missing relational integrity for comments

**Observed problem:** The starter comments table did not define foreign keys, and the comment route did not confirm that its parent post existed.

**Risk:** Comments could reference invalid post IDs and become orphaned records.

**Root cause:** Database relationships were not enforced at schema level or checked by the API.

**Resolution:** The corrected schema defines foreign keys from comments to posts and users, enables SQLite foreign-key enforcement, and checks that a published parent post exists before accepting a comment. Cascading deletion removes comments when a post is deleted.

**Verification:** Attempt to comment on a missing post and expect 404. Create a comment, delete its parent post, and confirm that the comment is removed.

## 4. Performance improvements

The main performance-related change is replacing the unbounded post listing operation with bounded pagination. Search is parameterized, and indexes are created for post status/date, user/date, and comment post/date access patterns. These changes reduce unnecessary data retrieval and provide the database with useful lookup paths.

No benchmark figures are claimed in this report. To quantify performance in a real environment, create a representative dataset, run repeated requests before and after the changes, and record response-time percentiles and database size. Performance should be measured under the same hardware, dataset, and request conditions.

## 5. Regression testing

The corrected project includes automated integration tests using Node's built-in test runner and Supertest. The test suite covers:

- Health endpoint response.
- Registration validation and duplicate email handling.
- Login and token generation.
- Missing and invalid Bearer tokens.
- Post validation, creation, listing, search, and pagination.
- Ownership enforcement for post update and deletion.
- Comment validation, creation, listing, and ownership.
- Cascading deletion of comments.
- 404 handling for missing records.

Run the suite from the `fixed` directory:

```bash
npm install
npm test
```

The tests use an in-memory SQLite database to keep each test run isolated from the local database file.

## 6. Outcome

The corrected implementation addresses the identified security, validation, data-integrity, and query-efficiency issues. The tests provide repeatable checks for the main API workflows and the negative cases most likely to reveal regressions.

The test suite must be executed on the submission machine. The actual terminal output and Postman screenshots should be added to the evidence section after local verification. No test result should be reported as passed until it has been run.
