# Change Log

## Week 3 debugging pass

- Replaced plaintext password persistence with bcrypt hashing.
- Added environment-based JWT secret configuration and token verification.
- Added authentication to protected content operations.
- Added ownership checks to post and comment modifications.
- Replaced SQL string concatenation with prepared query parameters.
- Added pagination and a maximum page size to post listing.
- Added Zod request validation for user, post, and comment data.
- Added explicit handling for duplicate email, missing resources, and invalid requests.
- Enabled SQLite foreign keys and added indexes for common query patterns.
- Added integration tests for successful workflows and negative cases.
