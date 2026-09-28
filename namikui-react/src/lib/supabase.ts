import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://xqzyncgtzybuclgxfzoi.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_dy0l_clzR9nOP6LKGqGA0w_bAkPPA7B';

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const FAKE_EMAIL_DOMAIN = '@loopysplaygroundapp.com';

export async function usernameToEmailSafe(username: string): Promise<string> {
  const normalized = username.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return 'u' + hex.slice(0, 32);
}
