import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { insightMiddleware } from "./server/gemini.ts";

/** Serves POST /api/plan-insight from the dev and preview servers. The key never reaches the browser. */
function gemini(env: Record<string, string>): Plugin {
  const mw = insightMiddleware({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || "gemini-3.8-flash" });
  return {
    name: "gemini-insight",
    configureServer: (server) => void server.middlewares.use(mw),
    configurePreviewServer: (server) => void server.middlewares.use(mw),
  };
}

export default defineConfig(({ mode }) => {
  // Empty prefix loads non-VITE_ vars too, but only into this Node process.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), gemini(env)],
    test: { environment: "node" },
  };
}) as ReturnType<typeof defineConfig>;
