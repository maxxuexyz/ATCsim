// This is a browser publishable key. Database access is protected by RLS.
const projectUrl = 'https://ndfnhwabjrhobycnvvkl.supabase.co';
const publishableKey = 'sb_publishable_0fCX2v02D20-Scn8xsLc_A_ICo4xKRB';

try {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  window.apcSupabase = createClient(projectUrl, publishableKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  window.dispatchEvent(new CustomEvent('apc-supabase-ready', { detail: { client: window.apcSupabase } }));
} catch (error) {
  window.dispatchEvent(new CustomEvent('apc-supabase-ready', { detail: { error } }));
}
