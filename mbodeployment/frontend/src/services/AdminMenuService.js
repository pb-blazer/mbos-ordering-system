import {
    getStaffAccessToken,
} from './AdminAuthService';

const API_BASE_URL = (
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? `http://${window.location.hostname}:3000` : '')
    `http://${window.location.hostname}:3000`
).replace(/\/+$/, '');

// ==========================================================
// SHARED ADMIN REQUEST
// ==========================================================

async function adminRequest(path, method = 'GET', body = null) {
    const token = await getStaffAccessToken();

    if (!token) {
        throw new Error(
            'Your staff session has expired. Please log in again.'
        );
    }

    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
    };

    const options = {
        method,
        headers,
    };

    if (body !== null) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    let response;

    try {
        response = await fetch(
            `${API_BASE_URL}${path}`,
            options
        );
    } catch (networkError) {
        const error = new Error(
            'Unable to connect to the admin service. Check your connection and try again.'
        );

        error.cause = networkError;
        throw error;
    }

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            `Server returned an invalid response (${response.status}).`
        );
    }

    if (!response.ok) {
        const error = new Error(
            data?.error ||
                `Admin request failed (${response.status}).`
        );

        error.status = response.status;
        throw error;
    }

    return data;
}

// ==========================================================
// GET ADMIN MENU
// ==========================================================

export async function getAdminMenu() {
    const data = await adminRequest(
        '/api/admin/menu'
    );

    return data.menu || [];
}

// ==========================================================
// CREATE MENU ITEM
// ==========================================================

export async function createAdminMenuItem(itemData) {
    const data = await adminRequest(
        '/api/admin/menu',
        'POST',
        itemData
    );

    return data.item;
}

// ==========================================================
// UPDATE MENU ITEM
// ==========================================================

export async function updateAdminMenuItem(
    itemId,
    updates
) {
    const data = await adminRequest(
        `/api/admin/menu/${encodeURIComponent(itemId)}`,
        'PATCH',
        updates
    );

    return data.item;
}

// ==========================================================
// ARCHIVE MENU ITEM
// ==========================================================

export async function archiveAdminMenuItem(itemId) {
    return updateAdminMenuItem(
        itemId,
        {
            is_listed: false,
        }
    );
}

// ==========================================================
// RESTORE MENU ITEM
// ==========================================================

export async function restoreAdminMenuItem(itemId) {
    return updateAdminMenuItem(
        itemId,
        {
            is_listed: true,
        }
    );
}