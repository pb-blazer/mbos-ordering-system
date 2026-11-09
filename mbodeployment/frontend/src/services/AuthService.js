import { supabase } from './SupabaseClient';

const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? `http://${window.location.hostname}:3000` : '');


// ==========================================================
// STAFF LOGIN
// ==========================================================

export async function signInStaff(
    email,
    password
) {
    const {
        data,
        error
    } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        throw new Error(
            error.message ||
                'Unable to sign in.'
        );
    }

    if (!data?.session?.access_token) {
        throw new Error(
            'Login succeeded, but no authentication session was created.'
        );
    }

    return data;
}


// ==========================================================
// SIGN OUT
// ==========================================================

export async function signOutStaff() {
    const {
        error
    } = await supabase.auth.signOut();

    if (error) {
        throw new Error(
            error.message ||
                'Unable to sign out.'
        );
    }
}


// ==========================================================
// GET CURRENT SESSION
// ==========================================================

export async function getCurrentSession() {
    const {
        data,
        error
    } = await supabase.auth.getSession();

    if (error) {
        throw new Error(
            error.message ||
                'Unable to retrieve authentication session.'
        );
    }

    return data?.session || null;
}


// ==========================================================
// GET ACCESS TOKEN
// ==========================================================

export async function getAccessToken() {
    const session =
        await getCurrentSession();

    return session?.access_token || null;
}


// ==========================================================
// VERIFY ADMIN ACCESS THROUGH BACKEND
// ==========================================================
//
// We deliberately do NOT decide admin access purely from
// frontend user metadata.
//
// Instead, the frontend sends the Supabase access token
// to the already-protected backend admin endpoint.
//
// The backend performs:
//
// JWT verification
//      ↓
// app_metadata.role === "admin"
//      ↓
// allow / deny
//
// ==========================================================

export async function verifyAdminAccess() {
    const token =
        await getAccessToken();

    if (!token) {
        return {
            authorized: false,
            reason: 'not_authenticated',
        };
    }

    let response;

    try {
        response = await fetch(
            `${API_BASE_URL}/api/orders?limit=1`,
            {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    Accept:
                        'application/json',

                    Authorization:
                        `Bearer ${token}`,
                },
            }
        );
    } catch (error) {
        console.error(
            'Admin verification request failed:',
            error
        );

        return {
            authorized: false,
            reason: 'network_error',
        };
    }

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (response.ok) {
        return {
            authorized: true,
            data,
        };
    }

    if (response.status === 401) {
        return {
            authorized: false,
            reason: 'invalid_or_expired_token',
        };
    }

    if (response.status === 403) {
        return {
            authorized: false,
            reason: 'not_admin',
        };
    }

    return {
        authorized: false,
        reason: 'backend_error',
        error:
            data?.error ||
            `Backend returned ${response.status}`,
    };
}