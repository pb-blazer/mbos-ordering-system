import { getStaffAccessToken } from './AdminAuthService';

const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? `http://${window.location.hostname}:3000` : '');

async function adminAnalyticsRequest(endpoint) {
    const token = await getStaffAccessToken();

    if (!token) {
        throw new Error(
            'Your staff session has expired. Please sign in again.'
        );
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        // Fall through to a safe HTTP error message below.
    }

    if (response.status === 401) {
        throw new Error(
            'Your staff session has expired. Please sign in again.'
        );
    }

    if (response.status === 403) {
        throw new Error(
            'This account does not have administrator access.'
        );
    }

    if (!response.ok) {
        throw new Error(
            data?.error || `Unable to load analytics (${response.status}).`
        );
    }

    return data;
}

/**
 * Fetches date-scoped business analytics. Both dates are local
 * South African calendar dates in YYYY-MM-DD format.
 */
export async function getAdminAnalytics({ from, to }) {
    if (!from || !to) {
        throw new Error('Choose both a start date and an end date.');
    }

    const params = new URLSearchParams({ from, to });

    return adminAnalyticsRequest(
        `/api/admin/analytics?${params.toString()}`
    );
}
