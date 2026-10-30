// INTENTIONALLY BUGGY STARTER — use this small file to reproduce the debugging scenario.
const express = require("express");
const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const db = new Database("./buggy.sqlite");
app.use(express.json());

db.exec(`
  CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE, password TEXT);
  CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT, content TEXT);
  CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, post_id INTEGER, content TEXT);
`);

app.post("/register", (req, res) => {
  // BUG 1: password stored in plaintext; no input validation.
  const result = db.prepare("INSERT INTO users(email,password) VALUES (?,?)")
    .run(req.body.email, req.body.password);
  res.json({ id: result.lastInsertRowid });
});

app.post("/login", (req, res) => {
  // BUG 2: password comparison is direct and token secret is hard-coded.
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(req.body.email);
  if (!user || user.password !== req.body.password) return res.status(401).json({ error: "Invalid login" });
  res.json({ token: jwt.sign({ id: user.id }, "secret") });
});

app.get("/posts", (req, res) => {
  // BUG 3: unbounded query loads every row; user input concatenated into SQL.
  const q = req.query.q || "";
  const rows = db.prepare("SELECT * FROM posts WHERE title LIKE '%" + q + "%'").all();
  res.json(rows);
});

app.post("/posts", (req, res) => {
  // BUG 4: no authentication; client can supply arbitrary user_id.
  const result = db.prepare("INSERT INTO posts(user_id,title,content) VALUES (?,?,?)")
    .run(req.body.user_id, req.body.title, req.body.content);
  res.json({ id: result.lastInsertRowid });
});

app.patch("/posts/:id", (req, res) => {
  // BUG 5: no ownership check and missing record not checked.
  db.prepare("UPDATE posts SET title = ?, content = ? WHERE id = ?")
    .run(req.body.title, req.body.content, req.params.id);
  res.json({ message: "updated" });
});

app.post("/posts/:id/comments", (req, res) => {
  // BUG 6: comment is not checked against an existing post and has no validation.
  const result = db.prepare("INSERT INTO comments(post_id,content) VALUES (?,?)")
    .run(req.params.id, req.body.content);
  res.json({ id: result.lastInsertRowid });
});

app.listen(3000, () => console.log("Buggy API on port 3000"));
