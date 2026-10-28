import { neon } from '@neondatabase/serverless';

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

export const DATABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DATABASE_URL) ||
  'postgresql://neondb_owner:npg_LTZUw8pq5ixa@ep-bitter-credit-b5f2a23q-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

export const sql = neon(DATABASE_URL);

export async function fetchPublishedVideos(): Promise<VideoRecord[]> {
  try {
    const rows = await sql.query(
      'SELECT * FROM public.videos WHERE is_published = true OR is_published IS NULL ORDER BY created_at DESC'
    );
    return rows as VideoRecord[];
  } catch (err) {
    console.error('Error fetching videos from Neon:', err);
    throw err;
  }
}

export async function fetchAppSettings(): Promise<AppSettings | null> {
  try {
    const rows = await sql.query('SELECT * FROM public.app_settings LIMIT 1');
    if (rows && rows.length > 0) {
      return rows[0] as AppSettings;
    }
    return null;
  } catch (err) {
    console.warn('Error fetching app settings from Neon:', err);
    return null;
  }
}
