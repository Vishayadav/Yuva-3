require("dotenv").config();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("Set JWT_SECRET in .env to a random value of at least 32 characters.");
}
const { createDatabase } = require("./db");
const { createApp } = require("./app");
const db = createDatabase();
const app = createApp(db);
const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => console.log(`BlogCraft API listening on http://localhost:${port}`));
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
