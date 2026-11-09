import { getStaffAccessToken } from './AdminAuthService';

const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? `http://${window.location.hostname}:3000` : '');

async function adminPaymentRequest(endpoint, { method = 'GET', body } = {}) {
    const token = await getStaffAccessToken();

    if (!token) {
        throw new Error('Your staff session has expired. Please sign in again.');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        // A safe fallback is returned below.
    }

    if (response.status === 401) {
        throw new Error('Your staff session has expired. Please sign in again.');
    }

    if (response.status === 403) {
        throw new Error('This account does not have administrator access.');
    }

    if (!response.ok) {
        throw new Error(data?.error || `Payment request failed (${response.status}).`);
    }

    return data;
}

export async function getAdminPayments(filters) {
    const params = new URLSearchParams();

    Object.entries(filters || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, String(value));
        }
    });

    return adminPaymentRequest(`/api/admin/payments?${params.toString()}`);
}

export async function updateAdminOrderPayment(orderId, updates) {
    if (!Number.isSafeInteger(Number(orderId)) || Number(orderId) <= 0) {
        throw new Error('Invalid internal order ID.');
    }

    return adminPaymentRequest(`/api/admin/orders/${Number(orderId)}/payment`, {
        method: 'PATCH',
        body: updates,
    });
}

export async function getAdminOrderPaymentEvents(orderId) {
    if (!Number.isSafeInteger(Number(orderId)) || Number(orderId) <= 0) {
        throw new Error('Invalid internal order ID.');
    }

    return adminPaymentRequest(
        `/api/admin/orders/${Number(orderId)}/payment-events`
    );
}
