import { getStaffAccessToken } from './AdminAuthService';

const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    `http://${window.location.hostname}:3000`;

/**
 * Authenticated request helper for the admin order-history endpoint.
 */
async function adminHistoryRequest(endpoint) {
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
        // A non-JSON response is handled by the generic status message below.
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
            data?.error || `Unable to load order history (${response.status}).`
        );
    }

    return data;
}

/**
 * Fetches completed/cancelled orders from the protected history endpoint.
 *
 * status: 'all' | 'completed' | 'cancelled'
 * order_type: 'collection' | 'delivery' | 'all'
 */
export async function getAdminOrderHistory({
    status = 'all',
    orderType = 'all',
    search = '',
    limit = 25,
    offset = 0,
} = {}) {
    const params = new URLSearchParams({
        status,
        limit: String(limit),
        offset: String(offset),
    });

    if (orderType !== 'all') {
        params.set('order_type', orderType);
    }

    const cleanSearch = String(search || '').trim();

    if (cleanSearch) {
        params.set('search', cleanSearch);
    }

    return adminHistoryRequest(
        `/api/admin/orders/history?${params.toString()}`
    );
}
