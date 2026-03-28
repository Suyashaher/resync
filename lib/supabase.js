const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const key = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !key) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in environment variables."
  );
}

/**
 * Server-side Supabase client.
 * Uses Service Role Key (bypasses RLS) when available, else Anon Key.
 */
const supabase = createClient(supabaseUrl, key);

module.exports = supabase;
