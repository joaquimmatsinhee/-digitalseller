import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ufgirrelsprafqwucifb.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_CehpcE-J_TOR7TXL1VGTlQ_vWBdmnSx';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface VideoRecord {
  id: string;
  title: string;
  description: string | null;
  price: number;
  video_url: string;
  thumbnail_url: string | null;
  duration: string | null;
  category: string | null;
  views_count: number | null;
  created_by: string | null;
  is_published: boolean | null;
  created_at: string;
}

export interface AppSettings {
  id: string;
  telegram_group_url: string;
  updated_at: string;
}
