window.supabaseClient = null;

async function initSupabase() {
  if (!window.KNOWLEDGE_CONFIG) return null;

  const url = window.KNOWLEDGE_CONFIG.SUPABASE_URL;
  const key = window.KNOWLEDGE_CONFIG.SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("YOUR_PROJECT")) return null;

  try {
    const { createClient } = await import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
    );

    window.supabaseClient = createClient(url, key);
    return window.supabaseClient;
  } catch (error) {
    console.warn("Supabase unavailable; using local mode.", error);
    return null;
  }
}
