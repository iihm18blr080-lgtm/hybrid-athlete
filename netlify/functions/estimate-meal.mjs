// Hybrid Athlete — AI meal photo estimator
// Estimates calories/macros for a plate of food from a photo
// Requires env var ANTHROPIC_API_KEY set in Netlify site settings

const MEAL_PROMPT = `You are a nutrition estimation assistant looking at a photo of a plate/meal of food (not a label — actual food).
Identify what's on the plate and estimate the TOTAL nutrition for the whole visible portion shown, using typical Kuwaiti/Gulf/Middle Eastern and international dish knowledge where relevant, plus visual portion-size cues (plate size, utensils, hand if visible).
Respond with ONLY a JSON object, no markdown, no explanation:
{
  "name": "short description, e.g. 'Grilled chicken, rice, salad'",
  "kcal": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "confidence": "low", "medium", or "high"
}
These are totals for the whole portion shown in the photo, not per 100g. Give your best reasonable estimate even if uncertain — never refuse. Use null only if the image truly shows no food.`;

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
  const { image, media_type } = body || {};
  if (!image) {
    return new Response(JSON.stringify({ error: "Missing image" }), { status: 400 });
  }

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
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: image } },
            { type: "text", text: MEAL_PROMPT }
          ]
        }]
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
