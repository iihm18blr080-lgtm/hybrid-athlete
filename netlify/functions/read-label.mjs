// Hybrid Athlete — AI label reader
// Reads a nutrition label photo with Claude vision and returns clean JSON macros.
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
  const { image, media_type } = body || {};
  if (!image) return new Response(JSON.stringify({ error: "no_image" }), { status: 400 });

  const prompt = `You are reading a photo of a food nutrition label. It may be in English, Arabic, or both, and may be on a curved or crinkled package.
Extract the nutrition information and respond with ONLY a JSON object, no markdown, no explanation:
{
  "name": "product name if visible on the package, else null",
  "basis": "100g" or "serving" (which basis the main values below are given in),
  "serving_g": serving size in grams as a number, or null if not shown,
  "kcal": number,
  "protein_g": number,
  "carbs_g": number (total carbohydrate),
  "fat_g": number (total fat)
}
Use null for anything you cannot read. Numbers only, no units in values.`;

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
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: image } },
            { type: "text", text: prompt }
          ]
        }]
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

export const config = { path: "/api/read-label" };
