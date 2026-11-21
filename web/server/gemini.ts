import type { IncomingMessage, ServerResponse } from "node:http";
import { GoogleGenAI } from "@google/genai";
import { PLAN_TAGS, type PlanInsight } from "../src/lib/insight.ts";

/**
 * Runs inside the Vite dev/preview server (see vite.config.ts), never in the browser,
 * so GEMINI_API_KEY stays off the client bundle.
 */
const SCHEMA = {
  type: "object",
  properties: {
    people: { type: "integer", description: "Headcount. Use the number in the text if there is one, otherwise the group size." },
    lo: { type: "integer", description: "Low end of cost per person, USD." },
    hi: { type: "integer", description: "High end of cost per person, USD." },
    basis: { type: "string", description: "One short line on how the estimate was worked out, e.g. '2 large pizzas per 3 people at ~$15 each'." },
    tag: { type: "string", enum: [...PLAN_TAGS] },
  },
  required: ["people", "lo", "hi", "basis", "tag"],
} as const;

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

let client: GoogleGenAI | null = null;

export async function planInsight(
  body: { title?: unknown; where?: unknown; groupSize?: unknown },
  env: { apiKey: string; model: string },
): Promise<PlanInsight> {
  const title = String(body.title ?? "").slice(0, 200).trim();
  const where = String(body.where ?? "").slice(0, 200).trim();
  const groupSize = Math.min(50, Math.max(1, Math.round(Number(body.groupSize) || 1)));
  if (!title) throw new Error("title is required");

  client ??= new GoogleGenAI({ apiKey: env.apiKey });
  const res = await client.models.generateContent({
    model: env.model,
    contents: prompt(title, where, groupSize),
    config: { responseMimeType: "application/json", responseJsonSchema: SCHEMA, temperature: 0.2 },
  });
  const raw = JSON.parse(res.text ?? "{}");
  const lo = Math.max(0, Math.round(Number(raw.lo) || 0));
  const hi = Math.max(lo, Math.round(Number(raw.hi) || 0));
  return {
    people: Math.max(1, Math.round(Number(raw.people) || groupSize)),
    lo,
    hi,
    basis: String(raw.basis ?? "").slice(0, 160),
    tag: PLAN_TAGS.includes(raw.tag) ? raw.tag : null,
  };
}

/** Connect-style middleware for POST /api/plan-insight. */
export function insightMiddleware(env: { apiKey?: string; model: string }) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== "/api/plan-insight") return next();
    const send = (code: number, data: unknown) => {
      res.statusCode = code;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    };
    if (req.method !== "POST") return send(405, { error: "POST only" });
    if (!env.apiKey) return send(503, { error: "GEMINI_API_KEY is not set" });
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 4000) req.destroy();
    });
    req.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        return send(400, { error: "bad JSON" });
      }
      planInsight(parsed, { apiKey: env.apiKey!, model: env.model }).then(
        (out) => send(200, out),
        (err: Error) => {
          console.error("[gemini]", err.message);
          send(502, { error: "Gemini request failed" });
        },
      );
    });
  };
}
