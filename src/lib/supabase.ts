import { createClient } from "@supabase/supabase-js";

// Satu client untuk seluruh aplikasi. Sesi login disimpan di perangkat (localStorage),
// jadi tetap ada saat aplikasi dibuka offline.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
