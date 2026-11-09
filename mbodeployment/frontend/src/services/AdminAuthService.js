import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

// ==========================================================
// SUPABASE CLIENT
// ==========================================================

function getSupabaseClient() {
    if (supabaseClient) {
        return supabaseClient;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Prefer the modern publishable key.
    // Fall back to the legacy anon key if needed.
    const supabaseKey =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error(
            'Supabase frontend environment variables are missing.'
        );
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            // Recovery callbacks are handled explicitly below so this flow
            // works with the project's existing client configuration.
            detectSessionInUrl: false,
        },
    });

    return supabaseClient;
}

// ==========================================================
// ADMIN ROLE CHECK
// ==========================================================
// The backend independently verifies app_metadata.role in the JWT.
// This client-side check prevents non-admin users from seeing staff UI.
// It is a usability gate, not a replacement for backend authorization.

export function isAdminSession(session) {
    return session?.user?.app_metadata?.role === 'admin';
}

// ==========================================================
// STAFF LOGIN
// ==========================================================

export async function signInStaff(email, password) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
    });

    if (error) {
        throw new Error(error.message || 'Unable to sign in.');
    }

    if (!data?.session) {
        throw new Error(
            'Login succeeded, but no staff session was created.'
        );
    }

    if (!isAdminSession(data.session)) {
        // Do not leave an authenticated non-admin session behind after
        // rejecting an attempted staff login.
        try {
            const { error: signOutError } = await supabase.auth.signOut();

            if (signOutError) {
                console.error(
                    'NON-ADMIN SESSION SIGN-OUT ERROR:',
                    signOutError.message
                );
            }
        } catch (signOutError) {
            console.error('NON-ADMIN SESSION SIGN-OUT ERROR:', signOutError);
        }

        throw new Error(
            'This account does not have admin access. Contact an administrator if you need staff permissions.'
        );
    }

    return data;
}

// ==========================================================
// FORGOT PASSWORD: SEND RECOVERY EMAIL
// ==========================================================

export async function requestStaffPasswordReset(email) {
    const normalizedEmail = email?.trim();

    if (!normalizedEmail) {
        throw new Error('Enter your staff email address first.');
    }

    const supabase = getSupabaseClient();
    const redirectTo = `${window.location.origin}/admin/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo }
    );

    if (error) {
        throw new Error(
            error.message || 'Unable to send the password-reset email.'
        );
    }
}

// ==========================================================
// PASSWORD RECOVERY: PROCESS EMAIL CALLBACK
// ==========================================================

export async function initializeStaffPasswordRecovery() {
    const supabase = getSupabaseClient();
    const currentUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(
        currentUrl.hash.startsWith('#')
            ? currentUrl.hash.slice(1)
            : currentUrl.hash
    );

    const callbackError =
        currentUrl.searchParams.get('error_description') ||
        hashParams.get('error_description');

    if (callbackError) {
        throw new Error(callbackError);
    }

    // PKCE-style callback: ?code=...
    const code = currentUrl.searchParams.get('code');

    if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            throw new Error(
                error.message ||
                    'This password-reset link is invalid or has expired. Request a new one.'
            );
        }

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );

        return Boolean(data?.session);
    }

    // Implicit-style callback: access and refresh tokens in the URL hash.
    const accessToken =
        hashParams.get('access_token') ||
        currentUrl.searchParams.get('access_token');
    const refreshToken =
        hashParams.get('refresh_token') ||
        currentUrl.searchParams.get('refresh_token');
    const recoveryType =
        hashParams.get('type') || currentUrl.searchParams.get('type');

    if (accessToken && refreshToken) {
        if (recoveryType && recoveryType !== 'recovery') {
            throw new Error(
                'This link is not a password-reset link. Request a new password reset from staff login.'
            );
        }

        const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });

        if (error) {
            throw new Error(
                error.message ||
                    'This password-reset link is invalid or has expired. Request a new one.'
            );
        }

        // Remove sensitive auth tokens from the visible address bar/history.
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );

        return Boolean(data?.session);
    }

    // Supports a refresh after the callback was already processed.
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        throw new Error(error.message || 'Unable to verify the reset session.');
    }

    return Boolean(data?.session);
}

// ==========================================================
// SAVE NEW PASSWORD
// ==========================================================

export async function updateStaffPassword(newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        throw new Error('Your new password must contain at least 8 characters.');
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
    });

    if (error) {
        throw new Error(error.message || 'Unable to update the password.');
    }

    return data;
}

// ==========================================================
// CURRENT STAFF SESSION
// ==========================================================

export async function getStaffSession() {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.getSession();

    if (error) {
        throw new Error(
            error.message || 'Unable to check staff session.'
        );
    }

    return data?.session || null;
}

// ==========================================================
// ACCESS TOKEN
// ==========================================================

export async function getStaffAccessToken() {
    const session = await getStaffSession();

    if (!session) {
        return null;
    }

    if (!isAdminSession(session)) {
        throw new Error(
            'This account does not have admin access.'
        );
    }

    return session.access_token || null;
}

// ==========================================================
// LOGOUT
// ==========================================================

export async function signOutStaff() {
    const supabase = getSupabaseClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
        throw new Error(error.message || 'Unable to sign out.');
    }
}
