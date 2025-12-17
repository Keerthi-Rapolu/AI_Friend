// src/web.ts
// Tiny web helpers (free, no API keys). Strict-TS friendly.

export type WebLink = { title: string; url: string; snippet?: string };
export type WebAnswer = { summary?: string; links: WebLink[] };

function clean(s?: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

// ---------- DuckDuckGo Instant Answer (general facts / quick results)

type DDGTopic = {
  FirstURL?: string;
  Text?: string;
  Name?: string;
  Topics?: DDGTopic[];
};
type DDGResponse = {
  AbstractText?: string;
  Answer?: string;
  RelatedTopics?: DDGTopic[];
};

export async function ddgAnswer(q: string): Promise<WebAnswer> {
  try {
    const url =
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
    const res = await fetch(url);
    const json = (await res.json()) as DDGResponse;

    const summary = clean(json.AbstractText || json.Answer);
    const links: WebLink[] = [];

    // push helper
    const pushIf = (t: DDGTopic) => {
      const title = clean(t.Text ?? t.Name ?? "");
      const url = t.FirstURL ?? "";
      if (title && url) links.push({ title, url });
    };

    if (Array.isArray(json.RelatedTopics)) {
      for (const t of json.RelatedTopics) {
        if (Array.isArray(t.Topics)) {
          for (const sub of t.Topics) {
            pushIf(sub);
            if (links.length >= 5) break;
          }
        } else {
          pushIf(t);
        }
        if (links.length >= 5) break;
      }
    }

    return { summary, links };
  } catch {
    return { summary: undefined, links: [] };
  }
}

// ---------- Wikipedia summary (great for “who/what is …”)

type WikiSearchResp = { pages?: { id: number; key: string; title: string }[] };
type WikiSummaryResp = {
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
};

export async function wikiSummary(q: string): Promise<WebAnswer> {
  try {
    const s = await fetch(
      `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=1`
    );
    const sr = (await s.json()) as WikiSearchResp;
    const top = sr?.pages && sr.pages[0]?.title;
    if (!top) return { summary: undefined, links: [] };

    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top)}`
    );
    const j = (await r.json()) as WikiSummaryResp;

    const summary = clean(j.extract);
    const url =
      j.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(top)}`;

    return { summary, links: [{ title: j.title ?? top, url }] };
  } catch {
    return { summary: undefined, links: [] };
  }
}

// ---------- Joke (free, no key)

export async function getJoke(): Promise<string> {
  try {
    const r = await fetch("https://icanhazdadjoke.com/", {
      headers: { Accept: "text/plain", "User-Agent": "ai-friend-app" },
    });
    const txt = await r.text();
    return clean(txt);
  } catch {
    return "I tried to fetch a joke, but the internet ghosted me.";
  }
}

// ---------- Recipe convenience (find good links)

export async function recipeLinks(dish: string): Promise<WebAnswer> {
  return ddgAnswer(`recipe ${dish}`);
}

// ---------- Smart router: choose a source based on the user text

export async function answerFromWeb(userText: string): Promise<WebAnswer> {
  const t = userText.toLowerCase();

  // how-to style requests
  if (/^\s*how (do i|to)\b/.test(t) || /\bsteps?\b/.test(t) || /\bexplain\b/.test(t)) {
    return ddgAnswer(userText);
  }

  // explicit jokes
  if (/\bjoke\b/.test(t)) {
    const j = await getJoke();
    return { summary: j, links: [] };
  }

  // news queries (“news about X”)
  if (/\bnews\b/.test(t)) {
    return ddgAnswer(userText);
  }

  // who/what/where/when → wiki first, then fallback
  if (/\b(who|what|where|when)\b/.test(t)) {
    const w = await wikiSummary(userText);
    if (w.summary) return w;
    return ddgAnswer(userText);
  }

  // cooking/recipes
  if (/\b(recipe|cook|make)\b/.test(t)) {
    return recipeLinks(userText.replace(/\b(cook|make)\b/i, "recipe"));
  }

  // default: general answer
  return ddgAnswer(userText);
}

// ---------- Tiny helper you can use in the UI (optional)

export function pickTopLink(ans: WebAnswer): WebLink | undefined {
  return ans.links && ans.links.length > 0 ? ans.links[0] : undefined;
}


export async function getTopHeadline(
  ceid = "US:en"
): Promise<{ title: string; url: string } | null> {
  try {
    const xml = await (await fetch(`https://news.google.com/rss?ceid=${ceid}`)).text();
    const m = xml.match(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>/i);
    if (!m) return null;
    return { title: m[1], url: m[2] };
  } catch {
    return null;
  }
}