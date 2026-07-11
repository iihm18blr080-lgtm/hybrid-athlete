// Hybrid Athlete — AI food/restaurant item nutrition lookup (text-only, no photo)
// Requires env var ANTHROPIC_API_KEY set in Netlify site settings

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Bad JSON" }), { status: 400 }); }
  const { query } = body || {};
  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query" }), { status: 400 });
  }

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
    const res = await fetch("https://api.anthropic.com/v1/messages", {
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

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: (data && data.error && data.error.message) || "Anthropic API error" }), { status: 502 });
    }

    const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), { status: 500 });
  }
};
