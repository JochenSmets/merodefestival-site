// Pierrot → Notion → website
//
// Ontvangt webhooks van Pierrot, zoekt het concert in de Notion-database
// "Agenda (website)" via het veld Pierrot-ID, zet het vinkje Volzet aan of uit,
// en laat de website meteen opnieuw bouwen.
//
// Instellingen (Cloudflare → Worker → Settings → Variables and Secrets):
//   WEBHOOK_KEY    geheim woord dat in de webhook-URL staat (zelf kiezen)
//   NOTION_TOKEN   sleutel van de Notion-koppeling met recht "Inhoud bijwerken"
//   AGENDA_DB      b62d94be5f6c4177a988fe14895952fc
//   GITHUB_TOKEN   (optioneel) fine-grained token met recht "Actions: read and write"
//   GITHUB_REPO    (optioneel) bv. wespvzw/merodefestival-site
// Optionele KV-koppeling LOG: bewaart de laatste 20 berichten om te bekijken
// via https://<worker>/laatste?key=<WEBHOOK_KEY>

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.searchParams.get("key") !== env.WEBHOOK_KEY) {
      return new Response("Geen toegang", { status: 403 });
    }

    // Bekijken wat Pierrot de laatste keer stuurde
    if (request.method === "GET" && url.pathname.endsWith("/laatste")) {
      if (!env.LOG) return new Response("Geen LOG-koppeling ingesteld.", { status: 404 });
      const list = await env.LOG.list({ prefix: "msg:" });
      const keys = list.keys.map(k => k.name).sort().reverse().slice(0, 20);
      const items = await Promise.all(keys.map(k => env.LOG.get(k, "json")));
      return Response.json(items, { headers: { "Cache-Control": "no-store" } });
    }

    if (request.method !== "POST") return new Response("Alleen POST", { status: 405 });

    const payload = await readBody(request);
    const result = interpret(payload);

    if (env.LOG) {
      const key = "msg:" + new Date().toISOString();
      ctx.waitUntil(env.LOG.put(key, JSON.stringify({ ontvangen: key.slice(4), result, payload }),
        { expirationTtl: 60 * 60 * 24 * 30 }));
    }

    // Niets bruikbaars gevonden: wel antwoorden met 200, zodat Pierrot niet blijft herhalen
    if (!result.eventIds.length || result.volzet === null) {
      return Response.json({ ok: true, actie: "geen", reden: result.reden });
    }

    const page = await findPage(env, result.eventIds);
    if (!page) return Response.json({ ok: true, actie: "geen", reden: "Geen agenda-rij met deze Pierrot-ID", ids: result.eventIds });

    const huidig = page.properties?.Volzet?.checkbox === true;
    if (huidig === result.volzet) return Response.json({ ok: true, actie: "ongewijzigd", volzet: huidig });

    await notion(env, `pages/${page.id}`, "PATCH", { properties: { Volzet: { checkbox: result.volzet } } });
    if (env.GITHUB_TOKEN && env.GITHUB_REPO) ctx.waitUntil(rebuild(env));

    return Response.json({ ok: true, actie: "bijgewerkt", volzet: result.volzet, pagina: page.id });
  },
};

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  const raw = await request.text();
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  try { return JSON.parse(raw); } catch { return { raw }; }
}

// ------------------------------------------------------------------
// Wat betekent het bericht? Dit is het enige deel dat afhangt van het
// precieze formaat van Pierrot. Pas het aan zodra we een echt bericht zien.
// ------------------------------------------------------------------
export function interpret(p) {
  const ev = p.event || p.data?.event || p.payload?.event || {};
  const eventIds = [ev.id, ev.slug, ev.code, p.event_id, p.eventId, p.event_slug, p.data?.event_id]
    .filter(v => v !== undefined && v !== null && v !== "").map(String);

  const flag = [ev.sold_out, ev.soldOut, ev.is_sold_out, p.sold_out, p.soldOut, p.is_sold_out]
    .find(v => typeof v === "boolean" || v === "true" || v === "false" || v === 1 || v === 0);
  if (flag !== undefined) return { eventIds, volzet: flag === true || flag === "true" || flag === 1, reden: "vlag" };

  const status = String(ev.status || p.status || p.type || p.event_type || "").toLowerCase();
  if (/sold.?out|uitverkocht|volzet/.test(status)) return { eventIds, volzet: true, reden: "status" };

  const left = [ev.available, ev.remaining, ev.tickets_left, ev.available_tickets, p.available, p.remaining, p.tickets_left]
    .find(v => v !== undefined && v !== null && v !== "" && !isNaN(Number(v)));
  if (left !== undefined) return { eventIds, volzet: Number(left) <= 0, reden: "resterend" };

  const cap = ev.capacity ?? ev.max_tickets ?? p.capacity;
  const sold = ev.sold ?? ev.tickets_sold ?? p.tickets_sold;
  if (cap != null && sold != null && !isNaN(cap) && !isNaN(sold)) {
    return { eventIds, volzet: Number(sold) >= Number(cap), reden: "capaciteit" };
  }

  return { eventIds, volzet: null, reden: "Geen beschikbaarheid gevonden in het bericht" };
}

async function findPage(env, ids) {
  const or = ids.map(id => ({ property: "Pierrot-ID", rich_text: { equals: id } }));
  const r = await notion(env, `databases/${env.AGENDA_DB}/query`, "POST", { filter: { or }, page_size: 1 });
  return r.results[0] || null;
}

async function notion(env, path, method, body) {
  const res = await fetch("https://api.notion.com/v1/" + path, {
    method,
    headers: {
      Authorization: "Bearer " + env.NOTION_TOKEN,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return res.json();
}

// Laat de GitHub-workflow meteen draaien, zodat de site niet op het uur wacht
async function rebuild(env) {
  await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/notion.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "User-Agent": "merodefestival-pierrot-webhook",
    },
    body: JSON.stringify({ ref: "main" }),
  });
}
