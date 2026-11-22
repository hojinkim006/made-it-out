import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Gemini plan insights run in the Supabase Edge Function supabase/functions/plan-insight.
export default defineConfig({
  plugins: [react()],
  test: { environment: "node" },
});
