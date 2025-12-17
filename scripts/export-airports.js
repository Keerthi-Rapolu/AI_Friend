// scripts/export-airports.js
const fs = require("fs");
const path = require("path");

function main() {
  const out = path.join(__dirname, "..", "src", "airports.generated.json");

  // Use airports-data in Node ONLY (never import it from RN code)
  let raw;
  try {
    const rawMod = require("airports-data"); // { IATA: { name, city, country } }
    raw = rawMod.default || rawMod;
  } catch (e) {
    if (e && (e.code === "MODULE_NOT_FOUND" || /Cannot find module/.test(String(e.message || "")))) {
      // Gracefully skip if airports-data isn't installed (CI/dev fallback)
      try {
        if (!fs.existsSync(out)) {
          fs.mkdirSync(path.dirname(out), { recursive: true });
          fs.writeFileSync(out, JSON.stringify([], null, 2));
        }
      } catch {}
      console.log("ℹ︎ Skipping airport generation (airports-data not installed). Using existing/empty generated file.");
    
      return;
    }
    throw e;
  }

  const rows = Object.entries(raw)
    .map(([iata, v]) => ({
      iata: String(iata).toUpperCase(),
      city: String(v.city || "").trim(),
      name: String(v.name || "").trim(),
      country: String(v.country || "").trim() || undefined,
    }))
    .filter(a => /^[A-Z]{3}$/.test(a.iata));

  fs.writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log(`✔ Wrote ${rows.length} airports → ${out}`);
}

main();
