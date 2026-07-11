// Hybrid Athlete — AI food name lookup (text only, no image)
// Used when the free food database has no match — e.g. restaurant/prepared items.
// Requires env var ANTHROPIC_API_KEY set in Netlify site settings.

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "Server not configured: missing ANTHROPIC_API_KEY" }), { status: 503 });
  }

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "bad_json" }), { status: 400 }); }
  const { query } = body || {};
  if (!query) return new Response(JSON.stringify({ error: "no_query" }), { status: 400 });

  const prompt = `Give nutrition info for this food/dish/menu item: "${query}"
If it's a restaurant item (e.g. a specific chain's menu item), use your knowledge of their typical published nutrition info for one standard serving/item as sold. If it's a generic food, use typical nutrition for a standard single serving.
Respond with ONLY a JSON object, no markdown, no explanation:
{
  "name": "clean display name, e.g. 'Pizza Hut Pepperoni Pan Pizza (1 slice)'",
  "kcal": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "confidence": "low", "medium", or "high"
}
These are totals for ONE standard serving/item, not per 100g. Give your best reasonable estimate even if uncertain — never refuse.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "api_error", detail: data }), { status: 502 });
    }
    const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
    const clean = text.replace(/```json|```/g, "").trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch { return new Response(JSON.stringify({ error: "parse_error", raw: text }), { status: 502 }); }
    return new Response(JSON.stringify({ ok: true, result: parsed }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "server_error", detail: String(e) }), { status: 500 });
  }
};

export const config = { path: "/api/food-lookup" };
