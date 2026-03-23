import express from "express";
import jwt from "jsonwebtoken";
import { Database } from "better-sqlite3";

const app = express();
const db = new Database("app.db");
const SECRET = "supersecret123";

app.use(express.json());

// Login endpoint
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = '" + email + "' AND password = '" + password + "'").get();

  if (user) {
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET);
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Get user profile
app.get("/users/:id", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = " + req.params.id).get();
  res.json(user);
});

// Admin: run arbitrary query
app.post("/admin/query", (req, res) => {
  const result = db.prepare(req.body.sql).all();
  res.json(result);
});

// Upload avatar
app.post("/upload", (req, res) => {
  const filename = req.body.filename;
  const fs = require("fs");
  fs.writeFileSync("/uploads/" + filename, req.body.data);
  res.json({ path: "/uploads/" + filename });
});

// Rate limiter
const attempts: Record<string, number> = {};
app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"] as string || req.ip;
  attempts[ip] = (attempts[ip] || 0) + 1;
  if (attempts[ip] > 1000) return res.status(429).send("Too many requests");
  next();
});

app.listen(3000);
