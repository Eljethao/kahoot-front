import type { AuthError, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

// Hosts sign in with a username. Supabase Auth needs an email address, so each
// username becomes an internal one that is never shown and can never receive
// mail (.invalid is a reserved domain). This only works with "Confirm email"
// turned off in Supabase, since nobody can open a confirmation link.
const USERNAME_EMAIL_DOMAIN = 'users.quiz.invalid';
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

const CONFIRM_EMAIL_IS_ON =
    'Sign-up is not set up yet: turn off "Confirm email" in Supabase (Authentication > Sign In / Providers > Email).';

const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;

// Supabase's messages talk about email addresses; reword the ones users see.
function toFriendlyError(error: AuthError): Error {
    switch (error.code) {
        case 'user_already_exists':
            return new Error('That username is taken.');
        case 'invalid_credentials':
            return new Error('Wrong username or password.');
        // Supabase only checks or emails the address when Confirm email is on.
        case 'email_not_confirmed':
        case 'email_address_invalid':
        case 'email_address_not_authorized':
        case 'over_email_send_rate_limit':
            return new Error(CONFIRM_EMAIL_IS_ON);
    }
    if (/confirmation email/i.test(error.message)) return new Error(CONFIRM_EMAIL_IS_ON);
    return new Error(error.message);
}

export const toUser = (user: SupabaseUser): User => ({
    id: user.id,
    username: (user.user_metadata?.username as string | undefined) ?? user.email?.split('@')[0] ?? '',
    createdAt: user.created_at,
});

export const authService = {
    async register(username: string, password: string): Promise<User> {
        if (!USERNAME_PATTERN.test(username.trim())) {
            throw new Error('Username must be 3–20 characters: English letters, numbers or _.');
        }

        const { data, error } = await supabase.auth.signUp({
            email: usernameToEmail(username),
            password,
            options: { data: { username: username.trim() } },
        });
        if (error) throw toFriendlyError(error);
        if (!data.session || !data.user) throw new Error(CONFIRM_EMAIL_IS_ON);
        return toUser(data.user);
    },

    async login(username: string, password: string): Promise<User> {
        if (!USERNAME_PATTERN.test(username.trim())) throw new Error('Wrong username or password.');

        const { data, error } = await supabase.auth.signInWithPassword({
            email: usernameToEmail(username),
            password,
        });
        if (error) throw toFriendlyError(error);
        return toUser(data.user);
    },

    async logout(): Promise<void> {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async getCurrentUser(): Promise<User | null> {
        const { data } = await supabase.auth.getSession();
        return data.session ? toUser(data.session.user) : null;
    },
};
