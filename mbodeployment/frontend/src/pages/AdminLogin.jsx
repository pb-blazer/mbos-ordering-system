
import {
    useEffect,
    useState,
} from 'react';

import {
    getStaffSession,
    isAdminSession,
    requestStaffPasswordReset,
    signInStaff,
    signOutStaff,
} from '../services/AdminAuthService';

import './AdminAuth.css';

// Practical email-format check before authentication or password reset.
const isValidEmail = (value) => {
    const email = value.trim();

    return (
        email.length <= 254 &&
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(email) &&
        !email.split('@')[0].split('.').some((part) => part.length === 0)
    );
};

function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    // Only an authenticated admin should be redirected to the dashboard.
    useEffect(() => {
        let mounted = true;

        const checkSession = async () => {
            try {
                const session = await getStaffSession();

                if (!mounted || !session) {
                    return;
                }

                if (isAdminSession(session)) {
                    window.location.replace('/admin');
                    return;
                }

                // Remove a previously stored non-admin session.
                await signOutStaff();

                if (mounted) {
                    setError(
                        'This account is signed in but does not have admin access. Contact an administrator if you need staff permissions.'
                    );
                }
            } catch (sessionError) {
                console.error('Staff session check failed:', sessionError);

                if (mounted) {
                    setError(
                        'We could not verify your staff session. Check your connection and try again.'
                    );
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        checkSession();

        return () => {
            mounted = false;
        };
    }, []);

    const handleEmailChange = (event) => {
        setEmail(event.target.value);
        setError('');
        setNotice('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setNotice('');

        const normalizedEmail = email.trim();

        if (!normalizedEmail || !password) {
            setError('Enter your staff email and password.');
            return;
        }

        if (!isValidEmail(normalizedEmail)) {
            setError('Enter a valid staff email address, for example staff@example.com.');
            return;
        }

        setSubmitting(true);

        try {
            // signInStaff rejects and signs out any authenticated non-admin.
            await signInStaff(normalizedEmail, password);
            window.location.replace('/admin');
        } catch (loginError) {
            console.error('Staff login failed:', loginError);
            setError(loginError.message || 'Unable to sign in.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleForgotPassword = async () => {
        setError('');
        setNotice('');

        const normalizedEmail = email.trim();

        if (!normalizedEmail) {
            setError(
                'Enter your staff email address above, then select “FORGOT PASSWORD?”.'
            );
            return;
        }

        if (!isValidEmail(normalizedEmail)) {
            setError('Enter a valid staff email address before requesting a password reset.');
            return;
        }

        setResettingPassword(true);

        try {
            await requestStaffPasswordReset(normalizedEmail);

            // Keep the response generic to avoid revealing whether an email
            // address belongs to an account.
            setNotice(
                'If an account exists for that email address, a password-reset link has been sent. Check your inbox and spam folder.'
            );
        } catch (resetError) {
            console.error('Staff password reset request failed:', resetError);
            setError(
                resetError.message ||
                    'We could not request a password reset. Check your connection and try again.'
            );
        } finally {
            setResettingPassword(false);
        }
    };

    if (loading) {
        return (
            <main className="admin-auth-page">
                <div className="admin-auth-shell">
                    <div className="admin-auth-card">
                        <div className="admin-auth-loading">
                            <div className="admin-auth-spinner" />
                            <span>CHECKING STAFF SESSION</span>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="admin-auth-page">
            <div className="admin-auth-shell">
                <div className="admin-auth-brand">
                    <a
                        href="/"
                        className="admin-auth-logo-link"
                        aria-label="Mbo's Tshisanyama home"
                    >
                        <img
                            src="/mbos-logo.png"
                            alt="Mbo's Tshisanyama"
                            className="admin-auth-logo"
                        />
                    </a>
                    <span>STAFF ACCESS</span>
                </div>

                <section className="admin-auth-card">
                    <header className="admin-auth-card-header">
                        <p className="admin-auth-eyebrow">MBO’S TSHISANYAMA</p>
                        <h1>
                            STAFF <span>LOGIN</span>
                        </h1>
                        <p className="admin-auth-description">
                            Sign in to manage incoming customer orders, update
                            order status, and handle deliveries.
                            <strong>
                                {' '}Admin permissions are verified by the backend.
                            </strong>
                        </p>
                    </header>

                    <form
                        className="admin-auth-form"
                        onSubmit={handleSubmit}
                    >
                        <label className="admin-auth-field">
                            <span>STAFF EMAIL</span>
                            <input
                                type="email"
                                value={email}
                                onChange={handleEmailChange}
                                placeholder="staff@example.com"
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                maxLength={254}
                                disabled={submitting || resettingPassword}
                                required
                            />
                        </label>

                        <label className="admin-auth-field">
                            <span>PASSWORD</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => {
                                    setPassword(event.target.value);
                                    setError('');
                                    setNotice('');
                                }}
                                placeholder="Enter password"
                                autoComplete="current-password"
                                disabled={submitting || resettingPassword}
                                required
                            />
                        </label>

                        {error && (
                            <div
                                className="admin-auth-error"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

                        {notice && (
                            <div
                                className="admin-auth-notice"
                                role="status"
                                aria-live="polite"
                            >
                                {notice}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="admin-auth-submit"
                            disabled={submitting || resettingPassword}
                        >
                            {submitting
                                ? 'SIGNING IN...'
                                : 'ENTER STAFF DASHBOARD'}
                        </button>

                        <button
                            type="button"
                            className="admin-auth-forgot-password"
                            onClick={handleForgotPassword}
                            disabled={submitting || resettingPassword}
                        >
                            {resettingPassword
                                ? 'SENDING RESET LINK...'
                                : 'FORGOT PASSWORD?'}
                        </button>
                    </form>

                    <footer className="admin-auth-footer">
                        <span>AUTHORISED STAFF ONLY</span>
                        <a href="/">BACK TO MBO’S</a>
                    </footer>
                </section>
            </div>
        </main>
    );
}

export default AdminLogin;
