const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72)
});
const postSchema = z.object({
  title: z.string().trim().min(5).max(160),
  content: z.string().trim().min(20).max(20000),
  status: z.enum(["draft", "published"]).optional().default("published")
});
const commentSchema = z.object({ content: z.string().trim().min(2).max(2000) });

function createApp(db) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  function authenticate(req, res, next) {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Authentication required." });
    try {
      req.user = jwt.verify(match[1], process.env.JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
  }

  function validate(schema) {
    return (req, res, next) => {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: result.error.issues.map(i => ({ field: i.path.join("."), message: i.message }))
        });
      }
      req.body = result.data;
      next();
    };
  }

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.post("/api/auth/register", validate(registerSchema), (req, res, next) => {
    try {
      const hash = bcrypt.hashSync(req.body.password, 10);
      const result = db.prepare(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
      ).run(req.body.name, req.body.email.toLowerCase(), hash);
      res.status(201).json({ id: Number(result.lastInsertRowid), name: req.body.name, email: req.body.email.toLowerCase() });
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Email already registered." });
      next(err);
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid login data." });
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(parsed.data.email.toLowerCase());
    if (!user || !bcrypt.compareSync(parsed.data.password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "2h" });
    res.json({ token });
  });

  // Search is parameterized and pagination is bounded to prevent expensive full-table reads.
  app.get("/api/posts", (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "10", 10) || 10));
    const offset = (page - 1) * limit;
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const where = q ? "WHERE p.status = 'published' AND (p.title LIKE ? OR p.content LIKE ?)" : "WHERE p.status = 'published'";
    const args = q ? [`%${q}%`, `%${q}%`] : [];
    const total = db.prepare(`SELECT COUNT(*) AS count FROM posts p ${where}`).get(...args).count;
    const rows = db.prepare(`
      SELECT p.id, p.title, p.content, p.status, p.created_at AS createdAt,
             u.name AS author
      FROM posts p JOIN users u ON u.id = p.user_id
      ${where}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `).all(...args, limit, offset);
    res.json({ data: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  });

  app.post("/api/posts", authenticate, validate(postSchema), (req, res) => {
    const result = db.prepare(
      "INSERT INTO posts (user_id, title, content, status) VALUES (?, ?, ?, ?)"
    ).run(req.user.id, req.body.title, req.body.content, req.body.status);
    res.status(201).json(db.prepare("SELECT * FROM posts WHERE id = ?").get(result.lastInsertRowid));
  });

  app.patch("/api/posts/:id", authenticate, validate(postSchema.partial()), (req, res) => {
    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(Number(req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found." });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: "Not the post owner." });
    const nextPost = { ...post, ...req.body };
    db.prepare("UPDATE posts SET title = ?, content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(nextPost.title, nextPost.content, nextPost.status, post.id);
    res.json(db.prepare("SELECT * FROM posts WHERE id = ?").get(post.id));
  });

  app.delete("/api/posts/:id", authenticate, (req, res) => {
    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(Number(req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found." });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: "Not the post owner." });
    db.prepare("DELETE FROM posts WHERE id = ?").run(post.id);
    res.json({ message: "Post deleted." });
  });

  app.get("/api/posts/:postId/comments", (req, res) => {
    const post = db.prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'").get(Number(req.params.postId));
    if (!post) return res.status(404).json({ error: "Published post not found." });
    const comments = db.prepare(`
      SELECT c.id, c.content, c.created_at AS createdAt, u.name AS author
      FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC
    `).all(post.id);
    res.json({ data: comments });
  });

  app.post("/api/posts/:postId/comments", authenticate, validate(commentSchema), (req, res) => {
    const post = db.prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'").get(Number(req.params.postId));
    if (!post) return res.status(404).json({ error: "Published post not found." });
    const result = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
      .run(post.id, req.user.id, req.body.content);
    res.status(201).json(db.prepare("SELECT * FROM comments WHERE id = ?").get(result.lastInsertRowid));
  });

  app.patch("/api/comments/:id", authenticate, validate(commentSchema), (req, res) => {
    const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(req.params.id));
    if (!comment) return res.status(404).json({ error: "Comment not found." });
    if (comment.user_id !== req.user.id) return res.status(403).json({ error: "Not the comment owner." });
    db.prepare("UPDATE comments SET content = ? WHERE id = ?").run(req.body.content, comment.id);
    res.json(db.prepare("SELECT * FROM comments WHERE id = ?").get(comment.id));
  });

  app.delete("/api/comments/:id", authenticate, (req, res) => {
    const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(req.params.id));
    if (!comment) return res.status(404).json({ error: "Comment not found." });
    if (comment.user_id !== req.user.id) return res.status(403).json({ error: "Not the comment owner." });
    db.prepare("DELETE FROM comments WHERE id = ?").run(comment.id);
    res.json({ message: "Comment deleted." });
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  });
  return app;
}
module.exports = { createApp };
