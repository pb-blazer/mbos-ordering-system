import { useEffect, useState } from 'react';

import {
    initializeStaffPasswordRecovery,
    signOutStaff,
    updateStaffPassword,
} from '../services/AdminAuthService';

import './AdminAuth.css';

function AdminResetPassword() {
    const [recoveryState, setRecoveryState] = useState('checking');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [completed, setCompleted] = useState(false);

    useEffect(() => {
        let mounted = true;

        const verifyRecoveryLink = async () => {
            try {
                const valid = await initializeStaffPasswordRecovery();

                if (mounted) {
                    setRecoveryState(valid ? 'ready' : 'invalid');
                }
            } catch (recoveryError) {
                console.error('Password recovery link verification failed:', recoveryError);

                if (mounted) {
                    setError(
                        recoveryError.message ||
                            'This password-reset link is invalid or has expired. Request a new one from staff login.'
                    );
                    setRecoveryState('invalid');
                }
            }
        };

        verifyRecoveryLink();

        return () => {
            mounted = false;
        };
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Your new password must contain at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('The passwords do not match. Enter them again.');
            return;
        }

        setSubmitting(true);

        try {
            await updateStaffPassword(password);

            // Require a fresh login after the password has been changed.
            try {
                await signOutStaff();
            } catch (signOutError) {
                // The password has already changed; do not present that as a
                // failed reset just because sign-out encountered a problem.
                console.error('Sign-out after password reset failed:', signOutError);
            }

            setCompleted(true);
            setPassword('');
            setConfirmPassword('');
        } catch (updateError) {
            console.error('Staff password update failed:', updateError);
            setError(updateError.message || 'Unable to update your password.');
        } finally {
            setSubmitting(false);
        }
    };

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
                            RESET <span>PASSWORD</span>
                        </h1>
                        <p className="admin-auth-description">
                            Choose a new password for your staff account. You will
                            need to sign in again after it has been changed.
                        </p>
                    </header>

                    {recoveryState === 'checking' && (
                        <div className="admin-auth-loading" aria-live="polite">
                            <div className="admin-auth-spinner" />
                            <span>VERIFYING PASSWORD-RESET LINK</span>
                        </div>
                    )}

                    {recoveryState === 'invalid' && !completed && (
                        <div className="admin-auth-form">
                            <div className="admin-auth-error" role="alert">
                                {error ||
                                    'This password-reset link is invalid or has expired. Request a new one from staff login.'}
                            </div>
                            <a href="/admin/login">RETURN TO STAFF LOGIN</a>
                        </div>
                    )}

                    {recoveryState === 'ready' && !completed && (
                        <form className="admin-auth-form" onSubmit={handleSubmit}>
                            <label className="admin-auth-field">
                                <span>NEW PASSWORD</span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                    minLength={8}
                                    disabled={submitting}
                                    required
                                />
                            </label>

                            <label className="admin-auth-field">
                                <span>CONFIRM NEW PASSWORD</span>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    placeholder="Enter the new password again"
                                    autoComplete="new-password"
                                    minLength={8}
                                    disabled={submitting}
                                    required
                                />
                            </label>

                            {error && (
                                <div className="admin-auth-error" role="alert">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="admin-auth-submit"
                                disabled={submitting}
                            >
                                {submitting ? 'UPDATING PASSWORD...' : 'SAVE NEW PASSWORD'}
                            </button>
                        </form>
                    )}

                    {completed && (
                        <div className="admin-auth-form">
                            <div className="admin-auth-notice" role="status" aria-live="polite">
                                Your password has been updated. Sign in using your new password.
                            </div>
                            <button
                                type="button"
                                className="admin-auth-submit"
                                onClick={() => window.location.replace('/admin/login')}
                            >
                                RETURN TO STAFF LOGIN
                            </button>
                        </div>
                    )}

                    <footer className="admin-auth-footer">
                        <span>AUTHORISED STAFF ONLY</span>
                        <a href="/">BACK TO MBO’S</a>
                    </footer>
                </section>
            </div>
        </main>
    );
}

export default AdminResetPassword;
