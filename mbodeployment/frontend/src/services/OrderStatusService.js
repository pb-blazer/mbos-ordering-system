const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? `http://${window.location.hostname}:3000` : '');

/**
 * Find an order using the six-digit code shown on the checkout success page.
 *
 * The backend checks today's South African date prefix first, then supports
 * older references when the six-digit suffix uniquely identifies an order.
 *
 * Example:
 * getOrderStatus('379858')
 *
 * The backend receives:
 * GET /api/orders/status?code=379858
 */
export async function getOrderStatus(code) {
    const normalizedCode = String(code || '').trim();

    // Validate the six-digit code before making a network request.
    if (!/^\d{6}$/.test(normalizedCode)) {
        const error = new Error(
            'Enter the six-digit order code shown after checkout.'
        );

        error.code = 'INVALID_ORDER_CODE';

        throw error;
    }

    const params = new URLSearchParams({
        code: normalizedCode,
    });

    let response;

    try {
        response = await fetch(
            `${API_BASE_URL}/api/orders/status?${params.toString()}`,
            {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    Accept: 'application/json',
                },
            }
        );
    } catch (networkError) {
        const error = new Error(
            'Unable to connect to the order tracking service. Check your connection and try again.'
        );

        error.code = 'ORDER_STATUS_NETWORK_ERROR';
        error.cause = networkError;

        throw error;
    }

    let data;

    try {
        data = await response.json();
    } catch {
        const error = new Error(
            `The server returned an invalid response (${response.status}).`
        );

        error.status = response.status;
        error.code = 'INVALID_SERVER_RESPONSE';

        throw error;
    }

    if (!response.ok) {
        const error = new Error(
            data?.error ||
                `Failed to check order status (${response.status}).`
        );

        error.status = response.status;
        error.code = data?.code || 'ORDER_STATUS_REQUEST_FAILED';

        throw error;
    }

    return data;
}