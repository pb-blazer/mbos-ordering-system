
import { useEffect, useMemo, useState } from 'react';

import Header from '../components/Header';

import {
    clearCart,
    getStoredCart,
    flagCartToClearOnMenuReturn,
    removeFromCart,
    subscribeToCartChanges,
} from '../services/CartService';

import {
    createOrder,
    clearPendingOrderRequest,
} from '../services/OrderService';

// ======================================================
// MOBILE-COMPATIBLE CLIPBOARD FALLBACK
// Uses the modern Clipboard API when available. If the
// browser does not expose it (common on non-HTTPS pages),
// falls back to a temporary textarea + execCommand copy.
// ======================================================

function copyTextUsingLegacyClipboard(text) {
    if (typeof document === 'undefined' || !document.body) {
        return false;
    }

    const textArea = document.createElement('textarea');
    const previouslyFocusedElement = document.activeElement;

    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.setAttribute('aria-hidden', 'true');
    textArea.setAttribute('tabindex', '-1');

    // Keep the temporary field in the document because some
    // mobile browsers cannot copy from display:none elements.
    Object.assign(textArea.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '2px',
        height: '2px',
        padding: '0',
        border: '0',
        margin: '0',
        opacity: '0',
        overflow: 'hidden',
        fontSize: '16px',
        pointerEvents: 'none',
        zIndex: '-1',
    });

    document.body.appendChild(textArea);

    let copied = false;

    try {
        try {
            textArea.focus({ preventScroll: true });
        } catch {
            textArea.focus();
        }

        const userAgent = navigator.userAgent || '';
        const isIOS =
            /iPad|iPhone|iPod/i.test(userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOS) {
            // iOS Safari needs an explicitly selected editable range
            // for the legacy copy command in some browser versions.
            textArea.contentEditable = 'true';
            textArea.readOnly = false;

            const range = document.createRange();
            range.selectNodeContents(textArea);

            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);

            textArea.setSelectionRange(0, text.length);
        } else {
            textArea.select();
            textArea.setSelectionRange(0, text.length);
        }

        // Deprecated but still supported by many mobile browsers
        // as a fallback when navigator.clipboard is unavailable.
        copied = document.execCommand('copy') === true;
    } catch (error) {
        console.warn('Legacy clipboard copy failed:', error);
        copied = false;
    } finally {
        textArea.remove();

        // Return focus to the button so the customer does not lose
        // their place on the order confirmation screen.
        if (
            previouslyFocusedElement &&
            typeof previouslyFocusedElement.focus === 'function' &&
            document.contains(previouslyFocusedElement)
        ) {
            try {
                previouslyFocusedElement.focus({ preventScroll: true });
            } catch {
                previouslyFocusedElement.focus();
            }
        }
    }

    return copied;
}

function Checkout() {
    // ======================================================
    // STATE
    // ======================================================

    const [cart, setCart] = useState(getStoredCart);

    const [orderType, setOrderType] = useState('collection');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [phone, setPhone] = useState('');

    const [deliveryLocation, setDeliveryLocation] = useState('');
    const [deliveryCoordinates, setDeliveryCoordinates] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState('');

    const [notes, setNotes] = useState('');
    const [placingOrder, setPlacingOrder] = useState(false);

    const [orderError, setOrderError] = useState('');
    const [orderErrorCode, setOrderErrorCode] = useState(null);
    const [orderSuccess, setOrderSuccess] = useState(null);
    const [orderCodeCopied, setOrderCodeCopied] = useState(false);
    const [orderCodeCopyError, setOrderCodeCopyError] = useState('');

    // True when a previous submission might have reached the server,
    // but the frontend has not received a definitive result.
    const [orderOutcomeUnknown, setOrderOutcomeUnknown] = useState(false);

    // These cases require manual verification before another submission.
    const orderRetryBlocked =
        orderErrorCode === 'IDEMPOTENCY_KEY_REUSED' ||
        orderErrorCode === 'PENDING_ORDER_UNRESOLVED';

    const orderDetailsLocked =
        placingOrder || orderOutcomeUnknown;

    // Keep the checkout view synchronized with CartService.
    useEffect(() => {
        return subscribeToCartChanges((updatedCart) => {
            setCart(updatedCart);
        });
    }, []);

    // ======================================================
    // CART TOTALS AND VALIDATION
    // ======================================================

    const subtotal = useMemo(() => {
        return cart.reduce((total, item) => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;

            return total + price * quantity;
        }, 0);
    }, [cart]);

    const deliveryFee = orderType === 'delivery' ? 100 : 0;
    const total = subtotal + deliveryFee;

    const cartHasUnavailableItems = useMemo(
        () => cart.some((item) => item.available === false),
        [cart]
    );

    const customerDetailsComplete =
        customerName.trim().length > 0 &&
        phone.length === 10;

    const deliveryDetailsComplete =
        orderType === 'collection' ||
        deliveryCoordinates !== null;

    const orderReady =
        cart.length > 0 &&
        !cartHasUnavailableItems &&
        customerDetailsComplete &&
        deliveryDetailsComplete &&
        paymentMethod !== '';

    // ======================================================
    // FULL NAME
    // ======================================================

    const handleCustomerNameChange = (event) => {
        if (orderDetailsLocked) {
            return;
        }

        // Allow alphabetic letters and spaces only.
        // Remove numbers and special characters.
        const value = event.target.value.replace(/[^a-zA-Z\s]/g, '');

        setCustomerName(value);
    };

    // ======================================================
    // PHONE NUMBER
    // ======================================================

    const handlePhoneChange = (event) => {
        if (orderDetailsLocked) {
            return;
        }

        const value = event.target.value.replace(/\D/g, '');

        if (value.length === 0) {
            setPhone('');
            return;
        }

        // South African mobile numbers must start with 0.
        if (value[0] !== '0') {
            return;
        }

        // The second digit must be 6, 7, 8, or 9.
        if (
            value.length >= 2 &&
            !['6', '7', '8', '9'].includes(value[1])
        ) {
            return;
        }

        // Allow no more than ten digits.
        if (value.length <= 10) {
            setPhone(value);
        }
    };

    // ======================================================
    // ORDER TYPE
    // ======================================================

    const handleOrderTypeChange = (type) => {
        if (orderDetailsLocked) {
            return;
        }

        setOrderType(type);

        setLocationError('');
        setDeliveryLocation('');
        setDeliveryCoordinates(null);
    };

    // ======================================================
    // DELIVERY GPS LOCATION
    // ======================================================

    const handleShareLocation = () => {
        if (orderDetailsLocked) {
            return;
        }

        setLocationError('');
        setDeliveryCoordinates(null);
        setDeliveryLocation('');

        // Browser geolocation requires a secure context.
        // HTTPS is required on deployed websites. Localhost is
        // also considered secure during local development.
        if (window.isSecureContext === false) {
            setLocationError(
                'Location requires a secure HTTPS website on your phone. Open the HTTPS version of Mbo’s website, then tap SHARE LOCATION again. A local-network HTTP address may not be allowed to request GPS.'
            );

            return;
        }

        if (!navigator.geolocation) {
            setLocationError(
                'This browser does not provide location services. Open the website in your phone’s normal browser and try again.'
            );

            return;
        }

        setLocationLoading(true);

        const handlePosition = (position) => {
            const { latitude, longitude } = position.coords;

            setDeliveryCoordinates({
                latitude,
                longitude,
            });

            setDeliveryLocation(
                `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            );

            setLocationError('');
            setLocationLoading(false);
        };

        const handlePositionError = (
            error,
            usedFallback = false
        ) => {
            // High-accuracy GPS can time out indoors.
            // Retry once using lower-accuracy location sources.
            if (
                !usedFallback &&
                (error.code === 2 || error.code === 3)
            ) {
                try {
                    navigator.geolocation.getCurrentPosition(
                        handlePosition,
                        (fallbackError) =>
                            handlePositionError(fallbackError, true),
                        {
                            enableHighAccuracy: false,
                            timeout: 20000,
                            maximumAge: 10000,
                        }
                    );

                    return;
                } catch (fallbackStartError) {
                    console.error(
                        'Could not start fallback location request:',
                        fallbackStartError
                    );
                }
            }

            console.error('Location error:', error);

            setLocationLoading(false);

            if (error.code === 1) {
                setLocationError(
                    'Your browser is blocking location for this website. Open the site controls beside the address bar, go to Permissions or Site settings → Location, change the setting to Ask or Allow, reload the page, and tap SHARE LOCATION again. Also make sure Location Services are enabled in your phone settings. The website cannot force a new permission prompt while the browser has this site blocked.'
                );
            } else if (error.code === 2) {
                setLocationError(
                    'Your device could not determine its location. Turn on your phone’s Location Services (and Precise or High Accuracy Location if available), make sure Wi-Fi or mobile data is available, then retry. Trying near a window or outdoors may help.'
                );
            } else if (error.code === 3) {
                setLocationError(
                    'The location request timed out. Keep Location Services on and tap SHARE LOCATION to try again. A clearer GPS signal, Wi-Fi, or moving near a window may help.'
                );
            } else {
                setLocationError(
                    'Location could not be retrieved. Check the website permission and your phone’s Location Services, then reload this page and retry.'
                );
            }
        };

        // Start the request directly from the user's button click.
        try {
            navigator.geolocation.getCurrentPosition(
                handlePosition,
                (error) => handlePositionError(error, false),
                {
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 0,
                }
            );
        } catch (error) {
            console.error(
                'Could not start location request:',
                error
            );

            setLocationLoading(false);

            setLocationError(
                'The browser could not start a location request. Confirm that this website is using HTTPS and that it is allowed to access location.'
            );
        }
    };

    // ======================================================
    // CART ITEM REMOVAL
    // ======================================================

    const handleRemoveItem = (itemId) => {
        if (orderDetailsLocked) {
            return;
        }

        const updatedCart = removeFromCart(itemId);

        setCart(updatedCart);

        // Clear outdated checkout errors after the cart changes.
        setOrderError('');
        setOrderErrorCode(null);
    };

    // ======================================================
    // RETURN TO MENU AFTER AN ORDER ERROR
    // ======================================================

    const handleReturnToMenu = () => {
        // Do not let the customer change their checkout while
        // the previous submission may already have succeeded.
        if (placingOrder || orderOutcomeUnknown) {
            return;
        }

        // PRICE_CHANGED is handled by Menu.jsx when the customer
        // returns. ITEM_UNAVAILABLE allows remaining items to reconcile.
        window.location.assign('/menu');
    };

    // ======================================================
    // PLACE ORDER
    // ======================================================

    const handlePlaceOrder = async () => {
        if (
            !orderReady ||
            placingOrder ||
            orderRetryBlocked
        ) {
            return;
        }

        setPlacingOrder(true);
        setOrderError('');
        setOrderErrorCode(null);
        setOrderSuccess(null);

        let submissionCallStarted = false;

        try {
            const orderData = {
                customer: {
                    name: customerName.trim(),
                    phone: phone.trim(),
                },

                order_type: orderType,
                payment_method: paymentMethod,
                notes: notes.trim(),

                // expected_price is the price the customer reviewed.
                // The database validates it against the current price.
                items: cart.map((item) => ({
                    menu_item_id: Number(item.id),
                    quantity: Number(item.quantity),
                    expected_price: Number(
                        Number(item.price).toFixed(2)
                    ),
                })),
            };

            if (orderType === 'delivery') {
                if (!deliveryCoordinates) {
                    throw new Error(
                        'Share your delivery location before placing your order.'
                    );
                }

                orderData.latitude =
                    deliveryCoordinates.latitude;

                orderData.longitude =
                    deliveryCoordinates.longitude;
            }

            // OrderService reuses the same pending idempotency key
            // when this exact checkout is retried.
            submissionCallStarted = true;

            const result = await createOrder(orderData);

            const orderNumber = result?.order?.order_number;

            if (
                !result?.order?.order_id ||
                typeof orderNumber !== 'string' ||
                !/^MBO-\d{6}-\d{6}$/.test(orderNumber)
            ) {
                // A successful HTTP response without a valid customer-facing
                // order reference does not prove that the order was not created.
                // Keep the pending request so a retry can safely recover it.
                const confirmationError = new Error(
                    'We could not confirm your order reference. Keep your checkout unchanged and contact Mbo’s Tshisanyama before making another order.'
                );

                confirmationError.code =
                    'ORDER_CONFIRMATION_UNKNOWN';

                throw confirmationError;
            }

            // Clear the saved request only after the server returns
            // a valid order ID. OrderService checks the fingerprint.
            await clearPendingOrderRequest(orderData);

            setOrderOutcomeUnknown(false);
            setOrderError('');
            setOrderErrorCode(null);

            // Clear the cart only after the server confirms success.
            clearCart();

            setOrderSuccess(result);

            window.scrollTo({
                top: 0,
                behavior: 'smooth',
            });
        } catch (error) {
            console.error('Order submission failed:', error);

            const errorCode = error?.code;
            const status = error?.status;

            // --------------------------------------------------
            // KNOWN PRICE CHANGE
            // --------------------------------------------------

            if (errorCode === 'PRICE_CHANGED') {
                setOrderOutcomeUnknown(false);
                setOrderErrorCode('PRICE_CHANGED');

                flagCartToClearOnMenuReturn();

                setOrderError(
                    'A menu price changed while you were ordering. Return to the menu and refresh your cart before placing your order again.'
                );

            // --------------------------------------------------
            // KNOWN UNAVAILABLE ITEM
            // --------------------------------------------------

            } else if (errorCode === 'ITEM_UNAVAILABLE') {
                setOrderOutcomeUnknown(false);
                setOrderErrorCode('ITEM_UNAVAILABLE');

                setOrderError(
                    'One or more items are no longer available. Return to the menu to refresh your cart and remove unavailable items before placing your order again.'
                );

            // --------------------------------------------------
            // SAME KEY USED WITH DIFFERENT REQUEST DETAILS
            // --------------------------------------------------

            } else if (errorCode === 'IDEMPOTENCY_KEY_REUSED') {
                // Keep the pending request. A previous order may exist.
                setOrderOutcomeUnknown(true);
                setOrderErrorCode('IDEMPOTENCY_KEY_REUSED');

                setOrderError(
                    'This request identifier is associated with different order details. For your protection, another submission is blocked. Check your existing order or contact Mbo’s Tshisanyama before continuing.'
                );

            // --------------------------------------------------
            // PREVIOUS CHECKOUT CANNOT BE SAFELY REUSED
            // --------------------------------------------------

            } else if (errorCode === 'PENDING_ORDER_UNRESOLVED') {
                // OrderService refused to send a changed checkout
                // because an earlier submission is still unresolved.
                setOrderOutcomeUnknown(true);
                setOrderErrorCode('PENDING_ORDER_UNRESOLVED');

                setOrderError(
                    'A previous order attempt may have reached the restaurant, but the current checkout details differ. No new order was sent. Check your order status or contact Mbo’s Tshisanyama before starting another order.'
                );

            // --------------------------------------------------
            // RESPONSE MAY BE TEMPORARY OR AMBIGUOUS
            // --------------------------------------------------

            } else {
                const uncertainCodes = [
                    'ORDER_OUTCOME_UNKNOWN',
                    'ORDER_CONFIRMATION_UNKNOWN',
                    'IDEMPOTENCY_IN_PROGRESS',
                    'IDEMPOTENCY_CHECK_UNAVAILABLE',
                    'IDEMPOTENCY_STATE_UNAVAILABLE',
                ];

                const outcomeMayBeUnknown =
                    uncertainCodes.includes(errorCode) ||
                    status === 408 ||
                    status === 429 ||
                    (typeof status === 'number' && status >= 500);

                if (outcomeMayBeUnknown) {
                    // Retain the pending request and freeze the checkout.
                    // The customer can retry with the same request key,
                    // unless the backend explicitly reported a key conflict.
                    setOrderOutcomeUnknown(true);

                    setOrderErrorCode(
                        errorCode || 'ORDER_OUTCOME_UNKNOWN'
                    );

                    setOrderError(
                        'We could not confirm whether your order was received. Keep your checkout details unchanged. Use RETRY SAME ORDER SAFELY to check the same submission, or contact Mbo’s Tshisanyama if the problem continues.'
                    );
                } else {
                    // A normal validation or other definitive rejection.
                    setOrderOutcomeUnknown(false);
                    setOrderErrorCode(errorCode || null);

                    setOrderError(
                        error.message ||
                        'Your order was rejected. Check your information and try again.'
                    );
                }

                // If createOrder was entered but threw an unexpected
                // unstructured error, be conservative only when there
                // is evidence the server might have received the request.
                if (
                    submissionCallStarted &&
                    !errorCode &&
                    status === undefined &&
                    error?.name === 'AbortError'
                ) {
                    setOrderOutcomeUnknown(true);
                    setOrderErrorCode('ORDER_OUTCOME_UNKNOWN');

                    setOrderError(
                        'The request timed out. We cannot confirm whether the order was received. Keep the details unchanged and contact Mbo’s Tshisanyama if retrying does not resolve the request.'
                    );
                }
            }
        } finally {
            setPlacingOrder(false);
        }
    };

    // ======================================================
    // SUCCESS TOTAL
    // ======================================================

    const serverSubtotal = Number(orderSuccess?.order?.subtotal);

    const confirmedSubtotal =
        orderSuccess && Number.isFinite(serverSubtotal)
            ? serverSubtotal
            : subtotal;

    const confirmedTotal = confirmedSubtotal + deliveryFee;

    const successfulOrderNumber = String(
        orderSuccess?.order?.order_number || ''
    );

    const successfulOrderCode =
        successfulOrderNumber.match(/^MBO-\d{6}-(\d{6})$/)?.[1] || '';

    const handleCopyOrderCode = async () => {
        if (!/^\d{6}$/.test(successfulOrderCode)) {
            setOrderCodeCopyError(
                'The six-digit order code is unavailable. Please contact Mbo’s Tshisanyama.'
            );
            return;
        }

        setOrderCodeCopied(false);
        setOrderCodeCopyError('');

        // First use the browser's native clipboard support. This is
        // the preferred path on current Android and iPhone browsers.
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(successfulOrderCode);
                setOrderCodeCopied(true);
                return;
            } catch (error) {
                console.warn(
                    'Native clipboard write failed; trying mobile fallback:',
                    error
                );
            }
        }

        // Fallback for mobile browsers and non-secure contexts where
        // navigator.clipboard is unavailable or permission is denied.
        const copied = copyTextUsingLegacyClipboard(successfulOrderCode);

        if (copied) {
            setOrderCodeCopied(true);
            setOrderCodeCopyError('');
            return;
        }

        setOrderCodeCopied(false);
        setOrderCodeCopyError(
            'Your browser blocked clipboard access. Open the ordering website using its secure HTTPS address and try again.'
        );
    };

    // ======================================================
    // ORDER SUCCESS SCREEN
    // ======================================================

    if (orderSuccess) {
        return (
            <>
                <Header />

                <main className="checkout-page">
                    <section className="checkout-success">
                        <div className="checkout-success-icon">
                            ✓
                        </div>

                        <p className="checkout-eyebrow">
                            ORDER RECEIVED
                        </p>

                        <h1>
                            THANK YOU,{' '}
                            <span>
                                {customerName.toUpperCase()}
                            </span>
                        </h1>

                        <p className="checkout-success-text">
                            Your order has been successfully
                            submitted to Mbo’s Tshisanyama.
                        </p>

                        {successfulOrderCode && (
                            <div className="checkout-order-code">
                                <p className="checkout-eyebrow">
                                    YOUR 6-DIGIT ORDER CODE
                                </p>

                                <input
                                    type="text"
                                    className="checkout-order-code-value"
                                    value={successfulOrderCode}
                                    readOnly
                                    aria-label="Six-digit order code"
                                    onFocus={(event) => event.currentTarget.select()}
                                    onClick={(event) => event.currentTarget.select()}
                                    title="Click to select the six-digit code"
                                />

                                <button
                                    className="checkout-success-button"
                                    type="button"
                                    onClick={handleCopyOrderCode}
                                >
                                    {orderCodeCopied
                                        ? 'CODE COPIED'
                                        : 'COPY 6-DIGIT CODE'}
                                </button>

                                {orderCodeCopyError && (
                                    <p className="checkout-error" role="status">
                                        {orderCodeCopyError}
                                    </p>
                                )}

                                <p className="checkout-success-text">
                                    Save these six digits. On the tracking page,
                                    the MBO date prefix is filled in automatically.
                                </p>

                                <p className="checkout-order-number">
                                    Full reference: {successfulOrderNumber}
                                </p>
                            </div>
                        )}

                        <div className="checkout-success-summary">
                            <div>
                                <span>Order type</span>

                                <strong>
                                    {orderType === 'delivery'
                                        ? 'Delivery'
                                        : 'Collection'}
                                </strong>
                            </div>

                            <div>
                                <span>Payment</span>

                                <strong>
                                    {paymentMethod.toUpperCase()}
                                </strong>
                            </div>

                            <div>
                                <span>Total</span>

                                <strong>
                                    R{confirmedTotal.toFixed(2)}
                                </strong>
                            </div>
                        </div>

                        <button
                            className="checkout-success-button"
                            type="button"
                            onClick={() => {
                                window.location.assign('/');
                            }}
                        >
                            BACK TO HOME
                        </button>
                    </section>
                </main>
            </>
        );
    }

    // ======================================================
    // CHECKOUT PAGE
    // ======================================================

    return (
        <>
            <Header />

            <main className="checkout-page">
                <section className="checkout-header">
                    <p className="checkout-eyebrow">
                        ALMOST THERE
                    </p>

                    <h1>
                        COMPLETE YOUR <span>ORDER.</span>
                    </h1>

                    <p>
                        Fill in your details below and
                        we'll get your order ready.
                    </p>
                </section>

                <div className="checkout-layout">
                    {/* ORDER SUMMARY */}

                    <section className="checkout-summary">
                        <div className="checkout-card">
                            <div className="checkout-card-header">
                                <h2>YOUR ORDER</h2>

                                <span>
                                    {cart.reduce(
                                        (count, item) =>
                                            count +
                                            Number(item.quantity || 0),
                                        0
                                    )}{' '}
                                    items
                                </span>
                            </div>

                            {cart.length === 0 ? (
                                <div className="checkout-empty">
                                    <p>Your cart is empty.</p>

                                    <button
                                        type="button"
                                        onClick={handleReturnToMenu}
                                        disabled={
                                            placingOrder ||
                                            orderOutcomeUnknown
                                        }
                                    >
                                        BROWSE MENU
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {cartHasUnavailableItems && (
                                        <div
                                            className="checkout-submit-error"
                                            role="alert"
                                        >
                                            <strong>
                                                ITEMS UNAVAILABLE
                                            </strong>

                                            <p>
                                                Remove unavailable items
                                                before placing your order.
                                            </p>
                                        </div>
                                    )}

                                    <div className="checkout-items">
                                        {cart.map((item) => (
                                            <div
                                                className="checkout-item"
                                                key={item.id}
                                            >
                                                <div>
                                                    <strong>
                                                        {item.name}
                                                    </strong>

                                                    <span>
                                                        × {item.quantity}
                                                    </span>

                                                    {item.available === false && (
                                                        <p
                                                            className="checkout-error"
                                                            role="alert"
                                                        >
                                                            {item.unavailableReason ||
                                                                'This item is currently unavailable.'}
                                                        </p>
                                                    )}

                                                    {item.available === false && (
                                                        <button
                                                            type="button"
                                                            className="cart-remove"
                                                            onClick={() =>
                                                                handleRemoveItem(
                                                                    item.id
                                                                )
                                                            }
                                                            disabled={
                                                                orderDetailsLocked
                                                            }
                                                        >
                                                            REMOVE ITEM
                                                        </button>
                                                    )}
                                                </div>

                                                <strong>
                                                    R
                                                    {(
                                                        Number(item.price) *
                                                        Number(item.quantity)
                                                    ).toFixed(2)}
                                                </strong>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="checkout-totals">
                                        <div>
                                            <span>Subtotal</span>

                                            <strong>
                                                R{subtotal.toFixed(2)}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Delivery</span>

                                            <strong>
                                                {deliveryFee > 0
                                                    ? `R${deliveryFee.toFixed(2)}`
                                                    : 'FREE'}
                                            </strong>
                                        </div>

                                        <div className="checkout-total">
                                            <span>TOTAL</span>

                                            <strong>
                                                R{total.toFixed(2)}
                                            </strong>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {/* CHECKOUT FORM */}

                    <section className="checkout-form">
                        {/* CUSTOMER */}

                        <div className="checkout-card">
                            <div className="checkout-card-header">
                                <h2>1. YOUR DETAILS</h2>
                            </div>

                            <div className="checkout-fields">
                                <label>
                                    <span>FULL NAME</span>

                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={handleCustomerNameChange}
                                        maxLength={100}
                                        autoComplete="name"
                                        placeholder="Your full name"
                                        disabled={orderDetailsLocked}
                                    />
                                </label>

                                <label>
                                    <span>PHONE NUMBER</span>

                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        maxLength={10}
                                        autoComplete="tel"
                                        placeholder="e.g. 0821234567"
                                        disabled={orderDetailsLocked}
                                    />

                                    <small>
                                        {phone.length}/10 digits
                                    </small>
                                </label>
                            </div>
                        </div>

                        {/* FULFILMENT */}

                        <div className="checkout-card">
                            <div className="checkout-card-header">
                                <h2>2. FULFILMENT</h2>
                            </div>

                            <div className="checkout-choice-grid">
                                <button
                                    type="button"
                                    className={
                                        orderType === 'collection'
                                            ? 'checkout-choice active'
                                            : 'checkout-choice'
                                    }
                                    onClick={() =>
                                        handleOrderTypeChange('collection')
                                    }
                                    disabled={orderDetailsLocked}
                                >
                                    <strong>COLLECTION</strong>

                                    <span>Collect from Mbo’s</span>
                                </button>

                                <button
                                    type="button"
                                    className={
                                        orderType === 'delivery'
                                            ? 'checkout-choice active'
                                            : 'checkout-choice'
                                    }
                                    onClick={() =>
                                        handleOrderTypeChange('delivery')
                                    }
                                    disabled={orderDetailsLocked}
                                >
                                    <strong>DELIVERY</strong>

                                    <span>R100 delivery fee</span>
                                </button>
                            </div>

                            {orderType === 'delivery' && (
                                <div className="delivery-location">
                                    <div className="delivery-notice">
                                        <strong>
                                            📍 SHARE YOUR LOCATION
                                        </strong>

                                        <p>
                                            We only need your current GPS
                                            coordinates to help our driver
                                            locate you.
                                        </p>
                                    </div>

                                    <div className="delivery-location-row">
                                        <input
                                            type="text"
                                            value={deliveryLocation}
                                            placeholder="Location not shared yet"
                                            readOnly
                                        />

                                        <button
                                            type="button"
                                            onClick={handleShareLocation}
                                            disabled={
                                                locationLoading ||
                                                orderDetailsLocked
                                            }
                                        >
                                            {locationLoading
                                                ? 'LOCATING...'
                                                : 'SHARE LOCATION'}
                                        </button>
                                    </div>

                                    {locationError && (
                                        <p className="checkout-error">
                                            {locationError}
                                        </p>
                                    )}

                                    <small>
                                        Only your current coordinates at the
                                        moment you press the button are
                                        shared. No drop-off address is
                                        collected.
                                    </small>
                                </div>
                            )}
                        </div>

                        {/* PAYMENT */}

                        <div className="checkout-card">
                            <div className="checkout-card-header">
                                <h2>3. PAYMENT</h2>
                            </div>

                            <div className="checkout-choice-grid checkout-payment-grid">
                                <button
                                    type="button"
                                    className={
                                        paymentMethod === 'cash'
                                            ? 'checkout-choice active'
                                            : 'checkout-choice'
                                    }
                                    onClick={() =>
                                        setPaymentMethod('cash')
                                    }
                                    disabled={orderDetailsLocked}
                                >
                                    <strong>CASH</strong>

                                    <span>
                                        Pay when collecting/delivered
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className="checkout-choice checkout-choice-unavailable"
                                    disabled
                                    aria-disabled="true"
                                    title="EFT is temporarily unavailable"
                                >
                                    <strong>EFT</strong>

                                    <span>Bank transfer</span>
                                </button>

                                <button
                                    type="button"
                                    className={
                                        paymentMethod === 'card'
                                            ? 'checkout-choice active'
                                            : 'checkout-choice'
                                    }
                                    onClick={() =>
                                        setPaymentMethod('card')
                                    }
                                    disabled={orderDetailsLocked}
                                >
                                    <strong>CARD</strong>

                                    <span>Pay using Mbo’s card machine</span>
                                </button>
                            </div>
                        </div>

                        {/* NOTES */}

                        <div className="checkout-card">
                            <div className="checkout-card-header">
                                <h2>4. NOTES</h2>
                            </div>

                            <label className="checkout-notes">
                                <textarea
                                    value={notes}
                                    onChange={(event) =>
                                        setNotes(event.target.value)
                                    }
                                    maxLength={500}
                                    placeholder="Anything we should know about your order? (optional)"
                                    disabled={orderDetailsLocked}
                                />

                                <small>{notes.length}/500</small>
                            </label>
                        </div>

                        {/* ERROR */}

                        {orderError && (
                            <div
                                className="checkout-submit-error"
                                role="alert"
                                aria-live="assertive"
                            >
                                <strong>
                                    {orderOutcomeUnknown
                                        ? 'ORDER CONFIRMATION NEEDED'
                                        : 'ORDER FAILED'}
                                </strong>

                                <p>{orderError}</p>

                                {(
                                    orderErrorCode === 'PRICE_CHANGED' ||
                                    orderErrorCode === 'ITEM_UNAVAILABLE'
                                ) ? (
                                    <button
                                        type="button"
                                        className="checkout-success-button"
                                        onClick={handleReturnToMenu}
                                        disabled={placingOrder}
                                    >
                                        RETURN TO MENU
                                    </button>
                                ) : (
                                    <small>
                                        {orderRetryBlocked
                                            ? 'Do not submit a different order yet. Check your existing order or contact Mbo’s Tshisanyama to verify the previous attempt.'
                                            : orderOutcomeUnknown
                                                ? 'Keep the checkout unchanged while retrying. The same request identifier will be reused. If the problem continues, contact the restaurant before making another order.'
                                                : 'Check your details and connection, then try again.'}
                                    </small>
                                )}
                            </div>
                        )}

                        {/* PLACE ORDER */}

                        <div className="checkout-submit">
                            <button
                                type="button"
                                className="place-order-button"
                                disabled={
                                    !orderReady ||
                                    placingOrder ||
                                    orderRetryBlocked
                                }
                                onClick={handlePlaceOrder}
                            >
                                {placingOrder
                                    ? 'PLACING ORDER...'
                                    : orderRetryBlocked
                                        ? 'ORDER NEEDS VERIFICATION'
                                        : orderOutcomeUnknown
                                            ? 'RETRY SAME ORDER SAFELY'
                                            : `PLACE ORDER • R${total.toFixed(2)}`}
                            </button>

                            {!orderReady && cart.length > 0 && (
                                <p className="checkout-submit-hint">
                                    {cartHasUnavailableItems
                                        ? 'Remove unavailable items before placing your order.'
                                        : 'Complete all required details above to place your order.'}
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

export default Checkout;
