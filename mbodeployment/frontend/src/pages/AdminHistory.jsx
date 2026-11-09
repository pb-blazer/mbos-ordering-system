import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    getStaffSession,
    signOutStaff,
} from '../services/AdminAuthService';

import { getAdminOrder } from '../services/AdminOrderService';
import { getAdminOrderHistory } from '../services/AdminHistoryService';

import './AdminHistory.css';

const PAGE_SIZE = 25;

function formatMoney(value) {
    const amount = Number(value);

    return Number.isFinite(amount)
        ? `R${amount.toFixed(2)}`
        : 'R0.00';
}

function formatDateTime(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-ZA', {
        timeZone: 'Africa/Johannesburg',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function statusLabel(status) {
    return status === 'completed' ? 'COMPLETED' : 'CANCELLED';
}

function paymentLabel(value) {
    return String(value || '—').replaceAll('_', ' ').toUpperCase();
}

function orderTypeLabel(value) {
    return String(value || '—').replaceAll('_', ' ').toUpperCase();
}

function AdminHistory() {
    const [orders, setOrders] = useState([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pageError, setPageError] = useState('');

    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [searchInput, setSearchInput] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [page, setPage] = useState(0);

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [logoutLoading, setLogoutLoading] = useState(false);

    const loadHistory = useCallback(async ({ showLoader = true } = {}) => {
        if (showLoader) setLoading(true);
        setPageError('');

        try {
            const session = await getStaffSession();

            if (!session) {
                window.location.replace('/admin/login');
                return;
            }

            const response = await getAdminOrderHistory({
                status: statusFilter,
                orderType: typeFilter,
                search: appliedSearch,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });

            setOrders(Array.isArray(response?.orders) ? response.orders : []);
            setCount(Number(response?.count) || 0);
        } catch (error) {
            console.error('ADMIN ORDER HISTORY ERROR:', error);

            const message = error?.message || 'Unable to load order history.';

            if (
                message.toLowerCase().includes('session has expired') ||
                message.toLowerCase().includes('administrator access')
            ) {
                window.location.replace('/admin/login');
                return;
            }

            setPageError(message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter, typeFilter, appliedSearch, page]);

    useEffect(() => {
        let active = true;

        const run = async () => {
            if (!active) return;
            await loadHistory({ showLoader: true });
        };

        run();

        return () => {
            active = false;
        };
    }, [loadHistory]);

    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

    const pageRange = useMemo(() => {
        if (count === 0) return '0 orders';

        const first = page * PAGE_SIZE + 1;
        const last = Math.min((page + 1) * PAGE_SIZE, count);

        return `${first}–${last} of ${count} orders`;
    }, [count, page]);

    const applySearch = (event) => {
        event.preventDefault();
        setPage(0);
        setAppliedSearch(searchInput.trim());
    };

    const clearSearch = () => {
        setSearchInput('');
        setAppliedSearch('');
        setPage(0);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadHistory({ showLoader: false });
    };

    const handleOpenOrder = async (orderId) => {
        setSelectedOrder(null);
        setDetailError('');
        setDetailLoading(true);

        try {
            const response = await getAdminOrder(orderId);
            setSelectedOrder(response?.order || response || null);
        } catch (error) {
            console.error('ADMIN HISTORY ORDER DETAIL ERROR:', error);
            setDetailError(error?.message || 'Unable to load order details.');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleLogout = async () => {
        setLogoutLoading(true);

        try {
            await signOutStaff();
        } catch (error) {
            console.error('ADMIN HISTORY LOGOUT ERROR:', error);
        } finally {
            window.location.replace('/admin/login');
        }
    };

    const closeDetails = () => {
        setSelectedOrder(null);
        setDetailError('');
        setDetailLoading(false);
    };

    return (
        <main className="admin-history-page">
            <header className="admin-history-header">
                <a className="admin-history-brand" href="/admin" aria-label="Mbo's Tshisanyama admin dashboard">
                    <span className="admin-history-logo-wrap">
                        <img src="/mbos-logo.png" alt="" />
                    </span>
                    <span className="admin-history-brand-copy">
                        <strong>MBO’S</strong>
                        <small>ORDER HISTORY</small>
                    </span>
                </a>

                <nav className="admin-history-nav" aria-label="Admin navigation">
                    <a href="/admin">LIVE ORDERS</a>
                    <a href="/admin/menu">MANAGE MENU</a>
                    <a href="/admin/analytics">ANALYTICS</a>
                    <a href="/admin/payments">PAYMENTS</a>
                    <button type="button" onClick={handleLogout} disabled={logoutLoading}>
                        {logoutLoading ? 'LOGGING OUT…' : 'LOG OUT'}
                    </button>
                </nav>
            </header>

            <div className="admin-history-container">
                <section className="admin-history-heading">
                    <div>
                        <p className="admin-history-eyebrow">RECORDS &amp; OPERATIONS</p>
                        <h1>ORDER <span>HISTORY.</span></h1>
                        <p className="admin-history-description">
                            Review completed and cancelled orders without cluttering the live order queue.
                        </p>
                    </div>

                    <div className="admin-history-total">
                        <span>HISTORICAL ORDERS</span>
                        <strong>{count.toLocaleString('en-ZA')}</strong>
                    </div>
                </section>

                {pageError && (
                    <div className="admin-history-error" role="alert">
                        <span>{pageError}</span>
                        <button type="button" onClick={() => loadHistory()}>TRY AGAIN</button>
                    </div>
                )}

                <section className="admin-history-toolbar" aria-label="Order history filters">
                    <form className="admin-history-search" onSubmit={applySearch}>
                        <label htmlFor="history-search">SEARCH ORDER REFERENCE</label>
                        <div className="admin-history-search-row">
                            <input
                                id="history-search"
                                type="search"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                maxLength={60}
                                placeholder="e.g. MBO-261029-900564"
                            />
                            <button type="submit">SEARCH</button>
                            {appliedSearch && (
                                <button className="admin-history-clear" type="button" onClick={clearSearch}>
                                    CLEAR
                                </button>
                            )}
                        </div>
                    </form>

                    <div className="admin-history-filter">
                        <label htmlFor="history-status">ORDER STATUS</label>
                        <select
                            id="history-status"
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(event.target.value);
                                setPage(0);
                            }}
                        >
                            <option value="all">All history</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div className="admin-history-filter">
                        <label htmlFor="history-type">ORDER TYPE</label>
                        <select
                            id="history-type"
                            value={typeFilter}
                            onChange={(event) => {
                                setTypeFilter(event.target.value);
                                setPage(0);
                            }}
                        >
                            <option value="all">All types</option>
                            <option value="collection">Collection</option>
                            <option value="delivery">Delivery</option>
                        </select>
                    </div>

                    <button
                        className="admin-history-refresh"
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                    >
                        {refreshing ? 'REFRESHING…' : 'REFRESH'}
                    </button>
                </section>

                <section className="admin-history-results">
                    <div className="admin-history-results-heading">
                        <div>
                            <h2>HISTORICAL RECORDS</h2>
                            <p>{pageRange}</p>
                        </div>
                        <span>NEWEST FIRST</span>
                    </div>

                    {loading ? (
                        <div className="admin-history-state" aria-live="polite">
                            <span className="admin-history-spinner" />
                            <p>LOADING ORDER HISTORY…</p>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="admin-history-state">
                            <strong>NO MATCHING ORDERS</strong>
                            <p>Completed or cancelled orders matching these filters will appear here.</p>
                        </div>
                    ) : (
                        <div className="admin-history-table-wrap">
                            <table className="admin-history-table">
                                <thead>
                                    <tr>
                                        <th>ORDER REFERENCE</th>
                                        <th>CUSTOMER</th>
                                        <th>TYPE</th>
                                        <th>PAYMENT</th>
                                        <th>STATUS</th>
                                        <th>TOTAL</th>
                                        <th>DATE</th>
                                        <th><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((order) => (
                                        <tr key={order.order_id}>
                                            <td className="history-reference">{order.order_number || '—'}</td>
                                            <td>
                                                <strong>{order.customer?.name || 'Unknown customer'}</strong>
                                                <small>{order.customer?.phone || 'No phone supplied'}</small>
                                            </td>
                                            <td>{orderTypeLabel(order.order_type)}</td>
                                            <td>{paymentLabel(order.payment_method)}</td>
                                            <td>
                                                <span className={`history-status history-status-${order.status}`}>
                                                    {statusLabel(order.status)}
                                                </span>
                                            </td>
                                            <td className="history-total">{formatMoney(order.subtotal)}</td>
                                            <td>{formatDateTime(order.created_at)}</td>
                                            <td>
                                                <button
                                                    className="history-view-button"
                                                    type="button"
                                                    onClick={() => handleOpenOrder(order.order_id)}
                                                >
                                                    VIEW
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="admin-history-pagination">
                        <span>{pageRange}</span>
                        <div>
                            <button
                                type="button"
                                onClick={() => setPage((current) => Math.max(0, current - 1))}
                                disabled={page === 0 || loading}
                            >
                                PREVIOUS
                            </button>
                            <span>PAGE {page + 1} / {totalPages}</span>
                            <button
                                type="button"
                                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                                disabled={page >= totalPages - 1 || loading}
                            >
                                NEXT
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {(detailLoading || detailError || selectedOrder) && (
                <div className="admin-history-overlay" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) closeDetails();
                }}>
                    <section className="admin-history-drawer" role="dialog" aria-modal="true" aria-labelledby="history-detail-title">
                        <div className="admin-history-drawer-header">
                            <div>
                                <p>HISTORICAL ORDER</p>
                                <h2 id="history-detail-title">
                                    {selectedOrder?.order_number || 'ORDER DETAILS'}
                                </h2>
                            </div>
                            <button type="button" onClick={closeDetails} aria-label="Close order details">×</button>
                        </div>

                        {detailLoading ? (
                            <div className="admin-history-drawer-state">LOADING DETAILS…</div>
                        ) : detailError ? (
                            <div className="admin-history-drawer-error" role="alert">{detailError}</div>
                        ) : selectedOrder && (
                            <div className="admin-history-drawer-body">
                                <div className="history-detail-status-row">
                                    <span className={`history-status history-status-${selectedOrder.status}`}>
                                        {statusLabel(selectedOrder.status)}
                                    </span>
                                    <strong>{formatMoney(selectedOrder.subtotal)}</strong>
                                </div>

                                <div className="history-detail-grid">
                                    <div><small>CUSTOMER</small><strong>{selectedOrder.customer?.name || '—'}</strong></div>
                                    <div><small>PHONE</small><strong>{selectedOrder.customer?.phone || '—'}</strong></div>
                                    <div><small>ORDER TYPE</small><strong>{orderTypeLabel(selectedOrder.order_type)}</strong></div>
                                    <div><small>PAYMENT</small><strong>{paymentLabel(selectedOrder.payment_method)}</strong></div>
                                    <div><small>PLACED</small><strong>{formatDateTime(selectedOrder.created_at)}</strong></div>
                                    <div><small>LAST UPDATED</small><strong>{formatDateTime(selectedOrder.updated_at)}</strong></div>
                                </div>

                                <div className="history-detail-items">
                                    <h3>ORDER ITEMS</h3>
                                    {(selectedOrder.items || []).map((item, index) => (
                                        <div className="history-detail-item" key={`${item.menu_item_id || item.name}-${index}`}>
                                            <div>
                                                <strong>{item.name || 'Menu item'}</strong>
                                                <small>{item.quantity} × {formatMoney(item.price)}</small>
                                            </div>
                                            <strong>{formatMoney(item.line_total ?? Number(item.price) * Number(item.quantity))}</strong>
                                        </div>
                                    ))}
                                </div>

                                {selectedOrder.notes && (
                                    <div className="history-detail-notes">
                                        <h3>ORDER NOTES</h3>
                                        <p>{selectedOrder.notes}</p>
                                    </div>
                                )}

                                <p className="history-readonly-note">
                                    Historical orders are read-only. Status changes are managed from the live order dashboard.
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </main>
    );
}

export default AdminHistory;
