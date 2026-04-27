// lib/supabase.ts
// Supabase client for file storage (datasets)

import { createClient } from "@supabase/supabase-js";

// Server-side client with service role key (full access)
export function createServerSupabase() {
  // v8 fix: guard missing env vars — fail fast with clear message
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("[NeuroFast] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
    }
  );
}

// Public client for browser (read-only operations)
export function createPublicSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("[NeuroFast] SUPABASE_URL or SUPABASE_ANON_KEY is not set.");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

// Upload dataset file to Supabase Storage
export async function uploadDatasetFile(
  userId: string,
  fileName: string,
  content: string
): Promise<{ url: string; path: string }> {
  const supabase = createServerSupabase();
  const timestamp = Date.now();
  const path = `datasets/${userId}/${timestamp}-${fileName}`;

  const { data, error } = await supabase.storage
    .from("neurofast-datasets")
    .upload(path, content, {
      contentType: "application/x-jsonlines",
      upsert: false,
    });

  if (error) throw new Error(`Supabase upload error: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from("neurofast-datasets").getPublicUrl(path);

  return { url: publicUrl, path };
}

// Delete dataset file
export async function deleteDatasetFile(path: string): Promise<void> {
  const supabase = createServerSupabase();
  const { error } = await supabase.storage.from("neurofast-datasets").remove([path]);
  if (error) throw new Error(`Supabase delete error: ${error.message}`);
}
