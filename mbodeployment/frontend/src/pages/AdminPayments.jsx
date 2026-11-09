import { useCallback, useEffect, useMemo, useState } from 'react';

import { signOutStaff } from '../services/AdminAuthService';
import {
    getAdminPayments,
    getAdminOrderPaymentEvents,
    updateAdminOrderPayment,
} from '../services/AdminPaymentsService';

import './AdminPayments.css';

const PAGE_SIZE = 25;
const PAYMENT_STATUSES = ['unverified', 'paid', 'failed', 'refunded'];

function getSouthAfricanDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Johannesburg',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const part = (type) => parts.find((item) => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

function getInitialRange() {
    const to = getSouthAfricanDateString();
    const fromDate = new Date(`${to}T12:00:00.000Z`);
    fromDate.setUTCDate(fromDate.getUTCDate() - 29);

    return {
        from: fromDate.toISOString().slice(0, 10),
        to,
    };
}

function formatMoney(value) {
    const amount = Number(value);

    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
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

function label(value) {
    return String(value || '—').replaceAll('_', ' ').toUpperCase();
}

function getAllowedTransitions(status) {
    const transitions = {
        unverified: ['unverified', 'paid', 'failed'],
        failed: ['failed', 'paid', 'unverified'],
        paid: ['paid', 'refunded'],
        refunded: ['refunded'],
    };

    return transitions[status] || ['unverified'];
}

function validateRange(from, to) {
    const validDate = (value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
            return false;
        }

        const parsed = new Date(`${value}T00:00:00.000Z`);

        return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === value
        );
    };

    if (!validDate(from) || !validDate(to)) {
        return 'Choose valid start and end dates.';
    }

    const days = Math.floor(
        (
            Date.parse(`${to}T00:00:00.000Z`) -
            Date.parse(`${from}T00:00:00.000Z`)
        ) / 86400000
    ) + 1;

    if (days < 1) {
        return 'The start date must be on or before the end date.';
    }

    if (days > 366) {
        return 'Choose a date range of 366 days or fewer.';
    }

    return '';
}

function AdminPayments() {
    const initialRange = useMemo(() => getInitialRange(), []);

    const [fromDate, setFromDate] = useState(initialRange.from);
    const [toDate, setToDate] = useState(initialRange.to);

    const [appliedFilters, setAppliedFilters] = useState({
        ...initialRange,
        payment_status: 'all',
        payment_method: 'all',
        order_type: 'all',
        search: '',
    });

    const [searchInput, setSearchInput] = useState('');
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState(null);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(0);
    const [viewMode, setViewMode] = useState('grid');

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pageError, setPageError] = useState('');
    const [filterError, setFilterError] = useState('');
    const [logoutLoading, setLogoutLoading] = useState(false);

    const [selectedPayment, setSelectedPayment] = useState(null);
    const [paymentEvents, setPaymentEvents] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [saveMessage, setSaveMessage] = useState('');
    const [editStatus, setEditStatus] = useState('unverified');
    const [editReference, setEditReference] = useState('');
    const [editNote, setEditNote] = useState('');

    // LOAD PAYMENT RECORDS

    const loadPayments = useCallback(
        async ({ showLoader = true } = {}) => {
            if (showLoader) setLoading(true);

            setPageError('');

            try {
                const response = await getAdminPayments({
                    ...appliedFilters,
                    limit: PAGE_SIZE,
                    offset: page * PAGE_SIZE,
                });

                setPayments(
                    Array.isArray(response?.payments)
                        ? response.payments
                        : []
                );

                setSummary(response?.summary || null);
                setCount(Number(response?.count) || 0);
            } catch (error) {
                console.error('ADMIN PAYMENT RECONCILIATION ERROR:', error);

                const message =
                    error?.message ||
                    'Unable to load payment records.';

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
        },
        [appliedFilters, page]
    );

    useEffect(() => {
        loadPayments();
    }, [loadPayments]);

    // PAYMENT CARD SCROLL REVEAL

    useEffect(() => {
        if (
            viewMode !== 'grid' ||
            loading ||
            payments.length === 0
        ) {
            return undefined;
        }

        const cards = document.querySelectorAll(
            '.admin-payments-grid [data-payment-reveal="true"]'
        );

        if (cards.length === 0) return undefined;

        const prefersReducedMotion = window.matchMedia?.(
            '(prefers-reduced-motion: reduce)'
        )?.matches ?? false;

        if (
            prefersReducedMotion ||
            !('IntersectionObserver' in window)
        ) {
            cards.forEach((card) => card.classList.add('is-visible'));
            return undefined;
        }

        const observer = new IntersectionObserver(
            (entries, currentObserver) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        currentObserver.unobserve(entry.target);
                    }
                });
            },
            {
                root: null,
                rootMargin: '0px 0px -48px 0px',
                threshold: 0.12,
            }
        );

        cards.forEach((card, index) => {
            card.style.setProperty('--reveal-order', String(index % 6));
            observer.observe(card);
        });

        return () => observer.disconnect();
    }, [payments, viewMode, loading]);

    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

    // FILTERS

    const handleApplyFilters = (event) => {
        event.preventDefault();

        const validation = validateRange(fromDate, toDate);

        if (validation) {
            setFilterError(validation);
            return;
        }

        setFilterError('');
        setPage(0);

        setAppliedFilters((current) => ({
            ...current,
            from: fromDate,
            to: toDate,
        }));
    };

    const applySearch = (event) => {
        event.preventDefault();

        setPage(0);

        setAppliedFilters((current) => ({
            ...current,
            search: searchInput.trim(),
        }));
    };

    const updateFilter = (key, value) => {
        setPage(0);

        setAppliedFilters((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const handleRefresh = async () => {
        if (refreshing) return;

        setRefreshing(true);

        await loadPayments({
            showLoader: false,
        });
    };

    // PAYMENT DETAILS

    const openPayment = async (payment) => {
        setSelectedPayment(payment);

        setEditStatus(payment.payment_status || 'unverified');
        setEditReference(payment.payment_reference || '');
        setEditNote(payment.payment_note || '');

        setPaymentEvents([]);
        setDetailError('');
        setSaveMessage('');
        setDetailLoading(true);

        try {
            const response = await getAdminOrderPaymentEvents(
                payment.order_id
            );

            setPaymentEvents(
                Array.isArray(response?.events)
                    ? response.events
                    : []
            );
        } catch (error) {
            console.error('PAYMENT EVENT FETCH ERROR:', error);

            setDetailError(
                error?.message ||
                'Could not load payment activity.'
            );
        } finally {
            setDetailLoading(false);
        }
    };

    const closePayment = () => {
        if (saveLoading) return;

        setSelectedPayment(null);
        setPaymentEvents([]);
        setDetailError('');
        setSaveMessage('');
    };

    // SAVE PAYMENT

    const savePayment = async (event) => {
        event.preventDefault();

        if (!selectedPayment) return;

        if (
            editStatus === 'paid' &&
            selectedPayment.order_status === 'cancelled'
        ) {
            setDetailError(
                'Cancelled orders cannot be marked as paid. Review the refund process instead.'
            );
            return;
        }

        const statusChanged =
            editStatus !== selectedPayment.payment_status;

        if (statusChanged) {
            const confirmed = window.confirm(
                `Confirm payment status change to ${label(editStatus)} for ${selectedPayment.order_number}?`
            );

            if (!confirmed) return;
        }

        setSaveLoading(true);
        setDetailError('');
        setSaveMessage('');

        try {
            const response = await updateAdminOrderPayment(
                selectedPayment.order_id,
                {
                    payment_status: editStatus,
                    payment_reference: editReference.trim(),
                    payment_note: editNote.trim(),
                }
            );

            setSaveMessage(
                response?.message ||
                'Payment record updated.'
            );

            await loadPayments({ showLoader: false });

            const refreshed = await getAdminOrderPaymentEvents(
                selectedPayment.order_id
            );

            setPaymentEvents(
                Array.isArray(refreshed?.events)
                    ? refreshed.events
                    : []
            );

            setSelectedPayment((current) =>
                current
                    ? {
                        ...current,
                        payment_status:
                            response?.payment?.payment_status ||
                            editStatus,
                        payment_reference:
                            response?.payment?.payment_reference ??
                            (editReference.trim() || null),
                        payment_note:
                            response?.payment?.payment_note ??
                            (editNote.trim() || null),
                        paid_at:
                            response?.payment?.paid_at ||
                            current.paid_at,
                        payment_updated_at:
                            response?.payment?.payment_updated_at ||
                            new Date().toISOString(),
                    }
                    : current
            );
        } catch (error) {
            console.error('PAYMENT RECORD UPDATE ERROR:', error);

            setDetailError(
                error?.message ||
                'Unable to update payment record.'
            );
        } finally {
            setSaveLoading(false);
        }
    };

    // ADMIN LOGOUT

    const handleLogout = async () => {
        setLogoutLoading(true);

        try {
            await signOutStaff();
        } catch (error) {
            console.error('ADMIN PAYMENT LOGOUT ERROR:', error);
        } finally {
            window.location.replace('/admin/login');
        }
    };

    // DERIVED VALUES

    const rangeLabel =
        `${appliedFilters.from} – ${appliedFilters.to}`;

    const summaryStatus = summary || {};

    const allowedTransitions = selectedPayment
        ? getAllowedTransitions(
            selectedPayment.payment_status || 'unverified'
        )
        : PAYMENT_STATUSES;

    // RENDER

    return (
        <main className="admin-payments-page">

            {/* STICKY BRAND + SCROLLING NAVIGATION */}

            <div className="admin-payments-header-layout">
                <header className="admin-payments-header">
                    <a
                        className="admin-payments-brand"
                        href="/admin"
                        aria-label="Mbo's Tshisanyama admin dashboard"
                    >
                        <span className="admin-payments-logo-wrap">
                            <img src="/mbos-logo.png" alt="" />
                        </span>

                        <span className="admin-payments-brand-copy">
                            <strong>MBO’S</strong>
                            <small>PAYMENT RECONCILIATION</small>
                        </span>
                    </a>
                </header>

                <nav
                    className="admin-payments-nav"
                    aria-label="Admin navigation"
                >
                    <a href="/admin">LIVE ORDERS</a>
                    <a href="/admin/menu">MANAGE MENU</a>
                    <a href="/admin/history">ORDER HISTORY</a>
                    <a href="/admin/analytics">ANALYTICS</a>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                    >
                        {refreshing ? 'REFRESHING…' : 'REFRESH'}
                    </button>

                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={logoutLoading}
                    >
                        {logoutLoading ? 'LOGGING OUT…' : 'LOG OUT'}
                    </button>
                </nav>
            </div>

            <div className="admin-payments-container">

                {/* PAGE HEADING */}

                <section className="admin-payments-heading">
                    <div>
                        <p className="admin-payments-eyebrow">
                            FINANCIAL OPERATIONS
                        </p>

                        <h1>
                            PAYMENT <span>RECONCILIATION.</span>
                        </h1>

                        <p className="admin-payments-description">
                            Record verified payments separately from
                            food preparation and order completion.
                            Every update is timestamped and added to
                            the payment activity log.
                        </p>
                    </div>

                    <div className="admin-payments-period">
                        <span>SELECTED ORDER PERIOD</span>
                        <strong>{rangeLabel}</strong>
                    </div>
                </section>

                {/* ACCOUNTING NOTICE */}

                <div className="admin-payments-accounting-note">
                    <strong>IMPORTANT:</strong>{' '}
                    Orders are never assumed paid automatically.
                    Historical records start as <b>UNVERIFIED</b>{' '}
                    until staff confirm the payment.
                    Figures below show order value by payment status,
                    not bank settlement totals.
                </div>

                {/* ERROR MESSAGE */}

                {pageError && (
                    <div className="admin-payments-error" role="alert">
                        <span>{pageError}</span>

                        <button
                            type="button"
                            onClick={() => loadPayments()}
                        >
                            TRY AGAIN
                        </button>
                    </div>
                )}

                {/* PAYMENT SUMMARY */}

                <section
                    className="admin-payments-summary"
                    aria-label="Payment summary for selected period"
                >
                    <article className="admin-payments-summary-card paid">
                        <span>MARKED PAID</span>
                        <strong>
                            {formatMoney(summaryStatus.paid?.value)}
                        </strong>
                        <small>
                            {Number(summaryStatus.paid?.count || 0)
                                .toLocaleString('en-ZA')} orders
                        </small>
                    </article>

                    <article className="admin-payments-summary-card unverified">
                        <span>NEEDS VERIFICATION</span>
                        <strong>
                            {Number(summaryStatus.unverified?.count || 0)
                                .toLocaleString('en-ZA')}
                        </strong>
                        <small>
                            {formatMoney(summaryStatus.unverified?.value)}
                            {' '}order value
                        </small>
                    </article>

                    <article className="admin-payments-summary-card failed">
                        <span>FAILED</span>
                        <strong>
                            {Number(summaryStatus.failed?.count || 0)
                                .toLocaleString('en-ZA')}
                        </strong>
                        <small>
                            {formatMoney(summaryStatus.failed?.value)}
                            {' '}order value
                        </small>
                    </article>

                    <article className="admin-payments-summary-card refunded">
                        <span>MARKED REFUNDED</span>
                        <strong>
                            {Number(summaryStatus.refunded?.count || 0)
                                .toLocaleString('en-ZA')}
                        </strong>
                        <small>
                            {formatMoney(summaryStatus.refunded?.value)}
                            {' '}original order value
                        </small>
                    </article>
                </section>

                {/* DATE FILTERS */}

                <form
                    className="admin-payments-filter-panel"
                    onSubmit={handleApplyFilters}
                >
                    <div className="admin-payments-date-field">
                        <label htmlFor="payments-from">FROM</label>
                        <input
                            id="payments-from"
                            type="date"
                            value={fromDate}
                            max={toDate || undefined}
                            onChange={(event) => setFromDate(event.target.value)}
                        />
                    </div>

                    <div className="admin-payments-date-field">
                        <label htmlFor="payments-to">TO</label>
                        <input
                            id="payments-to"
                            type="date"
                            value={toDate}
                            min={fromDate || undefined}
                            onChange={(event) => setToDate(event.target.value)}
                        />
                    </div>

                    <button className="admin-payments-apply" type="submit">
                        APPLY DATES
                    </button>

                    <button
                        className="admin-payments-refresh"
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        {refreshing ? 'REFRESHING…' : 'REFRESH'}
                    </button>

                    {filterError && (
                        <p className="admin-payments-filter-error">
                            {filterError}
                        </p>
                    )}
                </form>

                {/* PAYMENT REGISTER */}

                <section className="admin-payments-workspace">
                    <div className="admin-payments-workspace-heading">
                        <div>
                            <p className="admin-payments-eyebrow">
                                ORDER PAYMENT REGISTER
                            </p>
                            <h2>PAYMENT RECORDS</h2>
                        </div>

                        <div className="admin-payments-workspace-actions">
                            <span>
                                {count.toLocaleString('en-ZA')} matching orders
                            </span>

                            <div
                                className="admin-payments-view-toggle"
                                role="group"
                                aria-label="Payment record layout"
                            >
                                <button
                                    type="button"
                                    className={viewMode === 'grid' ? 'active' : ''}
                                    aria-pressed={viewMode === 'grid'}
                                    onClick={() => setViewMode('grid')}
                                >
                                    <span aria-hidden="true">▦</span>
                                    GRID VIEW
                                </button>

                                <button
                                    type="button"
                                    className={viewMode === 'list' ? 'active' : ''}
                                    aria-pressed={viewMode === 'list'}
                                    onClick={() => setViewMode('list')}
                                >
                                    <span aria-hidden="true">☷</span>
                                    LIST VIEW
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SEARCH AND FILTER CONTROLS */}

                    <div className="admin-payments-controls">
                        <form
                            className="admin-payments-search"
                            onSubmit={applySearch}
                        >
                            <label htmlFor="payment-search">
                                SEARCH ORDER REFERENCE
                            </label>

                            <div>
                                <input
                                    id="payment-search"
                                    type="search"
                                    value={searchInput}
                                    onChange={(event) =>
                                        setSearchInput(event.target.value)
                                    }
                                    maxLength={60}
                                    placeholder="e.g. MBO-261029-900564"
                                />
                                <button type="submit">SEARCH</button>
                            </div>
                        </form>

                        <div className="admin-payments-select">
                            <label htmlFor="payment-status-filter">
                                PAYMENT STATUS
                            </label>
                            <select
                                id="payment-status-filter"
                                value={appliedFilters.payment_status}
                                onChange={(event) =>
                                    updateFilter('payment_status', event.target.value)
                                }
                            >
                                <option value="all">ALL STATUSES</option>
                                <option value="unverified">UNVERIFIED</option>
                                <option value="paid">PAID</option>
                                <option value="failed">FAILED</option>
                                <option value="refunded">REFUNDED</option>
                            </select>
                        </div>

                        <div className="admin-payments-select">
                            <label htmlFor="payment-method-filter">METHOD</label>
                            <select
                                id="payment-method-filter"
                                value={appliedFilters.payment_method}
                                onChange={(event) =>
                                    updateFilter('payment_method', event.target.value)
                                }
                            >
                                <option value="all">ALL METHODS</option>
                                <option value="cash">CASH</option>
                                <option value="eft">EFT</option>
                                <option value="card">CARD</option>
                            </select>
                        </div>

                        <div className="admin-payments-select">
                            <label htmlFor="payment-type-filter">ORDER TYPE</label>
                            <select
                                id="payment-type-filter"
                                value={appliedFilters.order_type}
                                onChange={(event) =>
                                    updateFilter('order_type', event.target.value)
                                }
                            >
                                <option value="all">ALL TYPES</option>
                                <option value="collection">COLLECTION</option>
                                <option value="delivery">DELIVERY</option>
                            </select>
                        </div>
                    </div>

                    {/* GRID VIEW */}

                    {viewMode === 'grid' ? (
                        <div className="admin-payments-grid" aria-live="polite">
                            {loading ? (
                                <div className="admin-payments-grid-message">
                                    LOADING PAYMENT RECORDS…
                                </div>
                            ) : payments.length === 0 ? (
                                <div className="admin-payments-grid-message">
                                    NO PAYMENT RECORDS MATCH THESE FILTERS.
                                </div>
                            ) : (
                                payments.map((payment) => (
                                    <article
                                        className="admin-payment-card admin-payment-card--reveal"
                                        data-payment-reveal="true"
                                        key={payment.order_id}
                                    >
                                        <header className="admin-payment-card-header">
                                            <div className="admin-payment-card-reference-wrap">
                                                <strong className="admin-payment-card-reference">
                                                    {payment.order_number}
                                                </strong>
                                                <span className="admin-payment-card-type">
                                                    {label(payment.order_type)} ORDER
                                                </span>
                                            </div>

                                            <span className={`admin-payments-status ${payment.payment_status || 'unverified'}`}>
                                                {label(payment.payment_status || 'unverified')}
                                            </span>
                                        </header>

                                        <div className="admin-payment-card-customer">
                                            <span className="admin-payment-card-label">CUSTOMER</span>
                                            <strong>{payment.customer?.name || 'Customer'}</strong>
                                            <small>
                                                {payment.customer?.phone || 'Phone number unavailable'}
                                            </small>
                                        </div>

                                        <div className="admin-payment-card-details">
                                            <div>
                                                <span className="admin-payment-card-label">
                                                    PAYMENT METHOD
                                                </span>
                                                <strong>{label(payment.payment_method)}</strong>
                                            </div>

                                            <div>
                                                <span className="admin-payment-card-label">
                                                    ORDER STATUS
                                                </span>
                                                <span className={`admin-payments-order-state ${payment.order_status || ''}`}>
                                                    {label(payment.order_status)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="admin-payment-card-amount">
                                            <span className="admin-payment-card-label">
                                                ORDER VALUE
                                            </span>
                                            <strong>{formatMoney(payment.subtotal)}</strong>
                                        </div>

                                        <div className="admin-payment-card-date">
                                            <span className="admin-payment-card-label">
                                                ORDER PLACED
                                            </span>
                                            <strong>{formatDateTime(payment.created_at)}</strong>
                                        </div>

                                        <button
                                            className="admin-payments-view admin-payment-card-review"
                                            type="button"
                                            onClick={() => openPayment(payment)}
                                        >
                                            REVIEW PAYMENT
                                        </button>
                                    </article>
                                ))
                            )}
                        </div>
                    ) : (
                        /* LIST VIEW */

                        <div className="admin-payments-table-wrap">
                            <table className="admin-payments-table">
                                <thead>
                                    <tr>
                                        <th>ORDER</th>
                                        <th>CUSTOMER</th>
                                        <th>METHOD</th>
                                        <th>ORDER STATUS</th>
                                        <th>PAYMENT STATUS</th>
                                        <th>ORDER VALUE</th>
                                        <th>DATE</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="8" className="admin-payments-empty">
                                                LOADING PAYMENT RECORDS…
                                            </td>
                                        </tr>
                                    ) : payments.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="admin-payments-empty">
                                                NO PAYMENT RECORDS MATCH THESE FILTERS.
                                            </td>
                                        </tr>
                                    ) : (
                                        payments.map((payment) => (
                                            <tr key={payment.order_id}>
                                                <td>
                                                    <strong className="admin-payments-order-ref">
                                                        {payment.order_number}
                                                    </strong>
                                                    <small>{label(payment.order_type)}</small>
                                                </td>

                                                <td>
                                                    <strong>{payment.customer?.name || 'Customer'}</strong>
                                                    <small>{payment.customer?.phone || '—'}</small>
                                                </td>

                                                <td>{label(payment.payment_method)}</td>

                                                <td>
                                                    <span className={`admin-payments-order-state ${payment.order_status}`}>
                                                        {label(payment.order_status)}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className={`admin-payments-status ${payment.payment_status || 'unverified'}`}>
                                                        {label(payment.payment_status || 'unverified')}
                                                    </span>
                                                </td>

                                                <td className="admin-payments-amount">
                                                    {formatMoney(payment.subtotal)}
                                                </td>

                                                <td>{formatDateTime(payment.created_at)}</td>

                                                <td>
                                                    <button
                                                        className="admin-payments-view"
                                                        type="button"
                                                        onClick={() => openPayment(payment)}
                                                    >
                                                        REVIEW
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* PAGINATION */}

                    <div className="admin-payments-pagination">
                        <span>
                            {count === 0
                                ? '0 orders'
                                : `Showing ${page * PAGE_SIZE + 1}–${Math.min(
                                    (page + 1) * PAGE_SIZE,
                                    count
                                )} of ${count}`}
                        </span>

                        <div>
                            <button
                                type="button"
                                onClick={() => setPage((value) => Math.max(0, value - 1))}
                                disabled={page === 0 || loading}
                            >
                                PREVIOUS
                            </button>

                            <strong>
                                PAGE {page + 1} OF {totalPages}
                            </strong>

                            <button
                                type="button"
                                onClick={() =>
                                    setPage((value) =>
                                        Math.min(totalPages - 1, value + 1)
                                    )
                                }
                                disabled={page + 1 >= totalPages || loading}
                            >
                                NEXT
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {/* PAYMENT DETAILS MODAL */}

            {selectedPayment && (
                <div
                    className="admin-payments-modal-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closePayment();
                        }
                    }}
                >
                    <section
                        className="admin-payments-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="payment-modal-title"
                    >
                        <header className="admin-payments-modal-header">
                            <div>
                                <p className="admin-payments-eyebrow">
                                    PAYMENT CONTROL
                                </p>
                                <h2 id="payment-modal-title">
                                    {selectedPayment.order_number}
                                </h2>
                                <span>
                                    {selectedPayment.customer?.name || 'Customer'}
                                    {' · '}
                                    {formatMoney(selectedPayment.subtotal)}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={closePayment}
                                disabled={saveLoading}
                                aria-label="Close payment details"
                            >
                                ×
                            </button>
                        </header>

                        {detailError && (
                            <div className="admin-payments-error" role="alert">
                                {detailError}
                            </div>
                        )}

                        {saveMessage && (
                            <div className="admin-payments-success" role="status">
                                {saveMessage}
                            </div>
                        )}

                        <form
                            className="admin-payments-edit-form"
                            onSubmit={savePayment}
                        >
                            <div className="admin-payments-detail-grid">
                                <div>
                                    <span>ORDER TYPE</span>
                                    <strong>{label(selectedPayment.order_type)}</strong>
                                </div>
                                <div>
                                    <span>FULFILMENT STATUS</span>
                                    <strong>{label(selectedPayment.order_status)}</strong>
                                </div>
                                <div>
                                    <span>PAYMENT METHOD</span>
                                    <strong>{label(selectedPayment.payment_method)}</strong>
                                </div>
                                <div>
                                    <span>ORDER PLACED</span>
                                    <strong>{formatDateTime(selectedPayment.created_at)}</strong>
                                </div>
                                <div>
                                    <span>LAST PAYMENT UPDATE</span>
                                    <strong>{formatDateTime(selectedPayment.payment_updated_at)}</strong>
                                </div>
                                <div>
                                    <span>PAID AT</span>
                                    <strong>{formatDateTime(selectedPayment.paid_at)}</strong>
                                </div>
                            </div>

                            <div className="admin-payments-form-field">
                                <label htmlFor="edit-payment-status">PAYMENT STATUS</label>
                                <select
                                    id="edit-payment-status"
                                    value={editStatus}
                                    onChange={(event) => setEditStatus(event.target.value)}
                                    disabled={saveLoading}
                                >
                                    {allowedTransitions.map((status) => (
                                        <option key={status} value={status}>
                                            {label(status)}
                                        </option>
                                    ))}
                                </select>

                                {selectedPayment.order_status === 'cancelled' && (
                                    <small>
                                        A cancelled order cannot be marked paid.
                                    </small>
                                )}
                            </div>

                            <div className="admin-payments-form-field">
                                <label htmlFor="edit-payment-reference">
                                    PAYMENT REFERENCE (OPTIONAL)
                                </label>
                                <input
                                    id="edit-payment-reference"
                                    type="text"
                                    maxLength={120}
                                    value={editReference}
                                    onChange={(event) => setEditReference(event.target.value)}
                                    placeholder="EFT reference, receipt number, etc."
                                    disabled={saveLoading}
                                />
                            </div>

                            <div className="admin-payments-form-field">
                                <label htmlFor="edit-payment-note">
                                    STAFF NOTE (OPTIONAL)
                                </label>
                                <textarea
                                    id="edit-payment-note"
                                    rows="3"
                                    maxLength={500}
                                    value={editNote}
                                    onChange={(event) => setEditNote(event.target.value)}
                                    placeholder="Add a short reconciliation note…"
                                    disabled={saveLoading}
                                />
                            </div>

                            <div className="admin-payments-form-actions">
                                <button
                                    type="button"
                                    className="admin-payments-cancel"
                                    onClick={closePayment}
                                    disabled={saveLoading}
                                >
                                    CLOSE
                                </button>

                                <button
                                    type="submit"
                                    className="admin-payments-save"
                                    disabled={
                                        saveLoading ||
                                        (
                                            selectedPayment.order_status === 'cancelled' &&
                                            editStatus === 'paid'
                                        )
                                    }
                                >
                                    {saveLoading ? 'SAVING…' : 'SAVE PAYMENT RECORD'}
                                </button>
                            </div>
                        </form>

                        {/* PAYMENT ACTIVITY */}

                        <section className="admin-payments-events">
                            <div className="admin-payments-events-heading">
                                <h3>PAYMENT ACTIVITY</h3>
                                <span>Latest 50 events</span>
                            </div>

                            {detailLoading ? (
                                <p className="admin-payments-events-empty">
                                    LOADING ACTIVITY…
                                </p>
                            ) : paymentEvents.length === 0 ? (
                                <p className="admin-payments-events-empty">
                                    No payment updates recorded yet.
                                </p>
                            ) : (
                                <ol>
                                    {paymentEvents.map((event) => (
                                        <li key={event.id}>
                                            <div>
                                                <strong>
                                                    {label(event.previous_status || 'new')}
                                                    {' → '}
                                                    {label(event.new_status)}
                                                </strong>
                                                <time>{formatDateTime(event.changed_at)}</time>
                                            </div>

                                            {event.payment_reference && (
                                                <p>
                                                    Reference: {event.payment_reference}
                                                </p>
                                            )}

                                            {event.note && <p>{event.note}</p>}
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </section>
                    </section>
                </div>
            )}
        </main>
    );
}

export default AdminPayments;