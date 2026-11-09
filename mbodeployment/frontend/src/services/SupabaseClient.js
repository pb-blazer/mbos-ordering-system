import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL;

const supabaseKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error(
        'Missing VITE_SUPABASE_URL in frontend environment variables.'
    );
}

if (!supabaseKey) {
    throw new Error(
        'Missing VITE_SUPABASE_PUBLISHABLE_KEY in frontend environment variables.'
    );
}

export const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    }
);