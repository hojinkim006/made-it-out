// Supabase Edge Function: POST { title, where, groupSize } -> { people, lo, hi, basis, tag }
// Gemini estimates the cost per person of a plan and picks a tag like #dinner.
//
// Secrets (Dashboard -> Edge Functions -> Secrets): GEMINI_API_KEY, optional GEMINI_MODEL.
// Only signed-in users can call it (the default "Verify JWT" setting).
// Self-contained single file so it can be pasted into the dashboard editor.

// Keep in sync with PLAN_TAGS in web/src/lib/insight.ts.
const PLAN_TAGS = [
  "dinner", "lunch", "brunch", "coffee", "drinks", "dessert", "outing", "friends-date", "movie",
  "game-night", "outdoors", "sports", "concert", "art", "party", "study", "shopping",
];

const SCHEMA = {
  type: "object",
  properties: {
    people: { type: "integer", description: "Headcount. Use the number in the text if there is one, otherwise the group size." },
    lo: { type: "integer", description: "Low end of cost per person, USD." },
    hi: { type: "integer", description: "High end of cost per person, USD." },
    basis: { type: "string", description: "One short line on how the estimate was worked out, e.g. '2 large pizzas per 3 people at ~$15 each'." },
    tag: { type: "string", enum: PLAN_TAGS },
  },
  required: ["people", "lo", "hi", "basis", "tag"],
};

function prompt(title: string, where: string, groupSize: number) {
  return `You estimate costs for friends planning a hangout in Boston, MA.

Plan: ${JSON.stringify(title)}
Place: ${JSON.stringify(where || "not given")}
Group size: ${groupSize}

Work out what this outing realistically costs each person, using typical current prices at the named place
(menu prices, tickets, entry fees). Share food the way people really order: for example, at a pizza place
assume about one large pizza per 2-3 people, plus drinks, tax and tip, then split it. Free activities cost 0.
Return whole dollars per person as a range lo..hi with hi >= lo.

Also pick the one tag from the allowed list that most obviously describes the plan. Use "friends-date" for
casual one-on-one or small social hangs that are mainly about catching up.`;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json(503, { error: "GEMINI_API_KEY is not set" });
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";

  let body: { title?: unknown; where?: unknown; groupSize?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad JSON" });
  }
  const title = String(body.title ?? "").slice(0, 200).trim();
  const where = String(body.where ?? "").slice(0, 200).trim();
  const groupSize = Math.min(50, Math.max(1, Math.round(Number(body.groupSize) || 1)));
  if (!title) return json(400, { error: "title is required" });

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt(title, where, groupSize) }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: SCHEMA, temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error("[gemini]", res.status, (await res.text()).slice(0, 500));
      return json(502, { error: "Gemini request failed" });
    }
    const out = await res.json();
    const text = (out.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    const raw = JSON.parse(text || "{}");
    const lo = Math.max(0, Math.round(Number(raw.lo) || 0));
    const hi = Math.max(lo, Math.round(Number(raw.hi) || 0));
    return json(200, {
      people: Math.max(1, Math.round(Number(raw.people) || groupSize)),
      lo,
      hi,
      basis: String(raw.basis ?? "").slice(0, 160),
      tag: PLAN_TAGS.includes(raw.tag) ? raw.tag : null,
    });
  } catch (err) {
    console.error("[gemini]", err instanceof Error ? err.message : err);
    return json(502, { error: "Gemini request failed" });
  }
});
