import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { getOrderStatus } from '../services/OrderStatusService';

const COLLECTION_STAGES = [
    { key: 'pending', label: 'PENDING' },
    { key: 'confirmed', label: 'CONFIRMED' },
    { key: 'preparing', label: 'PREPARING' },
    { key: 'ready', label: 'READY FOR COLLECTION' },
];

const DELIVERY_STAGES = [
    { key: 'pending', label: 'PENDING' },
    { key: 'confirmed', label: 'CONFIRMED' },
    { key: 'preparing', label: 'PREPARING' },
    { key: 'ready', label: 'OUT FOR DELIVERY' },
];

const TERMINAL_STATUSES = ['completed', 'cancelled'];

function getSouthAfricanDateStamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Johannesburg',
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const part = (type) => parts.find((item) => item.type === type)?.value;
    return `${part('year')}${part('month')}${part('day')}`;
}

function OrderStatus() {
    const [dateStamp, setDateStamp] = useState(getSouthAfricanDateStamp);
    const [code, setCode] = useState('');
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searched, setSearched] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Keep the visible date prefix in sync with South African local time,
    // even if the page remains open across midnight.
    useEffect(() => {
        const interval = setInterval(() => {
            setDateStamp(getSouthAfricanDateStamp());
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const handleCodeChange = (event) => {
        const value = event.target.value.replace(/\D/g, '').slice(0, 6);
        setCode(value);
    };

    const lookupOrder = async () => {
        if (!/^\d{6}$/.test(code)) {
            setError('Enter the six-digit code shown after checkout.');
            setSearched(true);
            setOrder(null);
            setLastUpdated(null);
            return;
        }

        setLoading(true);
        setError('');
        setSearched(true);
        setOrder(null);
        setLastUpdated(null);

        try {
            const data = await getOrderStatus(code);
            setOrder(data?.order || null);
            setLastUpdated(data?.order ? new Date() : null);
        } catch (lookupError) {
            console.error('Order status lookup failed:', lookupError);
            setOrder(null);
            setError(
                lookupError.message ||
                    'Unable to check your order status. Please try again.'
            );
            setLastUpdated(null);
        } finally {
            setLoading(false);
        }
    };

    // Poll active orders. The same six-digit code is retained for retries;
    // the backend resolves the exact reference and handles day changes.
    useEffect(() => {
        if (
            !order ||
            !code ||
            TERMINAL_STATUSES.includes(order.status)
        ) {
            return undefined;
        }

        let cancelled = false;

        const refreshOrder = async () => {
            try {
                const data = await getOrderStatus(code);

                if (cancelled) {
                    return;
                }

                if (data?.order) {
                    setOrder(data.order);
                    setLastUpdated(new Date());
                    setError('');
                } else {
                    setOrder(null);
                    setLastUpdated(null);
                }
            } catch (refreshError) {
                // A temporary background failure should not erase the
                // latest confirmed order information.
                console.error('Live status refresh failed:', refreshError);
            }
        };

        const interval = setInterval(refreshOrder, 3000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [order?.order_id, order?.status, code]);

    const stages = useMemo(() => {
        return order?.order_type === 'delivery'
            ? DELIVERY_STAGES
            : COLLECTION_STAGES;
    }, [order?.order_type]);

    const currentStageIndex = useMemo(() => {
        if (!order || order.status === 'cancelled') {
            return -1;
        }

        if (order.status === 'completed') {
            return stages.length;
        }

        return stages.findIndex((stage) => stage.key === order.status);
    }, [order, stages]);

    const progressPercentage = useMemo(() => {
        if (!order || order.status === 'cancelled') {
            return 0;
        }

        if (order.status === 'completed') {
            return 100;
        }

        if (currentStageIndex <= 0) {
            return 0;
        }

        return (currentStageIndex / (stages.length - 1)) * 100;
    }, [order, currentStageIndex, stages]);

    const deliveryFee = order?.order_type === 'delivery' ? 100 : 0;
    const subtotal = order ? Number(order.subtotal) : 0;
    const total = subtotal + deliveryFee;

    const statusLabel = useMemo(() => {
        if (!order) {
            return '';
        }

        if (order.status === 'completed') {
            return order.order_type === 'delivery'
                ? 'DELIVERED'
                : 'COLLECTED';
        }

        if (order.status === 'cancelled') {
            return 'CANCELLED';
        }

        if (order.order_type === 'delivery' && order.status === 'ready') {
            return 'OUT FOR DELIVERY';
        }

        if (order.order_type === 'collection' && order.status === 'ready') {
            return 'READY FOR COLLECTION';
        }

        return String(order.status || '')
            .replace(/_/g, ' ')
            .toUpperCase();
    }, [order]);

    const resetTracker = () => {
        setCode('');
        setOrder(null);
        setError('');
        setSearched(false);
        setLastUpdated(null);
    };

    return (
        <>
            <Header />

            <main className="order-status-page">
                <section className="order-status-container">
                    <header className="order-status-header">
                        <p className="order-status-eyebrow">
                            MBO’S TSHISANYAMA
                        </p>

                        <h1>
                            TRACK YOUR <span>ORDER.</span>
                        </h1>

                        <p>
                            Enter the six-digit code shown after checkout.
                            The date prefix is filled in automatically using
                            South African local time.
                        </p>
                    </header>

                    {!searched && (
                        <section className="order-status-search">
                            <div className="order-status-card">
                                <div className="order-status-card-header">
                                    <div>
                                        <p>ORDER TRACKING</p>
                                        <h2>FIND YOUR ORDER</h2>
                                    </div>
                                    <span>01</span>
                                </div>

                                <label className="order-status-field">
                                    <span>ORDER REFERENCE</span>

                                    <div className="order-status-reference-input">
                                        <span
                                            className="order-status-reference-prefix"
                                            aria-label={`Order prefix MBO-${dateStamp}-`}
                                        >
                                            MBO-{dateStamp}-
                                        </span>

                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]{6}"
                                            value={code}
                                            onChange={handleCodeChange}
                                            maxLength={6}
                                            autoComplete="one-time-code"
                                            placeholder="123456"
                                            aria-label="Six-digit order code"
                                        />
                                    </div>

                                    <small>
                                        Enter only the last 6 digits.
                                    </small>
                                </label>

                                {error && (
                                    <p className="order-status-error" role="alert">
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="button"
                                    className="order-status-search-button"
                                    onClick={lookupOrder}
                                    disabled={loading}
                                >
                                    {loading ? 'CHECKING...' : 'TRACK MY ORDER'}
                                </button>
                            </div>
                        </section>
                    )}

                    {searched && !loading && !order && error && (
                        <section className="order-status-empty">
                            <div className="order-status-empty-icon">!</div>
                            <p className="order-status-eyebrow">ORDER TRACKING</p>
                            <h2>WE COULDN’T CHECK YOUR ORDER</h2>
                            <p>{error}</p>

                            <button
                                type="button"
                                className="order-status-secondary-button"
                                onClick={resetTracker}
                            >
                                TRY AGAIN
                            </button>
                        </section>
                    )}

                    {searched && !loading && !order && !error && (
                        <section className="order-status-empty">
                            <div className="order-status-empty-icon">×</div>
                            <p className="order-status-eyebrow">ORDER TRACKING</p>
                            <h2>NO ORDER FOUND</h2>
                            <p>
                                We couldn’t find an order for those six digits.
                                Check the code shown after checkout and try again.
                            </p>

                            <button
                                type="button"
                                className="order-status-secondary-button"
                                onClick={resetTracker}
                            >
                                TRY AGAIN
                            </button>
                        </section>
                    )}

                    {loading && searched && (
                        <section className="order-status-loading">
                            <div className="order-status-loader" />
                            <p>CHECKING YOUR ORDER...</p>
                        </section>
                    )}

                    {order && (
                        <section className="order-status-dashboard">
                            <div className="order-live-status">
                                <div>
                                    <p>CURRENT STATUS</p>
                                    <h2>{statusLabel}</h2>
                                </div>

                                {!TERMINAL_STATUSES.includes(order.status) && (
                                    <span className="order-live-dot">LIVE</span>
                                )}
                            </div>

                            {order.status === 'cancelled' && (
                                <div className="order-status-error" role="status">
                                    This order has been cancelled. Contact Mbo’s
                                    Tshisanyama if you need assistance.
                                </div>
                            )}

                            {order.status === 'completed' && (
                                <div className="order-status-completed" role="status">
                                    This order has been completed. Thank you for
                                    ordering from Mbo’s Tshisanyama.
                                </div>
                            )}

                            <div className="order-progress-card">
                                <div className="order-progress-top">
                                    <div>
                                        <p>ORDER REFERENCE</p>
                                        <h2>{order.order_number}</h2>
                                    </div>

                                    <span>
                                        {order.order_type === 'delivery'
                                            ? 'DELIVERY'
                                            : 'COLLECTION'}
                                    </span>
                                </div>

                                {order.status !== 'cancelled' && (
                                    <div className="order-progress">
                                        <div className="order-progress-track">
                                            <div
                                                className="order-progress-fill"
                                                style={{
                                                    width: `${progressPercentage}%`,
                                                }}
                                            />
                                        </div>

                                        <div className="order-progress-stages">
                                            {stages.map((stage, index) => {
                                                const completed =
                                                    index < currentStageIndex;
                                                const active =
                                                    index === currentStageIndex;

                                                return (
                                                    <div
                                                        className={
                                                            completed
                                                                ? 'order-stage completed'
                                                                : active
                                                                    ? 'order-stage active'
                                                                    : 'order-stage'
                                                        }
                                                        key={stage.key}
                                                    >
                                                        <div className="order-stage-dot">
                                                            {completed ? '✓' : index + 1}
                                                        </div>
                                                        <span>{stage.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="order-status-grid">
                                <section className="order-details-card">
                                    <div className="order-status-card-header">
                                        <div>
                                            <p>ORDER DETAILS</p>
                                            <h2>WHAT YOU ORDERED</h2>
                                        </div>
                                    </div>

                                    <div className="order-status-items">
                                        {(order.items || []).map((item, index) => (
                                            <div
                                                className="order-status-item"
                                                key={
                                                    item.menu_item_id ??
                                                    `${item.name}-${index}`
                                                }
                                            >
                                                <div>
                                                    <strong>{item.name}</strong>
                                                    <span>× {item.quantity}</span>
                                                </div>

                                                <strong>
                                                    R{Number(item.line_total).toFixed(2)}
                                                </strong>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="order-status-totals">
                                        <div>
                                            <span>SUBTOTAL</span>
                                            <strong>R{subtotal.toFixed(2)}</strong>
                                        </div>

                                        <div>
                                            <span>DELIVERY</span>
                                            <strong>
                                                {deliveryFee > 0
                                                    ? `R${deliveryFee.toFixed(2)}`
                                                    : 'FREE'}
                                            </strong>
                                        </div>

                                        <div className="order-status-total">
                                            <span>TOTAL</span>
                                            <strong>R{total.toFixed(2)}</strong>
                                        </div>
                                    </div>
                                </section>

                                <section className="order-details-card">
                                    <div className="order-status-card-header">
                                        <div>
                                            <p>ORDER INFORMATION</p>
                                            <h2>YOUR REFERENCE</h2>
                                        </div>
                                    </div>

                                    <div className="order-info-list">
                                        <div>
                                            <span>ORDER REFERENCE</span>
                                            <strong>{order.order_number}</strong>
                                        </div>

                                        <div>
                                            <span>TYPE</span>
                                            <strong>
                                                {order.order_type === 'delivery'
                                                    ? 'DELIVERY'
                                                    : 'COLLECTION'}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>PAYMENT METHOD</span>
                                            <strong>
                                                {String(order.payment_method || '').toUpperCase()}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>PLACED</span>
                                            <strong>
                                                {order.created_at
                                                    ? new Date(order.created_at).toLocaleString()
                                                    : '—'}
                                            </strong>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="order-status-footer">
                                <span>
                                    {TERMINAL_STATUSES.includes(order.status)
                                        ? 'ORDER STATUS FINAL'
                                        : 'LIVE UPDATES ENABLED'}
                                </span>

                                {lastUpdated && (
                                    <span>
                                        Updated {lastUpdated.toLocaleTimeString()}
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                className="order-status-secondary-button"
                                onClick={resetTracker}
                            >
                                TRACK ANOTHER ORDER
                            </button>
                        </section>
                    )}
                </section>
            </main>
        </>
    );
}

export default OrderStatus;
