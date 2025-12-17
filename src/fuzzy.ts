// src/fuzzy.ts
export function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string) {
  a = norm(a); b = norm(b);
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = new Array(n + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = i - 1; dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

export function similarity(a: string, b: string) {
  const maxLen = Math.max(norm(a).length, norm(b).length) || 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// simple alias map (expand as needed)
const MOM_ALIASES = new Set(["mom","mother","mommy","mummy","amma","ammaa","ammaji","maa","ammi","aai","aayi","mata"]);
const DAD_ALIASES = new Set(["dad","father","appa","bapu","papa","pitaji","abbu"]);
export function expandAliases(q: string) {
  const t = norm(q);
  if (MOM_ALIASES.has(t)) return ["mom","mother","mummy","amma","maa"];
  if (DAD_ALIASES.has(t)) return ["dad","father","appa","papa"];
  return [q];
}
