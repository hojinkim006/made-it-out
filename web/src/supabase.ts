import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** False when web/.env.local is missing the Supabase settings; the app shows setup help instead. */
export const supabaseConfigured = !!(url && key);

export const supabase = createClient(url || "http://localhost:54321", key || "missing-key");

/** Public URL of the bucket that holds log photos and videos. */
export const MEDIA_BUCKET = "media";
