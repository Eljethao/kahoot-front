import { createClient } from '@supabase/supabase-js';

function requireEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string {
    const value = import.meta.env[name] as string | undefined;
    if (!value) {
        throw new Error(`Missing ${name} (see frontend/.env.example)`);
    }
    return value;
}

const supabaseUrl = requireEnv('VITE_SUPABASE_URL');
const supabaseKey = requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

export const supabase = createClient(supabaseUrl, supabaseKey);
