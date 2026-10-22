const fs = require('fs');
const path = require('path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  color TEXT DEFAULT '#6366f1',
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
`;

let backend = null;

function now() { 
  return new Date().toISOString().slice(0, 19).replace('T', ' '); 
}

function initStore(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
    backend = { type: 'sqlite', db };
    console.log('Storage backend: SQLite');
    return backend.type;
  } catch (e) {
    console.warn('SQLite indisponible, bascule sur stockage JSON:', e.message);
  }

  const jsonPath = dbPath.replace(/\.db$/i, '.json');
  if (!fs.existsSync(jsonPath)) {
    fs.writeFileSync(jsonPath, JSON.stringify({ users: [], ideas: [], seq: { users: 0, ideas: 0 } }, null, 2));
  }
  backend = { type: 'json', file: jsonPath };
  console.log('Storage backend: JSON');
  return backend.type;
}

function readJson() {
  try { 
    return JSON.parse(fs.readFileSync(backend.file, 'utf8')); 
  } catch (e) { 
    return { users: [], ideas: [], seq: { users: 0, ideas: 0 } }; 
  }
}

function writeJson(data) { 
  fs.writeFileSync(backend.file, JSON.stringify(data, null, 2)); 
}

// ---------- USERS ----------
function createUser(username, email, passwordHash) {
  if (backend.type === 'sqlite') {
    const info = backend.db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)')
      .run(username, email, passwordHash);
    return { id: info.lastInsertRowid, username, email, created_at: now() };
  }
  
  const data = readJson();
  if (data.users.some(u => u.username === username || u.email === email)) {
    const err = new Error('UNIQUE constraint failed');
    throw err;
  }
  const id = ++data.seq.users;
  const user = { id, username, email, password: passwordHash, created_at: now() };
  data.users.push(user);
  writeJson(data);
  return { id, username, email, created_at: user.created_at };
}

function findUserByEmail(email) {
  if (backend.type === 'sqlite') {
    return backend.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }
  const data = readJson();
  return data.users.find(u => u.email === email);
}

function findUserById(id) {
  if (backend.type === 'sqlite') {
    return backend.db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(id);
  }
  const data = readJson();
  const u = data.users.find(u => u.id === id);
  if (!u) return null;
  return { id: u.id, username: u.username, email: u.email, created_at: u.created_at };
}

// ---------- IDEAS ----------
function listIdeas(userId, q) {
  q = q || {};
  if (backend.type === 'sqlite') {
    let sql = 'SELECT * FROM ideas WHERE user_id = ?';
    const params = [userId];
    if (q.search) { 
      sql += ' AND (title LIKE ? OR content LIKE ?)'; 
      params.push(`%${q.search}%`, `%${q.search}%`); 
    }
    if (q.category && q.category !== 'all') { 
      sql += ' AND category = ?'; 
      params.push(q.category); 
    }
    if (q.pinned === '1' || q.pinned === true) { 
      sql += ' AND pinned = 1'; 
    }
    sql += ' ORDER BY pinned DESC, updated_at DESC';
    return backend.db.prepare(sql).all(...params);
  }
  
  const data = readJson();
  let rows = data.ideas.filter(i => i.user_id === userId);
  if (q.search) {
    const s = String(q.search).toLowerCase();
    rows = rows.filter(i => (i.title||'').toLowerCase().includes(s) || (i.content||'').toLowerCase().includes(s));
  }
  if (q.category && q.category !== 'all') rows = rows.filter(i => i.category === q.category);
  if (q.pinned === '1' || q.pinned === true) rows = rows.filter(i => i.pinned);
  rows.sort((a, b) => (b.pinned - a.pinned) || String(b.updated_at).localeCompare(String(a.updated_at)));
  return rows;
}

function createIdea(userId, payload) {
  payload = payload || {};
  if (backend.type === 'sqlite') {
    const info = backend.db.prepare('INSERT INTO ideas (user_id, title, content, category, color) VALUES (?, ?, ?, ?, ?)')
      .run(userId, String(payload.title).trim(), payload.content ? String(payload.content) : '', payload.category || 'general', payload.color || '#6366f1');
    return backend.db.prepare('SELECT * FROM ideas WHERE id = ?').get(info.lastInsertRowid);
  }
  
  const data = readJson();
  const id = ++data.seq.ideas;
  const idea = {
    id,
    user_id: userId,
    title: String(payload.title).trim(),
    content: payload.content ? String(payload.content) : '',
    category: payload.category || 'general',
    color: payload.color || '#6366f1',
    pinned: 0,
    created_at: now(),
    updated_at: now(),
  };
  data.ideas.push(idea);
  writeJson(data);
  return idea;
}

function updateIdea(userId, id, data) {
  if (backend.type === 'sqlite') {
    const existing = backend.db.prepare('SELECT * FROM ideas WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) return null;
    const d = data || {};
    backend.db.prepare(`UPDATE ideas SET title = ?, content = ?, category = ?, color = ?, pinned = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
      .run(
        d.title !== undefined ? (String(d.title).trim() || existing.title) : existing.title,
        d.content !== undefined ? String(d.content) : existing.content,
        d.category !== undefined ? d.category : existing.category,
        d.color !== undefined ? d.color : existing.color,
        d.pinned !== undefined ? (d.pinned ? 1 : 0) : existing.pinned,
        id, userId
      );
    return backend.db.prepare('SELECT * FROM ideas WHERE id = ?').get(id);
  }
  
  const json = readJson();
  const idx = json.ideas.findIndex(i => i.id === id && i.user_id === userId);
  if (idx === -1) return null;
  const existing = json.ideas[idx];
  const d = data || {};
  if (d.title !== undefined) existing.title = String(d.title).trim() || existing.title;
  if (d.content !== undefined) existing.content = String(d.content);
  if (d.category !== undefined) existing.category = d.category;
  if (d.color !== undefined) existing.color = d.color;
  if (d.pinned !== undefined) existing.pinned = d.pinned ? 1 : 0;
  existing.updated_at = now();
  json.ideas[idx] = existing;
  writeJson(json);
  return existing;
}

function deleteIdea(userId, id) {
  if (backend.type === 'sqlite') {
    const info = backend.db.prepare('DELETE FROM ideas WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
  }
  const json = readJson();
  const before = json.ideas.length;
  json.ideas = json.ideas.filter(i => !(i.id === id && i.user_id === userId));
  if (json.ideas.length === before) return false;
  writeJson(json);
  return true;
}

function pinIdea(userId, id) {
  if (backend.type === 'sqlite') {
    const existing = backend.db.prepare('SELECT * FROM ideas WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) return null;
    const newPinned = existing.pinned ? 0 : 1;
    backend.db.prepare("UPDATE ideas SET pinned = ?, updated_at = datetime('now') WHERE id = ?").run(newPinned, id);
    return newPinned;
  }
  
  const json = readJson();
  const idea = json.ideas.find(i => i.id === id && i.user_id === userId);
  if (!idea) return null;
  idea.pinned = idea.pinned ? 0 : 1;
  idea.updated_at = now();
  writeJson(json);
  return idea.pinned;
}

module.exports = {
  initStore,
  createUser,
  findUserByEmail,
  findUserById,
  listIdeas,
  createIdea,
  updateIdea,
  deleteIdea,
  pinIdea,
};