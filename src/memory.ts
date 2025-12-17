// src/memory.ts
import * as SQLite from "expo-sqlite";
const db = SQLite.openDatabaseSync("friend_v2.db");
let initialized = false;

function exec(sql: string) { try { db.execSync(sql); } catch {} }

function ensureInit() {
  if (initialized) return;

  exec(`PRAGMA journal_mode = WAL;`);

  // conversations
  exec(`
    CREATE TABLE IF NOT EXISTS conversations(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_text TEXT, bot_text TEXT, mood TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // facts (always includes subj; ALTER is no-op if already there)
  exec(`
    CREATE TABLE IF NOT EXISTS facts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subj TEXT NOT NULL DEFAULT 'me',
      k TEXT NOT NULL,
      v TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  exec(`ALTER TABLE facts ADD COLUMN subj TEXT NOT NULL DEFAULT 'me';`);
  exec(`CREATE INDEX IF NOT EXISTS idx_facts_subj_k ON facts(subj, k);`);

  // templates / usage
  exec(`
    CREATE TABLE IF NOT EXISTS templates(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,          -- greeting | birthday | festival | checkin
      locale TEXT NOT NULL,        -- 'en', 'hi', 'te', ...
      text TEXT NOT NULL
    );
  `);
  exec(`CREATE INDEX IF NOT EXISTS idx_templates_kind_locale ON templates(kind, locale);`);

  exec(`
    CREATE TABLE IF NOT EXISTS usage(
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS template_usage(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      template_id INTEGER NOT NULL,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  initialized = true;
}

export function initDb() { ensureInit(); }

export function addConversation(user_text: string, bot_text: string, mood: string) {
  ensureInit();
  db.runSync(
    `INSERT INTO conversations(user_text, bot_text, mood) VALUES(?,?,?)`,
    [user_text, bot_text, mood]
  );
}

export function rememberFact({ subject, key, value }:{
  subject: string; key: string; value: string
}) {
  ensureInit();
  db.runSync(
    `INSERT INTO facts(subj, k, v) VALUES(?, ?, ?)`,
    [subject.toLowerCase(), key.toLowerCase(), value.trim()]
  );
}

export function getFactsByKey(key: string, subject = "me") {
  ensureInit();
  return db.getAllSync<{k: string; v: string}>(
    `SELECT k, v FROM facts WHERE subj=? AND k=? ORDER BY id DESC LIMIT 20`,
    [subject.toLowerCase(), key.toLowerCase()]
  );
}

export function getAllFacts(limit = 30, subject = "me") {
  ensureInit();
  return db.getAllSync<{k: string; v: string}>(
    `SELECT k, v FROM facts WHERE subj=? ORDER BY id DESC LIMIT ?`,
    [subject.toLowerCase(), limit]
  );
}

export function getRecentConversation(n = 5) {
  ensureInit();
  return db.getAllSync<{user_text:string; bot_text:string}>(
    `SELECT user_text, bot_text FROM conversations ORDER BY id DESC LIMIT ?`, [n]
  );
}

// ---------- NEW: templates & usage helpers ----------
export function seedTemplates(rows: { kind: string; locale: string; text: string }[]) {
  ensureInit();
  const stmt = db.prepareSync(`INSERT INTO templates(kind, locale, text) VALUES(?,?,?)`);
  db.execSync("BEGIN");
  try {
    for (const r of rows) stmt.executeSync([r.kind, r.locale, r.text]);
    db.execSync("COMMIT");
  } catch (e) {
    db.execSync("ROLLBACK");
    throw e;
  } finally { try { stmt.finalizeSync(); } catch {} }
}

export function getTemplates(kind: string, locale: string) {
  ensureInit();
  return db.getAllSync<{ id: number; text: string }>(
    `SELECT id, text FROM templates WHERE kind=? AND locale=?`,
    [kind, locale]
  );
}

export function setUsage(key: string, value: string) {
  ensureInit();
  db.runSync(
    `INSERT INTO usage(key, value, updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
    [key, value]
  );
}

export function getUsage(key: string): string | null {
  ensureInit();
  const row = db.getFirstSync<{ value: string }>(`SELECT value FROM usage WHERE key=?`, [key]);
  return row?.value ?? null;
}

export function recordTemplateUse(kind: string, template_id: number) {
  ensureInit();
  db.runSync(`INSERT INTO template_usage(kind, template_id) VALUES(?,?)`, [kind, template_id]);
}

export function recentOpeners(days: number): string[] {
  ensureInit();
  const rows = db.getAllSync<{ bot_text: string }>(
    `SELECT bot_text FROM conversations WHERE created_at >= datetime('now', ?)`,
    [ `-${days} days` ]
  );
  const set = new Set<string>();
  for (const r of rows) {
    const opener = (r.bot_text || "").split(/[.!?]/)[0].trim();
    if (opener) set.add(opener);
  }
  return Array.from(set).slice(0, 20);
}

export function getTemplateCount(): number {
  ensureInit();
  const row = db.getFirstSync<{ c: number }>(`SELECT COUNT(*) AS c FROM templates`);
  return row?.c ?? 0;
}
