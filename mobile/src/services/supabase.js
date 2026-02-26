/**
 * Tek otorite: lib/supabase/supabase.ts
 * Re-export + helpers (realtime, storage).
 */
import { supabase } from '../lib/supabase/supabase';

export { supabase };

export const supabaseHelpers = {
  subscribe: (table, callback) => {
    if (!supabase) return null;
    return supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();
  },
  uploadFile: async (bucket, path, file) => {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    return data;
  },
  getPublicUrl: (bucket, path) => {
    if (!supabase) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },
};
