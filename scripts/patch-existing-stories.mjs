import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aitftkhddarnofqwigeu.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdGZ0a2hkZGFybm9mcXdpZ2V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5Mjk0MjA0MiwiZXhwIjoyMTA4NTE4MDQyfQ.BwLNrpAz2QzGjEkEtryVF6M7dgVzOPH28T85ZFhr8wo';

const CATEGORY_IMAGES = {
  politics: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80',
  civic: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=80',
  business: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
  tech: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
  electronics: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
  health: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
  weather: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=800&q=80',
  crime: 'https://images.unsplash.com/photo-1589578527966-fdac0f44566c?auto=format&fit=crop&w=800&q=80',
  vehicle: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
  general: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=800&q=80',
};

function getRef(cat) {
  const c = (cat || '').toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_IMAGES)) {
    if (c.includes(k)) return v;
  }
  return CATEGORY_IMAGES.general;
}

async function run() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: stories, error } = await sb.from('stories').select('id, category, media_url, created_at');
  if (error) {
    console.error('Error fetching stories:', error);
    process.exit(1);
  }

  console.log(`Found ${stories.length} stories`);
  const now = new Date().toISOString();

  for (const s of stories) {
    const updates = {};
    if (!s.media_url) {
      updates.media_url = getRef(s.category);
    }
    // Refresh created_at to now if older than 12h
    const ageHours = (Date.now() - new Date(s.created_at).getTime()) / (3600 * 1000);
    if (ageHours > 12) {
      updates.created_at = now;
      updates.updated_at = now;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await sb.from('stories').update(updates).eq('id', s.id);
      if (updErr) console.error(`Failed to update ${s.id}:`, updErr.message);
      else console.log(`Updated story ${s.id} with ${JSON.stringify(updates)}`);
    }
  }
  console.log('Done patching stories');
}

run();
