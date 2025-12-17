// src/activityLog.ts
import * as SQLite from "expo-sqlite";
const db = SQLite.openDatabaseSync("friend.db");

function init() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS activities(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,              -- travel|order|ride|reminder|note
      title TEXT NOT NULL,
      when_iso TEXT,                   -- YYYY-MM-DD or ISO
      meta TEXT,                       -- JSON blob
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
init();

export function logActivity(k: "travel"|"order"|"ride"|"reminder"|"note",
                            title: string, when_iso?: string, meta: any = {}) {
  db.runSync(`INSERT INTO activities(kind,title,when_iso,meta) VALUES(?,?,?,?)`,
    [k, title, when_iso || null, JSON.stringify(meta)]);
}

export function recentActivities(limit=30) {
  return db.getAllSync<any>(`SELECT * FROM activities ORDER BY id DESC LIMIT ?`, [limit]);
}

// Remove items whose when_iso is >7 days in the past
export function sweepOld() {
  db.runSync(`
    DELETE FROM activities
    WHERE when_iso IS NOT NULL
      AND DATE(when_iso) < DATE('now','-7 days')
  `);
}
