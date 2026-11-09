import {
    getStaffAccessToken,
} from './AdminAuthService';


const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? `http://${window.location.hostname}:3000` : '')
    `http://${window.location.hostname}:3000`;


// ==========================================================
// AUTHENTICATED ADMIN REQUEST
// ==========================================================

async function adminRequest(
    endpoint,
    options = {}
) {
    const token =
        await getStaffAccessToken();

    if (!token) {
        throw new Error(
            'Your staff session has expired. Please sign in again.'
        );
    }

    const response =
        await fetch(
            `${API_BASE_URL}${endpoint}`,
            {
                ...options,

                headers: {
                    'Content-Type':
                        'application/json',

                    ...(options.headers || {}),

                    Authorization:
                        `Bearer ${token}`,
                },
            }
        );

    let data = null;

    try {
        data =
            await response.json();
    } catch {
        // Response wasn't JSON.
    }


    // ------------------------------------------------------
    // AUTH
    // ------------------------------------------------------

    if (response.status === 401) {
        throw new Error(
            'Your staff session has expired. Please sign in again.'
        );
    }

    if (response.status === 403) {
        throw new Error(
            'This account does not have staff/admin access.'
        );
    }


    // ------------------------------------------------------
    // OTHER ERRORS
    // ------------------------------------------------------

    if (!response.ok) {
        throw new Error(
            data?.message ||
                data?.error ||
                `Request failed (${response.status})`
        );
    }


    return data;
}


// ==========================================================
// GET ACTIVE/RECENT ORDERS
// ==========================================================

export async function getAdminOrders() {
    const data =
        await adminRequest(
            '/api/orders?limit=100'
        );

    const orders =
        Array.isArray(data?.orders)
            ? data.orders
            : [];

    // Customer dashboard should only show active orders.
    return orders.filter(
        (order) =>
            [
                'pending',
                'confirmed',
                'preparing',
                'ready',
            ].includes(
                order.status
            )
    );
}


// ==========================================================
// GET ONE ORDER
// ==========================================================

export async function getAdminOrder(
    orderId
) {
    return adminRequest(
        `/api/orders/${orderId}`
    );
}


// ==========================================================
// UPDATE ORDER STATUS
// ==========================================================

export async function updateAdminOrderStatus(
    orderId,
    status
) {
    const data =
        await adminRequest(
            `/api/orders/${orderId}/status`,
            {
                method: 'PATCH',

                body: JSON.stringify({
                    status,
                }),
            }
        );

    return data?.order || data;
}