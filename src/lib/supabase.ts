import { createClient } from '@supabase/supabase-js';
import { offlineFetch } from './offline-sync';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase env tidak ditemukan. Pastikan file .env berisi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY, lalu restart dev server (npm run dev). Lihat README.md bagian 1.4.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    fetch: (input, init) => offlineFetch(input as RequestInfo, init),
  },
});
