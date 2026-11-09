import { useCallback, useEffect, useMemo, useState } from 'react';

import { signOutStaff } from '../services/AdminAuthService';
import { getAdminAnalytics } from '../services/AdminAnalyticsService';

import './AdminAnalytics.css';

const STATUS_META = [
    { key: 'pending', label: 'NEW / PENDING' },
    { key: 'confirmed', label: 'CONFIRMED' },
    { key: 'preparing', label: 'PREPARING' },
    { key: 'ready', label: 'READY' },
    { key: 'completed', label: 'COMPLETED' },
    { key: 'cancelled', label: 'CANCELLED' },
];

const PAYMENT_META = [
    { key: 'cash', label: 'CASH' },
    { key: 'eft', label: 'EFT' },
    { key: 'card', label: 'CARD' },
];

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

function getDefaultDateRange() {
    const to = getSouthAfricanDateString();
    const fromDate = new Date(`${to}T12:00:00.000Z`);
    fromDate.setUTCDate(fromDate.getUTCDate() - 29);

    return {
        from: fromDate.toISOString().slice(0, 10),
        to,
    };
}

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

function validateDateRange(from, to) {
    if (!isValidDate(from) || !isValidDate(to)) {
        return 'Enter valid start and end dates.';
    }

    const fromTime = Date.parse(`${from}T00:00:00.000Z`);
    const toTime = Date.parse(`${to}T00:00:00.000Z`);
    const days = Math.floor((toTime - fromTime) / 86400000) + 1;

    if (days < 1) {
        return 'The start date must be on or before the end date.';
    }

    if (days > 366) {
        return 'Choose a date range of 366 days or fewer.';
    }

    return '';
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

function formatNumber(value) {
    return new Intl.NumberFormat('en-ZA').format(Number(value) || 0);
}

function formatDateLabel(value, includeYear = false) {
    if (!value) return '—';

    const date = new Date(`${value}T12:00:00.000Z`);

    return new Intl.DateTimeFormat('en-ZA', {
        timeZone: 'Africa/Johannesburg',
        day: '2-digit',
        month: 'short',
        ...(includeYear ? { year: 'numeric' } : {}),
    }).format(date);
}

function AnalyticsEmptyState({ children }) {
    return <div className="analytics-empty-state">{children}</div>;
}

function AdminAnalytics() {
    const initialRange = useMemo(() => getDefaultDateRange(), []);
    const [fromDate, setFromDate] = useState(initialRange.from);
    const [toDate, setToDate] = useState(initialRange.to);
    const [appliedRange, setAppliedRange] = useState(initialRange);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pageError, setPageError] = useState('');
    const [filterError, setFilterError] = useState('');
    const [logoutLoading, setLogoutLoading] = useState(false);

    const loadAnalytics = useCallback(async (range, { showLoader = true } = {}) => {
        if (showLoader) setLoading(true);
        setPageError('');

        try {
            const response = await getAdminAnalytics(range);
            setAnalytics(response || null);
        } catch (error) {
            console.error('ADMIN ANALYTICS ERROR:', error);

            const message = error?.message || 'Unable to load business analytics.';

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
    }, []);

    useEffect(() => {
        let active = true;

        const run = async () => {
            if (active) {
                await loadAnalytics(appliedRange);
            }
        };

        run();

        return () => {
            active = false;
        };
    }, [appliedRange, loadAnalytics]);

    const handleApplyFilters = (event) => {
        event.preventDefault();

        const validationError = validateDateRange(fromDate, toDate);

        if (validationError) {
            setFilterError(validationError);
            return;
        }

        setFilterError('');
        setAppliedRange({ from: fromDate, to: toDate });
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAnalytics(appliedRange, { showLoader: false });
    };

    const handleLogout = async () => {
        setLogoutLoading(true);

        try {
            await signOutStaff();
        } catch (error) {
            console.error('ADMIN ANALYTICS LOGOUT ERROR:', error);
        } finally {
            window.location.replace('/admin/login');
        }
    };

    const summary = analytics?.summary || {};
    const daily = Array.isArray(analytics?.daily) ? analytics.daily : [];
    const statusCounts = analytics?.statusCounts || {};
    const maxDailyRevenue = Math.max(
        1,
        ...daily.map((day) => Number(day.revenue) || 0)
    );
    const maxStatusCount = Math.max(
        1,
        ...STATUS_META.map(({ key }) => Number(statusCounts[key]) || 0)
    );
    const maxItemQuantity = Math.max(
        1,
        ...(analytics?.topItems || []).map((item) => Number(item.quantity) || 0)
    );

    const periodLabel = analytics?.period
        ? `${formatDateLabel(analytics.period.from, true)} – ${formatDateLabel(analytics.period.to, true)}`
        : `${formatDateLabel(appliedRange.from, true)} – ${formatDateLabel(appliedRange.to, true)}`;

    const chartMinWidth = Math.max(620, daily.length * 23);

    return (
        <main className="admin-analytics-page">
            <header className="admin-analytics-header">
                <a
                    className="admin-analytics-brand"
                    href="/admin"
                    aria-label="Mbo's Tshisanyama admin dashboard"
                >
                    <span className="admin-analytics-logo-wrap">
                        <img src="/mbos-logo.png" alt="" />
                    </span>
                    <span className="admin-analytics-brand-copy">
                        <strong>MBO’S</strong>
                        <small>BUSINESS ANALYTICS</small>
                    </span>
                </a>

                <nav className="admin-analytics-nav" aria-label="Admin navigation">
                    <a href="/admin">LIVE ORDERS</a>
                    <a href="/admin/menu">MANAGE MENU</a>
                    <a href="/admin/history">ORDER HISTORY</a>
                    <a href="/admin/payments">PAYMENTS</a>
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={logoutLoading}
                    >
                        {logoutLoading ? 'LOGGING OUT…' : 'LOG OUT'}
                    </button>
                </nav>
            </header>

            <div className="admin-analytics-container">
                <section className="admin-analytics-heading">
                    <div>
                        <p className="admin-analytics-eyebrow">PERFORMANCE &amp; INSIGHTS</p>
                        <h1>BUSINESS <span>ANALYTICS.</span></h1>
                        <p className="admin-analytics-description">
                            Understand sales performance, order activity and your most popular menu items.
                        </p>
                    </div>

                    <div className="admin-analytics-period">
                        <span>SELECTED PERIOD</span>
                        <strong>{periodLabel}</strong>
                    </div>
                </section>

                <form className="analytics-filter-bar" onSubmit={handleApplyFilters}>
                    <div className="analytics-date-field">
                        <label htmlFor="analytics-from">FROM</label>
                        <input
                            id="analytics-from"
                            type="date"
                            value={fromDate}
                            max={toDate || undefined}
                            onChange={(event) => setFromDate(event.target.value)}
                        />
                    </div>

                    <div className="analytics-date-field">
                        <label htmlFor="analytics-to">TO</label>
                        <input
                            id="analytics-to"
                            type="date"
                            value={toDate}
                            min={fromDate || undefined}
                            max={getSouthAfricanDateString()}
                            onChange={(event) => setToDate(event.target.value)}
                        />
                    </div>

                    <button type="submit" className="analytics-apply-button">
                        APPLY DATE RANGE
                    </button>

                    <button
                        type="button"
                        className="analytics-refresh-button"
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                    >
                        {refreshing ? 'REFRESHING…' : 'REFRESH DATA'}
                    </button>

                    {filterError && (
                        <p className="analytics-filter-error" role="alert">
                            {filterError}
                        </p>
                    )}
                </form>

                {pageError && (
                    <div className="analytics-page-error" role="alert">
                        <span>{pageError}</span>
                        <button type="button" onClick={() => loadAnalytics(appliedRange)}>
                            TRY AGAIN
                        </button>
                    </div>
                )}

                {loading && !analytics ? (
                    <section className="analytics-loading" aria-live="polite">
                        <span className="analytics-spinner" />
                        <strong>CALCULATING BUSINESS PERFORMANCE</strong>
                        <p>Loading order and sales data for the selected period.</p>
                    </section>
                ) : analytics ? (
                    <>
                        <section className="analytics-kpi-grid" aria-label="Key performance indicators">
                            <article className="analytics-kpi-card analytics-kpi-revenue">
                                <span>COMPLETED REVENUE</span>
                                <strong>{formatMoney(summary.completedRevenue)}</strong>
                                <small>Completed orders only</small>
                            </article>

                            <article className="analytics-kpi-card">
                                <span>ORDERS PLACED</span>
                                <strong>{formatNumber(summary.totalOrders)}</strong>
                                <small>All statuses in this period</small>
                            </article>

                            <article className="analytics-kpi-card">
                                <span>COMPLETED ORDERS</span>
                                <strong>{formatNumber(summary.completedOrders)}</strong>
                                <small>Successfully completed</small>
                            </article>

                            <article className="analytics-kpi-card">
                                <span>AVERAGE COMPLETED ORDER</span>
                                <strong>{formatMoney(summary.averageCompletedOrderValue)}</strong>
                                <small>Revenue ÷ completed orders</small>
                            </article>
                        </section>

                        <section className="analytics-secondary-stats" aria-label="Operational summary">
                            <div>
                                <span>IN PROGRESS</span>
                                <strong>{formatNumber(summary.inProgressOrders)}</strong>
                            </div>
                            <div>
                                <span>CANCELLED</span>
                                <strong>{formatNumber(summary.cancelledOrders)}</strong>
                            </div>
                            <div>
                                <span>COLLECTIONS</span>
                                <strong>{formatNumber(analytics.orderTypes?.collection?.orders)}</strong>
                            </div>
                            <div>
                                <span>DELIVERIES</span>
                                <strong>{formatNumber(analytics.orderTypes?.delivery?.orders)}</strong>
                            </div>
                        </section>

                        <section className="analytics-panel analytics-trend-panel">
                            <div className="analytics-panel-heading">
                                <div>
                                    <p className="analytics-panel-eyebrow">SALES PERFORMANCE</p>
                                    <h2>REVENUE <span>TREND</span></h2>
                                </div>
                                <div className="analytics-chart-legend">
                                    <span className="analytics-legend-dot" /> Completed revenue
                                </div>
                            </div>

                            {daily.length > 0 && daily.some((day) => Number(day.revenue) > 0) ? (
                                <div className="analytics-chart-scroll">
                                    <div
                                        className="analytics-chart-bars"
                                        style={{ minWidth: `${chartMinWidth}px` }}
                                    >
                                        {daily.map((day, index) => {
                                            const revenue = Number(day.revenue) || 0;
                                            const height = revenue > 0
                                                ? Math.max(5, (revenue / maxDailyRevenue) * 100)
                                                : 2;
                                            const showLabel = daily.length <= 18 || index === 0 || index === daily.length - 1 || index % Math.ceil(daily.length / 9) === 0;

                                            return (
                                                <div className="analytics-chart-column" key={day.date}>
                                                    <div className="analytics-chart-value" title={`${formatDateLabel(day.date, true)}: ${formatMoney(revenue)}`}>
                                                        {revenue > 0 ? formatMoney(revenue) : ''}
                                                    </div>
                                                    <div className="analytics-chart-track">
                                                        <span
                                                            className="analytics-chart-bar"
                                                            style={{ height: `${height}%` }}
                                                            title={`${formatDateLabel(day.date, true)}: ${formatMoney(revenue)}`}
                                                        />
                                                    </div>
                                                    <span className="analytics-chart-date">
                                                        {showLabel ? formatDateLabel(day.date) : ''}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <AnalyticsEmptyState>
                                    No completed sales were recorded during this date range.
                                </AnalyticsEmptyState>
                            )}
                            <p className="analytics-chart-note">
                                Sales are grouped by South African calendar day. Only completed order subtotals are included.
                            </p>
                        </section>

                        <div className="analytics-insights-grid">
                            <section className="analytics-panel">
                                <div className="analytics-panel-heading">
                                    <div>
                                        <p className="analytics-panel-eyebrow">ORDER PIPELINE</p>
                                        <h2>ORDER <span>STATUS</span></h2>
                                    </div>
                                </div>

                                {STATUS_META.map(({ key, label }) => {
                                    const count = Number(statusCounts[key]) || 0;
                                    const width = count > 0 ? (count / maxStatusCount) * 100 : 0;

                                    return (
                                        <div className="analytics-breakdown-row" key={key}>
                                            <div className="analytics-breakdown-label">
                                                <span>{label}</span>
                                                <strong>{formatNumber(count)}</strong>
                                            </div>
                                            <div className="analytics-breakdown-track">
                                                <span className={`analytics-breakdown-bar status-${key}`} style={{ width: `${width}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </section>

                            <section className="analytics-panel">
                                <div className="analytics-panel-heading">
                                    <div>
                                        <p className="analytics-panel-eyebrow">MENU PERFORMANCE</p>
                                        <h2>TOP <span>SELLERS</span></h2>
                                    </div>
                                </div>

                                {Array.isArray(analytics.topItems) && analytics.topItems.length > 0 ? (
                                    <div className="analytics-top-items">
                                        {analytics.topItems.map((item, index) => {
                                            const quantity = Number(item.quantity) || 0;
                                            const width = quantity > 0 ? (quantity / maxItemQuantity) * 100 : 0;

                                            return (
                                                <article className="analytics-top-item" key={item.menuItemId ?? `${item.name}-${index}`}>
                                                    <div className="analytics-top-item-main">
                                                        <span className="analytics-rank">{String(index + 1).padStart(2, '0')}</span>
                                                        <div className="analytics-top-item-copy">
                                                            <strong>{item.name}</strong>
                                                            <small>{item.category || 'Other'}</small>
                                                        </div>
                                                        <div className="analytics-top-item-numbers">
                                                            <strong>{formatNumber(quantity)} sold</strong>
                                                            <small>{formatMoney(item.revenue)}</small>
                                                        </div>
                                                    </div>
                                                    <div className="analytics-breakdown-track">
                                                        <span className="analytics-breakdown-bar top-item-bar" style={{ width: `${width}%` }} />
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <AnalyticsEmptyState>
                                        No completed order items were found for this period.
                                    </AnalyticsEmptyState>
                                )}
                            </section>

                            <section className="analytics-panel">
                                <div className="analytics-panel-heading">
                                    <div>
                                        <p className="analytics-panel-eyebrow">FULFILMENT MIX</p>
                                        <h2>ORDER <span>TYPE</span></h2>
                                    </div>
                                </div>

                                {['collection', 'delivery'].map((key) => {
                                    const item = analytics.orderTypes?.[key] || {};

                                    return (
                                        <article className="analytics-type-card" key={key}>
                                            <div>
                                                <span>{key.toUpperCase()}</span>
                                                <strong>{formatNumber(item.orders)}</strong>
                                            </div>
                                            <small>{formatNumber(item.completedOrders)} completed · {formatMoney(item.revenue)}</small>
                                        </article>
                                    );
                                })}
                            </section>

                            <section className="analytics-panel">
                                <div className="analytics-panel-heading">
                                    <div>
                                        <p className="analytics-panel-eyebrow">COMPLETED SALES</p>
                                        <h2>PAYMENT <span>METHOD</span></h2>
                                    </div>
                                </div>

                                <div className="analytics-payment-list">
                                    {PAYMENT_META.map(({ key, label }) => {
                                        const item = analytics.paymentMethods?.[key] || {};

                                        return (
                                            <div className="analytics-payment-row" key={key}>
                                                <div>
                                                    <span>{label}</span>
                                                    <strong>{formatMoney(item.revenue)}</strong>
                                                </div>
                                                <small>{formatNumber(item.orders)} completed orders</small>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>

                        <p className="analytics-data-note">
                            <strong>How these figures work:</strong> Completed revenue is calculated from the stored order subtotal of orders marked completed. Pending, confirmed, preparing, ready and cancelled orders are excluded from revenue. Delivery fees are not included if your database stores them separately. Top sellers are calculated from completed order items only.
                        </p>
                    </>
                ) : !loading ? (
                    <AnalyticsEmptyState>
                        Analytics could not be displayed. Refresh the page to try again.
                    </AnalyticsEmptyState>
                ) : null}

                {loading && analytics && (
                    <div className="analytics-refresh-overlay" aria-live="polite">
                        Updating analytics…
                    </div>
                )}
            </div>
        </main>
    );
}

export default AdminAnalytics;
