
const API_BASE_URL = (
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? `http://${window.location.hostname}:3000` : '')
    `http://${window.location.hostname}:3000`
).replace(/\/+$/, '');

const PENDING_ORDER_STORAGE_KEY =
    'mbo.pendingOrderAttempt.v1';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const REQUEST_TIMEOUT_MS = 30000;

let memoryPendingOrderAttempt = null;

// ==========================================================
// NORMALIZE ORDER PAYLOAD
// ==========================================================
// The same checkout receives the same local fingerprint, even
// when the items appear in a different order.
// ==========================================================

function normalizeOrderPayload(payload) {
    const orderType = payload?.order_type;

    const items = Array.isArray(payload?.items)
        ? payload.items
              .map((item) => ({
                  menu_item_id: Number(item.menu_item_id),
                  quantity: Number(item.quantity),
                  expected_price: Number(
                      Number(item.expected_price).toFixed(2)
                  ),
              }))
              .sort(
                  (a, b) =>
                      a.menu_item_id - b.menu_item_id
              )
        : [];

    const rawLatitude = payload?.latitude;
    const rawLongitude = payload?.longitude;

    const latitude =
        orderType === 'delivery' &&
        rawLatitude !== undefined &&
        rawLatitude !== null &&
        rawLatitude !== ''
            ? Number(rawLatitude)
            : null;

    const longitude =
        orderType === 'delivery' &&
        rawLongitude !== undefined &&
        rawLongitude !== null &&
        rawLongitude !== ''
            ? Number(rawLongitude)
            : null;

    return {
        customer: {
            name: String(
                payload?.customer?.name ?? ''
            ).trim(),

            phone: String(
                payload?.customer?.phone ?? ''
            ).trim(),
        },

        order_type: orderType,
        payment_method: payload?.payment_method,

        notes:
            String(payload?.notes ?? '').trim() || null,

        items,

        latitude:
            latitude !== null && Number.isFinite(latitude)
                ? latitude
                : null,

        longitude:
            longitude !== null && Number.isFinite(longitude)
                ? longitude
                : null,
    };
}

// ==========================================================
// ORDER FINGERPRINT
// ==========================================================
// Only the fingerprint is stored locally, not the customer's
// submitted name, phone number, or order payload.
// ==========================================================

async function fingerprintOrder(payload) {
    const serialized = JSON.stringify(
        normalizeOrderPayload(payload)
    );

    if (
        globalThis.crypto?.subtle &&
        typeof TextEncoder !== 'undefined'
    ) {
        const bytes = new TextEncoder().encode(serialized);

        const digest = await globalThis.crypto.subtle.digest(
            'SHA-256',
            bytes
        );

        return Array.from(new Uint8Array(digest))
            .map((byte) =>
                byte.toString(16).padStart(2, '0')
            )
            .join('');
    }

    // Local change-detection fallback for environments without
    // Web Crypto. This is not a security mechanism.
    let hash = 0xcbf29ce484222325n;

    for (let i = 0; i < serialized.length; i += 1) {
        hash ^= BigInt(serialized.charCodeAt(i));

        hash = BigInt.asUintN(
            64,
            hash * 0x100000001b3n
        );
    }

    return `fallback-${hash.toString(16)}-${serialized.length}`;
}

// ==========================================================
// SECURE IDEMPOTENCY KEY GENERATION
// ==========================================================

function createIdempotencyKey() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    if (!globalThis.crypto?.getRandomValues) {
        const error = new Error(
            'Secure request identification is unavailable in this browser. Open the website in a supported browser and try again.'
        );

        error.code = 'IDEMPOTENCY_UNAVAILABLE';

        throw error;
    }

    // Generate a UUID v4 when randomUUID is unavailable.
    const bytes = new Uint8Array(16);

    globalThis.crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0')
    ).join('');

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
    ].join('-');
}

// ==========================================================
// VALIDATE A STORED PENDING ATTEMPT
// ==========================================================

function isValidPendingAttempt(attempt) {
    if (
        !attempt ||
        typeof attempt !== 'object' ||
        typeof attempt.key !== 'string' ||
        !UUID_PATTERN.test(attempt.key) ||
        typeof attempt.fingerprint !== 'string' ||
        typeof attempt.createdAt !== 'number' ||
        !Number.isFinite(attempt.createdAt) ||
        attempt.createdAt <= 0
    ) {
        return false;
    }

    const validFingerprint =
        SHA256_PATTERN.test(attempt.fingerprint) ||
        /^fallback-[0-9a-f]+-\d+$/.test(
            attempt.fingerprint
        );

    return validFingerprint;
}

// ==========================================================
// READ THE PENDING ORDER ATTEMPT
// ==========================================================

function readPendingAttempt() {
    try {
        const stored = window.localStorage.getItem(
            PENDING_ORDER_STORAGE_KEY
        );

        if (stored) {
            const parsed = JSON.parse(stored);

            if (isValidPendingAttempt(parsed)) {
                memoryPendingOrderAttempt = parsed;

                return parsed;
            }

            window.localStorage.removeItem(
                PENDING_ORDER_STORAGE_KEY
            );
        }
    } catch (storageError) {
        // Continue with in-memory protection if browser storage
        // is unavailable. Persistence across reloads cannot be
        // guaranteed when localStorage cannot be accessed.
        console.warn(
            'Could not read saved order request:',
            storageError
        );
    }

    if (isValidPendingAttempt(memoryPendingOrderAttempt)) {
        return memoryPendingOrderAttempt;
    }

    return null;
}

// ==========================================================
// SAVE THE PENDING ORDER ATTEMPT
// ==========================================================

function savePendingAttempt(attempt) {
    memoryPendingOrderAttempt = attempt;

    try {
        window.localStorage.setItem(
            PENDING_ORDER_STORAGE_KEY,
            JSON.stringify(attempt)
        );
    } catch (storageError) {
        console.warn(
            'Could not persist the pending order request:',
            storageError
        );
    }
}

// ==========================================================
// REMOVE A SPECIFIC PENDING ATTEMPT
// ==========================================================

function removePendingAttemptByKey(key) {
    const pending = readPendingAttempt();

    if (!pending || pending.key !== key) {
        return;
    }

    memoryPendingOrderAttempt = null;

    try {
        const stored = window.localStorage.getItem(
            PENDING_ORDER_STORAGE_KEY
        );

        if (stored) {
            const parsed = JSON.parse(stored);

            // Do not remove a different, newer request.
            if (parsed?.key === key) {
                window.localStorage.removeItem(
                    PENDING_ORDER_STORAGE_KEY
                );
            }
        }
    } catch (storageError) {
        console.warn(
            'Could not clear the saved order request:',
            storageError
        );
    }
}

// ==========================================================
// GET OR CREATE A PENDING ATTEMPT
// ==========================================================

async function getPendingAttempt(payload) {
    const fingerprint = await fingerprintOrder(payload);
    const existing = readPendingAttempt();

    if (existing) {
        if (existing.fingerprint !== fingerprint) {
            const error = new Error(
                'A previous order attempt may still have reached Mbo’s Tshisanyama. The checkout details have changed, so another order has not been sent. Check your order status or contact the restaurant before starting a different order.'
            );

            error.code = 'PENDING_ORDER_UNRESOLVED';

            throw error;
        }

        // The checkout has not changed. Reuse its original key.
        return existing;
    }

    const attempt = {
        key: createIdempotencyKey(),
        fingerprint,
        createdAt: Date.now(),
    };

    savePendingAttempt(attempt);

    return attempt;
}

// ==========================================================
// CLEAR AFTER A CONFIRMED ORDER
// ==========================================================
// Checkout should call this only after confirming that the
// response contains a valid order ID.
// ==========================================================

export async function clearPendingOrderRequest(payload) {
    try {
        const fingerprint = await fingerprintOrder(payload);
        const pending = readPendingAttempt();

        if (pending?.fingerprint === fingerprint) {
            removePendingAttemptByKey(pending.key);
        }
    } catch (error) {
        console.warn(
            'Could not confirm the pending request fingerprint:',
            error
        );
    }
}

// ==========================================================
// MANUAL RECOVERY
// ==========================================================
// Only use this after independently verifying that the previous
// order was not received, or after the restaurant confirms it.
// Never call this automatically following a timeout.
// ==========================================================

export function clearPendingOrderAttemptAfterManualVerification() {
    memoryPendingOrderAttempt = null;

    try {
        window.localStorage.removeItem(
            PENDING_ORDER_STORAGE_KEY
        );
    } catch (storageError) {
        console.warn(
            'Could not clear the pending order request:',
            storageError
        );
    }
}

// ==========================================================
// CREATE ORDER
// ==========================================================

export async function createOrder(orderPayload) {
    const attempt = await getPendingAttempt(orderPayload);

    const controller = new AbortController();

    // Timing out does not mean the database failed to create
    // the order. Retain the same key for a subsequent retry.
    const timeoutId = window.setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    let response;

    try {
        response = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': attempt.key,
            },

            body: JSON.stringify(orderPayload),

            signal: controller.signal,
        });
    } catch (fetchError) {
        const error = new Error(
            'We could not confirm whether your order reached Mbo’s Tshisanyama. Keep the checkout details unchanged and retry the same order. The original request identifier will be reused.'
        );

        error.code = 'ORDER_OUTCOME_UNKNOWN';
        error.cause = fetchError;

        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }

    let data = {};

    try {
        data = await response.json();
    } catch {
        // A missing or malformed response does not prove
        // that the database failed to create the order.
    }

    if (!response.ok) {
        const ambiguousResponse =
            response.status === 408 ||
            response.status === 429 ||
            response.status >= 500;

        // These errors require preserving the identifier until
        // the original request has been resolved.
        const mustRetainKey =
            ambiguousResponse ||
            [
                'IDEMPOTENCY_KEY_REUSED',
                'IDEMPOTENCY_IN_PROGRESS',
                'IDEMPOTENCY_CHECK_UNAVAILABLE',
                'IDEMPOTENCY_STATE_UNAVAILABLE',
                'PENDING_ORDER_UNRESOLVED',
            ].includes(data?.code);

        // Definitive client-side rejections release the local
        // attempt, allowing a corrected checkout to be submitted.
        if (
            response.status >= 400 &&
            response.status < 500 &&
            !mustRetainKey
        ) {
            removePendingAttemptByKey(attempt.key);
        }

        const error = new Error(
            ambiguousResponse
                ? 'We could not confirm whether your order was received. Keep the checkout details unchanged and retry to safely check the same request.'
                : (
                    data?.error ||
                    data?.message ||
                    `Failed to create order (${response.status})`
                )
        );

        error.code =
            data?.code ||
            (
                ambiguousResponse
                    ? 'ORDER_OUTCOME_UNKNOWN'
                    : null
            );

        error.status = response.status;
        error.details = data;

        throw error;
    }

    // Do not clear the key here. Checkout must first verify
    // that the successful response contains a valid order ID.
    return data;
}
