
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    getStaffSession,
    signOutStaff,
} from '../services/AdminAuthService';

import {
    getAdminOrder,
    getAdminOrders,
    updateAdminOrderStatus,
} from '../services/AdminOrderService';

import './Admin.css';


// ==========================================================
// ACTIVE ORDER STATUSES
// ==========================================================

const ACTIVE_STATUSES = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
];


// ==========================================================
// ORDER LIFECYCLE
// ==========================================================

const NEXT_STATUS = {
    pending: 'confirmed',
    confirmed: 'preparing',
    preparing: 'ready',
    ready: 'completed',
};


const NEXT_ACTION_LABEL = {
    pending: 'CONFIRM ORDER',
    confirmed: 'START PREPARING',
    preparing: 'MARK READY',
    ready: 'COMPLETE ORDER',
};


const STATUS_LABELS = {
    pending: 'NEW ORDER',
    confirmed: 'CONFIRMED',
    preparing: 'PREPARING',
    ready: 'READY',
};


// ==========================================================
// FORMATTING
// ==========================================================

function formatMoney(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return 'R0.00';
    }

    return `R${amount.toFixed(2)}`;
}


function formatDateTime(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleString(
        'en-ZA',
        {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }
    );
}


function formatPaymentMethod(value) {
    if (!value) {
        return '—';
    }

    return String(value)
        .replaceAll('_', ' ')
        .toUpperCase();
}


function formatOrderType(value) {
    if (!value) {
        return '—';
    }

    return String(value)
        .replaceAll('_', ' ')
        .toUpperCase();
}


function getOrderStatusLabel(status, orderType) {
    if (
        orderType === 'delivery' &&
        status === 'ready'
    ) {
        return 'OUT FOR DELIVERY';
    }

    if (
        orderType === 'collection' &&
        status === 'ready'
    ) {
        return 'READY FOR COLLECTION';
    }

    return (
        STATUS_LABELS[status] ||
        String(status || '')
            .replaceAll('_', ' ')
            .toUpperCase()
    );
}


// ==========================================================
// NORMALIZE ORDER LIST RESPONSE
// ==========================================================

function normalizeOrdersResponse(response) {
    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response?.orders)) {
        return response.orders;
    }

    return [];
}


// ==========================================================
// NORMALIZE SINGLE ORDER RESPONSE
// ==========================================================

function normalizeOrderResponse(response) {
    if (response?.order) {
        return response.order;
    }

    return response || null;
}


// ==========================================================
// ADMIN DASHBOARD
// ==========================================================

function Admin() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pageError, setPageError] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');

    const [updatingOrderId, setUpdatingOrderId] = useState(null);
    const [logoutLoading, setLogoutLoading] = useState(false);


    // ======================================================
    // LOAD ORDERS
    // ======================================================

    const loadOrders = useCallback(
        async (showLoader = true) => {
            if (showLoader) {
                setLoading(true);
            }

            setPageError('');

            try {
                const session = await getStaffSession();

                if (!session) {
                    window.location.href = '/admin/login';
                    return;
                }

                const response = await getAdminOrders({
                    limit: 100,
                    offset: 0,
                });

                const normalizedOrders =
                    normalizeOrdersResponse(response);

                setOrders(normalizedOrders);

            } catch (error) {
                console.error(
                    'ADMIN ORDERS LOAD ERROR:',
                    error
                );

                if (
                    error?.message
                        ?.toLowerCase()
                        ?.includes('session has expired') ||
                    error?.message
                        ?.toLowerCase()
                        ?.includes('authentication')
                ) {
                    window.location.href = '/admin/login';
                    return;
                }

                setPageError(
                    error?.message ||
                    'Unable to load orders.'
                );

            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        []
    );


    // ======================================================
    // INITIAL AUTH + LOAD
    // ======================================================

    useEffect(
        () => {
            let mounted = true;

            const initialize = async () => {
                try {
                    const session = await getStaffSession();

                    if (!session) {
                        window.location.href = '/admin/login';
                        return;
                    }

                    if (mounted) {
                        await loadOrders(true);
                    }

                } catch (error) {
                    console.error(
                        'ADMIN INITIALIZATION ERROR:',
                        error
                    );

                    if (mounted) {
                        window.location.href = '/admin/login';
                    }
                }
            };

            initialize();

            return () => {
                mounted = false;
            };
        },
        [loadOrders]
    );


    // ======================================================
    // AUTO REFRESH ORDERS
    // ======================================================

    useEffect(
        () => {
            const interval = setInterval(
                () => {
                    loadOrders(false);
                },
                3000
            );

            return () => {
                clearInterval(interval);
            };
        },
        [loadOrders]
    );


    // ======================================================
    // MANUAL REFRESH
    // ======================================================

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadOrders(false);
    };


    // ======================================================
    // FILTERED ORDERS
    // ======================================================

    const filteredOrders = useMemo(
        () => {
            if (activeFilter === 'all') {
                return orders;
            }

            return orders.filter(
                order => order.status === activeFilter
            );
        },
        [orders, activeFilter]
    );


    // ======================================================
    // DASHBOARD STATS
    // ======================================================

    const stats = useMemo(
        () => {
            const activeOrders = orders.filter(
                order => ACTIVE_STATUSES.includes(order.status)
            );

            const newOrders = orders.filter(
                order => order.status === 'pending'
            );

            const collectionOrders = activeOrders.filter(
                order => order.order_type === 'collection'
            );

            const deliveryOrders = activeOrders.filter(
                order => order.order_type === 'delivery'
            );

            return {
                active: activeOrders.length,
                new: newOrders.length,
                collection: collectionOrders.length,
                delivery: deliveryOrders.length,
            };
        },
        [orders]
    );


    // ======================================================
    // OPEN ORDER DETAILS
    // ======================================================

    const handleOpenOrder = async (orderId) => {
        const orderSummary = orders.find(
            order => String(order.order_id) === String(orderId)
        );

        if (
            orderSummary?.order_type === 'delivery' &&
            orderSummary?.status === 'pending'
        ) {
            setPageError(
                'Confirm this delivery from its order card before viewing details.'
            );
            return;
        }

        setSelectedOrderId(orderId);
        setSelectedOrder(null);
        setDetailError('');
        setDetailLoading(true);

        try {
            const response = await getAdminOrder(orderId);
            const order = normalizeOrderResponse(response);

            setSelectedOrder(order);

        } catch (error) {
            console.error(
                'ADMIN ORDER DETAIL ERROR:',
                error
            );

            setDetailError(
                error?.message ||
                'Unable to load order details.'
            );

        } finally {
            setDetailLoading(false);
        }
    };


    // ======================================================
    // CLOSE ORDER DETAILS
    // ======================================================

    const handleCloseOrder = () => {
        setSelectedOrderId(null);
        setSelectedOrder(null);
        setDetailError('');
    };


    // ======================================================
    // UPDATE ORDER STATUS
    // ======================================================

    const handleStatusUpdate = async (orderId, nextStatus) => {
        if (!orderId || !nextStatus) {
            return;
        }

        setUpdatingOrderId(orderId);
        setPageError('');

        try {
            const response = await updateAdminOrderStatus(
                orderId,
                nextStatus
            );

            const updated = normalizeOrderResponse(response);


            // UPDATE ORDER IN LIST

            setOrders(currentOrders =>
                currentOrders.map(order => {
                    if (order.order_id !== orderId) {
                        return order;
                    }

                    return {
                        ...order,
                        status: updated?.status || nextStatus,
                        updated_at:
                            updated?.updated_at ||
                            new Date().toISOString(),
                    };
                })
            );


            // REFRESH OPEN ORDER DETAILS

            if (String(selectedOrderId) === String(orderId)) {
                try {
                    const detailResponse = await getAdminOrder(orderId);

                    const refreshedOrder =
                        normalizeOrderResponse(detailResponse);

                    setSelectedOrder(refreshedOrder);
                    setDetailError('');

                } catch (detailRefreshError) {
                    console.error(
                        'ADMIN ORDER DETAIL REFRESH ERROR:',
                        detailRefreshError
                    );

                    setSelectedOrder(currentOrder => {
                        if (!currentOrder) {
                            return currentOrder;
                        }

                        return {
                            ...currentOrder,
                            status: updated?.status || nextStatus,
                            updated_at:
                                updated?.updated_at ||
                                new Date().toISOString(),

                            location: [
                                'completed',
                                'cancelled',
                            ].includes(updated?.status || nextStatus)
                                ? null
                                : currentOrder.location,
                        };
                    });

                    setDetailError(
                        'The order status was updated, but its details could not be refreshed. Close this panel and reopen the order.'
                    );
                }
            }


            // REFETCH ORDERS

            await loadOrders(false);

        } catch (error) {
            console.error(
                'ADMIN STATUS UPDATE ERROR:',
                error
            );

            setPageError(
                error?.message ||
                'Unable to update order status.'
            );

        } finally {
            setUpdatingOrderId(null);
        }
    };


    // ======================================================
    // LOG OUT
    // ======================================================

    const handleLogout = async () => {
        setLogoutLoading(true);

        try {
            await signOutStaff();

        } catch (error) {
            console.error(
                'STAFF LOGOUT ERROR:',
                error
            );

        } finally {
            window.location.href = '/admin/login';
        }
    };


    // ======================================================
    // DELIVERY LOCATION
    // ======================================================

    const openDeliveryLocation = (order) => {
        if (
            !order?.location ||
            order.location.latitude === undefined ||
            order.location.longitude === undefined
        ) {
            return;
        }

        const {
            latitude,
            longitude,
        } = order.location;

        const mapsUrl =
            `https://www.google.com/maps?q=${latitude},${longitude}`;

        window.open(
            mapsUrl,
            '_blank',
            'noopener,noreferrer'
        );
    };


    // ======================================================
    // LOADING STATE
    // ======================================================

    if (loading) {
        return (
            <main className="admin-page">
                <div className="admin-loading">
                    <div className="admin-loading-spinner"></div>

                    <p>
                        LOADING COMMAND CENTER...
                    </p>
                </div>
            </main>
        );
    }


    // ======================================================
    // RENDER
    // ======================================================

    return (
        <main className="admin-page">

            {/* ==================================================
                HEADER LAYOUT
            ================================================== */}

            <div className="admin-header-layout">

                {/* BRAND HEADER - STAYS STICKY ON MOBILE */}

                <header className="admin-header">

                    <div className="admin-brand-block">

                        <div className="admin-brand-lockup">

                            <div className="admin-logo-wrap">
                                <img
                                    src="/mbos-logo.png"
                                    alt="Mbo's Tshisanyama"
                                    className="admin-logo"
                                />
                            </div>

                            <div className="admin-brand-copy">

                                <span className="admin-brand">
                                    MBO’S
                                </span>

                                <span className="admin-brand-subtitle">
                                    STAFF COMMAND CENTER
                                </span>

                            </div>

                        </div>

                    </div>

                </header>


                {/* BUTTONS - SCROLL AWAY UNDER THE BRAND */}

                <div className="admin-header-actions">

                    <a
                        href="/admin/menu"
                        className="admin-menu-button"
                    >
                        MANAGE MENU
                    </a>

                    <a
                        href="/admin/history"
                        className="admin-menu-button"
                    >
                        ORDER HISTORY
                    </a>

                    <a
                        href="/admin/analytics"
                        className="admin-menu-button"
                    >
                        ANALYTICS
                    </a>

                    <a
                        href="/admin/payments"
                        className="admin-menu-button"
                    >
                        PAYMENTS
                    </a>

                    <button
                        type="button"
                        className="admin-refresh-button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        {refreshing
                            ? 'REFRESHING...'
                            : 'REFRESH'}
                    </button>

                    <button
                        type="button"
                        className="admin-logout-button"
                        onClick={handleLogout}
                        disabled={logoutLoading}
                    >
                        {logoutLoading
                            ? 'LOGGING OUT...'
                            : 'LOG OUT'}
                    </button>

                </div>

            </div>


            {/* ==================================================
                DASHBOARD CONTENT
            ================================================== */}

            <div className="admin-container">

                {/* PAGE HEADING */}

                <section className="admin-page-heading">

                    <div>

                        <p className="admin-eyebrow">
                            LIVE OPERATIONS
                        </p>

                        <h1>
                            ORDER{' '}
                            <span>
                                COMMAND.
                            </span>
                        </h1>

                        <p className="admin-heading-description">
                            Monitor incoming orders,
                            prepare them, and move each
                            order through the workflow.
                        </p>

                    </div>

                    <div className="admin-live-indicator">

                        <span className="admin-live-dot"></span>

                        LIVE

                    </div>

                </section>


                {/* ERROR */}

                {pageError && (
                    <div className="admin-error">
                        {pageError}
                    </div>
                )}


                {/* STATS */}

                <section className="admin-stats">

                    <div className="admin-stat-card">
                        <span className="admin-stat-label">
                            ACTIVE ORDERS
                        </span>

                        <strong className="admin-stat-value">
                            {stats.active}
                        </strong>
                    </div>

                    <div className="admin-stat-card">
                        <span className="admin-stat-label">
                            NEW ORDERS
                        </span>

                        <strong className="admin-stat-value">
                            {stats.new}
                        </strong>
                    </div>

                    <div className="admin-stat-card">
                        <span className="admin-stat-label">
                            COLLECTION
                        </span>

                        <strong className="admin-stat-value">
                            {stats.collection}
                        </strong>
                    </div>

                    <div className="admin-stat-card">
                        <span className="admin-stat-label">
                            DELIVERY
                        </span>

                        <strong className="admin-stat-value">
                            {stats.delivery}
                        </strong>
                    </div>

                </section>


                {/* FILTERS */}

                <section className="admin-filters">

                    {[
                        {
                            key: 'all',
                            label: 'ALL ACTIVE',
                        },
                        {
                            key: 'pending',
                            label: 'NEW',
                        },
                        {
                            key: 'confirmed',
                            label: 'CONFIRMED',
                        },
                        {
                            key: 'preparing',
                            label: 'PREPARING',
                        },
                        {
                            key: 'ready',
                            label: 'READY',
                        },
                    ].map(filter => (

                        <button
                            key={filter.key}
                            type="button"
                            className={
                                `admin-filter-button ${
                                    activeFilter === filter.key
                                        ? 'admin-filter-active'
                                        : ''
                                }`
                            }
                            onClick={() => setActiveFilter(filter.key)}
                        >
                            {filter.label}
                        </button>

                    ))}

                </section>


                {/* ORDER LIST */}

                <section className="admin-orders-section">

                    {filteredOrders.length === 0 ? (

                        <div className="admin-empty">

                            <div className="admin-empty-icon">
                                ✓
                            </div>

                            <p className="admin-eyebrow">
                                NOTHING HERE
                            </p>

                            <h2>
                                NO ACTIVE ORDERS
                            </h2>

                            <p>
                                New customer orders
                                will appear here
                                automatically.
                            </p>

                        </div>

                    ) : (

                        <div className="admin-order-grid">

                            {filteredOrders.map(order => {

                                const status = order.status;

                                const nextStatus =
                                    NEXT_STATUS[status];

                                const isUpdating =
                                    updatingOrderId === order.order_id;

                                const isPendingDelivery =
                                    order.order_type === 'delivery' &&
                                    status === 'pending';

                                return (
                                    <article
                                        key={order.order_id}
                                        className={
                                            `admin-order-card admin-order-status-${status}`
                                        }
                                    >

                                        {/* CARD HEADER */}

                                        <div className="admin-order-card-header">

                                            <div>

                                                <span className="admin-order-number">
                                                    ORDER #{order.order_id}
                                                </span>

                                                <span className="admin-order-date">
                                                    {formatDateTime(order.created_at)}
                                                </span>

                                            </div>

                                            <span
                                                className={
                                                    `admin-status-badge admin-status-${status}`
                                                }
                                            >
                                                {getOrderStatusLabel(
                                                    status,
                                                    order.order_type
                                                )}
                                            </span>

                                        </div>


                                        {/* CUSTOMER */}

                                        <div className="admin-order-card-body">

                                            <div className="admin-order-customer">

                                                <strong>
                                                    {order.customer?.name || 'Unknown customer'}
                                                </strong>

                                                <span>
                                                    {order.customer?.phone || 'No phone number'}
                                                </span>

                                            </div>


                                            <div className="admin-order-meta">

                                                <span>
                                                    {formatOrderType(order.order_type)}
                                                </span>

                                                <span>
                                                    {formatPaymentMethod(order.payment_method)}
                                                </span>

                                            </div>


                                            <div className="admin-order-total">

                                                <span>
                                                    ORDER TOTAL
                                                </span>

                                                <strong>
                                                    {formatMoney(
                                                        Number(order.subtotal) +
                                                        (
                                                            order.order_type === 'delivery'
                                                                ? 100
                                                                : 0
                                                        )
                                                    )}
                                                </strong>

                                            </div>

                                        </div>


                                        {/* CARD ACTIONS */}

                                        <div className="admin-order-card-footer">

                                            <button
                                                type="button"
                                                className="admin-view-order-button"
                                                onClick={() =>
                                                    handleOpenOrder(order.order_id)
                                                }
                                                disabled={
                                                    isPendingDelivery ||
                                                    isUpdating
                                                }
                                                title={
                                                    isPendingDelivery
                                                        ? 'Confirm this delivery before viewing its details.'
                                                        : 'View order details'
                                                }
                                                aria-label={
                                                    isPendingDelivery
                                                        ? `View details for order ${order.order_id} (confirm delivery first)`
                                                        : `View details for order ${order.order_id}`
                                                }
                                            >
                                                VIEW DETAILS
                                            </button>


                                            {nextStatus && (
                                                <button
                                                    type="button"
                                                    className="admin-status-action"
                                                    onClick={() =>
                                                        handleStatusUpdate(
                                                            order.order_id,
                                                            nextStatus
                                                        )
                                                    }
                                                    disabled={isUpdating}
                                                >
                                                    {isUpdating
                                                        ? 'UPDATING...'
                                                        : NEXT_ACTION_LABEL[status]}
                                                </button>
                                            )}

                                        </div>

                                    </article>
                                );
                            })}

                        </div>
                    )}

                </section>

            </div>


            {/* ==================================================
                ORDER DETAIL OVERLAY
            ================================================== */}

            {selectedOrderId && (

                <div className="admin-drawer-overlay">

                    <button
                        type="button"
                        className="admin-drawer-backdrop"
                        aria-label="Close order details"
                        onClick={handleCloseOrder}
                    ></button>


                    <aside className="admin-drawer">

                        {/* DRAWER HEADER */}

                        <header className="admin-drawer-header">

                            <div>

                                <p className="admin-eyebrow">
                                    ORDER DETAILS
                                </p>

                                <h2>
                                    ORDER #{selectedOrderId}
                                </h2>

                            </div>

                            <button
                                type="button"
                                className="admin-drawer-close"
                                onClick={handleCloseOrder}
                                aria-label="Close"
                            >
                                ×
                            </button>

                        </header>


                        {/* DETAIL LOADING */}

                        {detailLoading && (

                            <div className="admin-detail-loading">

                                <div className="admin-loading-spinner"></div>

                                <p>
                                    LOADING ORDER...
                                </p>

                            </div>

                        )}


                        {/* DETAIL ERROR */}

                        {detailError && (
                            <div className="admin-error">
                                {detailError}
                            </div>
                        )}


                        {/* ORDER DETAIL */}

                        {selectedOrder && !detailLoading && (

                            <div className="admin-detail-content">

                                {/* STATUS */}

                                <section className="admin-detail-section admin-detail-status-section">

                                    <span className="admin-detail-label">
                                        CURRENT STATUS
                                    </span>

                                    <span
                                        className={
                                            `admin-status-badge admin-status-${selectedOrder.status}`
                                        }
                                    >
                                        {getOrderStatusLabel(
                                            selectedOrder.status,
                                            selectedOrder.order_type
                                        )}
                                    </span>

                                </section>


                                {/* CUSTOMER */}

                                <section className="admin-detail-section">

                                    <p className="admin-detail-section-title">
                                        CUSTOMER
                                    </p>

                                    <div className="admin-detail-row">

                                        <span>
                                            NAME
                                        </span>

                                        <strong>
                                            {selectedOrder.customer?.name || '—'}
                                        </strong>

                                    </div>

                                    <div className="admin-detail-row">

                                        <span>
                                            PHONE
                                        </span>

                                        <a
                                            href={
                                                selectedOrder.customer?.phone
                                                    ? `tel:${selectedOrder.customer.phone}`
                                                    : undefined
                                            }
                                        >
                                            {selectedOrder.customer?.phone || '—'}
                                        </a>

                                    </div>

                                </section>


                                {/* ORDER INFORMATION */}

                                <section className="admin-detail-section">

                                    <p className="admin-detail-section-title">
                                        ORDER INFORMATION
                                    </p>

                                    <div className="admin-detail-row">

                                        <span>
                                            TYPE
                                        </span>

                                        <strong>
                                            {formatOrderType(selectedOrder.order_type)}
                                        </strong>

                                    </div>

                                    <div className="admin-detail-row">

                                        <span>
                                            PAYMENT
                                        </span>

                                        <strong>
                                            {formatPaymentMethod(selectedOrder.payment_method)}
                                        </strong>

                                    </div>

                                    <div className="admin-detail-row">

                                        <span>
                                            PLACED
                                        </span>

                                        <strong>
                                            {formatDateTime(selectedOrder.created_at)}
                                        </strong>

                                    </div>

                                </section>


                                {/* ITEMS */}

                                <section className="admin-detail-section">

                                    <p className="admin-detail-section-title">
                                        ORDER ITEMS
                                    </p>

                                    <div className="admin-detail-items">

                                        {(selectedOrder.items || []).map(item => (

                                            <div
                                                key={`${selectedOrder.order_id}-${item.menu_item_id}`}
                                                className="admin-detail-item"
                                            >

                                                <div>

                                                    <strong>
                                                        {item.name}
                                                    </strong>

                                                    <span>
                                                        ×{item.quantity}
                                                    </span>

                                                </div>

                                                <strong>
                                                    {formatMoney(Number(item.line_total))}
                                                </strong>

                                            </div>

                                        ))}

                                    </div>


                                    <div className="admin-detail-total-row">

                                        <span>
                                            SUBTOTAL
                                        </span>

                                        <strong>
                                            {formatMoney(selectedOrder.subtotal)}
                                        </strong>

                                    </div>


                                    {selectedOrder.order_type === 'delivery' && (

                                        <div className="admin-detail-total-row">

                                            <span>
                                                DELIVERY
                                            </span>

                                            <strong>
                                                R100.00
                                            </strong>

                                        </div>

                                    )}


                                    <div className="admin-detail-grand-total">

                                        <span>
                                            TOTAL
                                        </span>

                                        <strong>
                                            {formatMoney(
                                                Number(selectedOrder.subtotal) +
                                                (
                                                    selectedOrder.order_type === 'delivery'
                                                        ? 100
                                                        : 0
                                                )
                                            )}
                                        </strong>

                                    </div>

                                </section>


                                {/* NOTES */}

                                {selectedOrder.notes && (

                                    <section className="admin-detail-section">

                                        <p className="admin-detail-section-title">
                                            CUSTOMER NOTES
                                        </p>

                                        <div className="admin-detail-notes">
                                            {selectedOrder.notes}
                                        </div>

                                    </section>

                                )}


                                {/* DELIVERY LOCATION */}

                                {selectedOrder.order_type === 'delivery' &&
                                    selectedOrder.location && (

                                    <section className="admin-detail-section">

                                        <p className="admin-detail-section-title">
                                            DELIVERY LOCATION
                                        </p>

                                        <div className="admin-location-card">

                                            <div>

                                                <span>
                                                    LOCATION SHARED
                                                </span>

                                                <small>
                                                    {selectedOrder.location.latitude}
                                                    {', '}
                                                    {selectedOrder.location.longitude}
                                                </small>

                                            </div>

                                            <button
                                                type="button"
                                                className="admin-location-button"
                                                onClick={() =>
                                                    openDeliveryLocation(selectedOrder)
                                                }
                                            >
                                                OPEN MAP
                                            </button>

                                        </div>

                                    </section>

                                )}


                                {selectedOrder.order_type === 'delivery' &&
                                    !selectedOrder.location && (

                                    <section className="admin-detail-section">

                                        <p className="admin-detail-section-title">
                                            DELIVERY LOCATION
                                        </p>

                                        <div className="admin-location-hidden">
                                            Location becomes visible
                                            after the order is confirmed.
                                        </div>

                                    </section>

                                )}


                                {/* STATUS ACTION */}

                                {NEXT_STATUS[selectedOrder.status] && (

                                    <section className="admin-detail-section admin-detail-action-section">

                                        <button
                                            type="button"
                                            className="admin-detail-status-action"
                                            onClick={() =>
                                                handleStatusUpdate(
                                                    selectedOrder.order_id,
                                                    NEXT_STATUS[selectedOrder.status]
                                                )
                                            }
                                            disabled={
                                                updatingOrderId ===
                                                selectedOrder.order_id
                                            }
                                        >
                                            {updatingOrderId === selectedOrder.order_id
                                                ? 'UPDATING ORDER...'
                                                : NEXT_ACTION_LABEL[selectedOrder.status]}
                                        </button>

                                    </section>

                                )}

                            </div>

                        )}

                    </aside>

                </div>

            )}

        </main>
    );
}

export default Admin;
