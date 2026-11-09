import { useEffect, useState } from 'react';

import Home from './pages/Home';
import Menu from './pages/Menu';
import Checkout from './pages/Checkout';
import OrderStatus from './pages/OrderStatus';
import AdminLogin from './pages/AdminLogin';
import AdminResetPassword from './pages/AdminResetPassword';
import Admin from './pages/Admin';
import AdminMenu from './pages/AdminMenu';
import AdminHistory from './pages/AdminHistory';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminPayments from './pages/AdminPayments';

import {
    getStaffSession,
    isAdminSession,
    signOutStaff,
} from './services/AdminAuthService';

function AdminRoute({ children }) {
    const [accessState, setAccessState] = useState('checking');
    const [accessError, setAccessError] = useState('');

    useEffect(() => {
        let mounted = true;

        async function verifyAccess() {
            try {
                const session = await getStaffSession();

                if (!mounted) {
                    return;
                }

                if (!session) {
                    window.location.replace('/admin/login');
                    return;
                }

                if (!isAdminSession(session)) {
                    setAccessState('denied');
                    return;
                }

                setAccessState('allowed');
            } catch (error) {
                console.error('ADMIN ROUTE VERIFICATION ERROR:', error);

                if (mounted) {
                    setAccessError(
                        'We could not verify your staff permissions. Check your connection and try again.'
                    );
                    setAccessState('error');
                }
            }
        }

        verifyAccess();

        return () => {
            mounted = false;
        };
    }, []);

    const leaveAdminArea = async () => {
        try {
            await signOutStaff();
        } catch (error) {
            console.error('STAFF SIGN-OUT ERROR:', error);
        } finally {
            window.location.replace('/admin/login');
        }
    };

    if (accessState === 'checking') {
        return (
            <main className="admin-auth-page">
                <div className="admin-auth-shell">
                    <section className="admin-auth-card" aria-live="polite">
                        <div className="admin-auth-loading">
                            <div className="admin-auth-spinner" />
                            <span>VERIFYING ADMIN PERMISSIONS</span>
                        </div>
                    </section>
                </div>
            </main>
        );
    }

    if (accessState === 'denied') {
        return (
            <main className="admin-auth-page">
                <div className="admin-auth-shell">
                    <section className="admin-auth-card" role="alert">
                        <p className="admin-auth-eyebrow">RESTRICTED AREA</p>
                        <h1>
                            ADMIN <span>ACCESS REQUIRED</span>
                        </h1>
                        <p className="admin-auth-description">
                            This account is signed in, but it does not have
                            administrator permissions. The dashboard and menu
                            management tools are reserved for authorised admins.
                        </p>
                        <button
                            type="button"
                            className="admin-auth-submit"
                            onClick={leaveAdminArea}
                        >
                            SIGN OUT AND RETURN TO LOGIN
                        </button>
                        <p className="admin-auth-description">
                            If you believe you should have access, contact the
                            account administrator to grant the admin role.
                        </p>
                    </section>
                </div>
            </main>
        );
    }

    if (accessState === 'error') {
        return (
            <main className="admin-auth-page">
                <div className="admin-auth-shell">
                    <section className="admin-auth-card" role="alert">
                        <p className="admin-auth-eyebrow">SECURITY CHECK</p>
                        <h1>
                            ACCESS <span>UNVERIFIED</span>
                        </h1>
                        <p className="admin-auth-description">{accessError}</p>
                        <button
                            type="button"
                            className="admin-auth-submit"
                            onClick={() => window.location.reload()}
                        >
                            TRY AGAIN
                        </button>
                        <a href="/admin/login">RETURN TO STAFF LOGIN</a>
                    </section>
                </div>
            </main>
        );
    }

    return children;
}

function App() {
    const path = window.location.pathname;

    // Customer routes
    if (path === '/menu') {
        return <Menu />;
    }

    if (path === '/checkout') {
        return <Checkout />;
    }

    if (path === '/order-status') {
        return <OrderStatus />;
    }

    // Staff password recovery must be reachable before a staff session exists.
    if (path === '/admin/reset-password') {
        return <AdminResetPassword />;
    }

    // Staff routes: require both a Supabase session and the admin role.
    if (path === '/admin/login') {
        return <AdminLogin />;
    }

    if (path === '/admin/menu') {
        return (
            <AdminRoute>
                <AdminMenu />
            </AdminRoute>
        );
    }

    if (path === '/admin/history') {
        return (
            <AdminRoute>
                <AdminHistory />
            </AdminRoute>
        );
    }

    if (path === '/admin/analytics') {
        return (
            <AdminRoute>
                <AdminAnalytics />
            </AdminRoute>
        );
    }

    if (path === '/admin/payments') {
        return (
            <AdminRoute>
                <AdminPayments />
            </AdminRoute>
        );
    }

    if (path === '/admin') {
        return (
            <AdminRoute>
                <Admin />
            </AdminRoute>
        );
    }

    return <Home />;
}

export default App;
