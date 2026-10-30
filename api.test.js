const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = "week-three-test-secret-at-least-thirty-two-characters";
const { createDatabase } = require("../src/db");
const { createApp } = require("../src/app");

let db, app, token, secondToken, postId, commentId;

test.before(() => {
  db = createDatabase(":memory:");
  app = createApp(db);
});

async function registerAndLogin(name, email) {
  const reg = await request(app).post("/api/auth/register").send({
    name, email, password: "SecurePass123"
  });
  assert.equal(reg.status, 201);
  const login = await request(app).post("/api/auth/login").send({
    email, password: "SecurePass123"
  });
  assert.equal(login.status, 200);
  return login.body.token;
}

test("health endpoint returns service status", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
});

test("registration rejects invalid data and duplicate emails", async () => {
  const invalid = await request(app).post("/api/auth/register").send({
    name: "A", email: "wrong", password: "123"
  });
  assert.equal(invalid.status, 400);

  token = await registerAndLogin("Primary User", "primary@example.com");
  const duplicate = await request(app).post("/api/auth/register").send({
    name: "Primary User", email: "PRIMARY@example.com", password: "SecurePass123"
  });
  assert.equal(duplicate.status, 409);
});

test("authentication rejects missing and invalid bearer tokens", async () => {
  const missing = await request(app).post("/api/posts").send({
    title: "A valid title", content: "A valid body with more than twenty characters."
  });
  assert.equal(missing.status, 401);
  const invalid = await request(app).post("/api/posts")
    .set("Authorization", "Bearer not-a-real-token")
    .send({ title: "A valid title", content: "A valid body with more than twenty characters." });
  assert.equal(invalid.status, 401);
});

test("posts validate input, support bounded pagination, and use parameterized search", async () => {
  const bad = await request(app).post("/api/posts").set("Authorization", `Bearer ${token}`)
    .send({ title: "x", content: "tiny" });
  assert.equal(bad.status, 400);

  const created = await request(app).post("/api/posts").set("Authorization", `Bearer ${token}`)
    .send({ title: "Debugging Node Services", content: "A sufficiently long article body for integration tests.", status: "published" });
  assert.equal(created.status, 201);
  postId = created.body.id;

  const list = await request(app).get("/api/posts?page=1&limit=1&q=Debugging");
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.pagination.total, 1);
  assert.equal(list.body.pagination.limit, 1);

  const injectionLike = await request(app).get("/api/posts?q=%25%27%20OR%201%3D1--");
  assert.equal(injectionLike.status, 200);
  assert.equal(injectionLike.body.data.length, 0);
});

test("only the owner can update or delete a post", async () => {
  secondToken = await registerAndLogin("Second User", "second@example.com");
  const forbiddenUpdate = await request(app).patch(`/api/posts/${postId}`)
    .set("Authorization", `Bearer ${secondToken}`).send({ title: "Hijacked title" });
  assert.equal(forbiddenUpdate.status, 403);

  const forbiddenDelete = await request(app).delete(`/api/posts/${postId}`)
    .set("Authorization", `Bearer ${secondToken}`);
  assert.equal(forbiddenDelete.status, 403);

  const allowedUpdate = await request(app).patch(`/api/posts/${postId}`)
    .set("Authorization", `Bearer ${token}`).send({ title: "Updated Debugging Article" });
  assert.equal(allowedUpdate.status, 200);
  assert.equal(allowedUpdate.body.title, "Updated Debugging Article");
});

test("comments validate input and enforce ownership", async () => {
  const invalid = await request(app).post(`/api/posts/${postId}/comments`)
    .set("Authorization", `Bearer ${token}`).send({ content: " " });
  assert.equal(invalid.status, 400);

  const created = await request(app).post(`/api/posts/${postId}/comments`)
    .set("Authorization", `Bearer ${token}`).send({ content: "A useful test comment." });
  assert.equal(created.status, 201);
  commentId = created.body.id;

  const forbidden = await request(app).patch(`/api/comments/${commentId}`)
    .set("Authorization", `Bearer ${secondToken}`).send({ content: "Attempted edit." });
  assert.equal(forbidden.status, 403);

  const listed = await request(app).get(`/api/posts/${postId}/comments`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 1);
});

test("deleting a post cascades to comments and missing resources return 404", async () => {
  const deleted = await request(app).delete(`/api/posts/${postId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleted.status, 200);
  assert.equal(db.prepare("SELECT id FROM comments WHERE id = ?").get(commentId), undefined);

  const missing = await request(app).delete(`/api/posts/${postId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 404);
});

test.after(() => db.close());
