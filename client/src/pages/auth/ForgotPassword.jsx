/**
 * Password reset for all three portals, in two steps: ask for a link, then
 * (opening the link, ?token=...) choose a new password. With no email
 * service, the API returns the link in development and it is shown here.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Notice } from '../../components/Layout.jsx';
import { usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';

const COPY = {
    patient: { sub: 'Patient account recovery', blurb: 'Reset your password in two quick steps and get back to your heart checks and appointments.', placeholder: 'patient@example.com', label: 'Your email address', title: 'Reset Password - DaaktarSahab' },
    doctor: { sub: 'Doctor account recovery', blurb: 'Reset your password in two quick steps and get back to your sessions and appointments.', placeholder: 'doctor@example.com', label: 'Your email address', title: 'Doctor Password Reset - DaaktarSahab' },
    admin: { sub: 'Admin account recovery', blurb: '', placeholder: 'admin@example.com', label: 'Admin email address', title: 'Admin Password Reset - DaaktarSahab' },
};

export default function ForgotPassword({ role }) {
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const [step, setStep] = useState(token ? 0 : 1); // 0 = checking the link
    const [notice, setNotice] = useState(null); // {type, text, link}
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const copy = COPY[role];
    usePageTitle(copy.title);

    // Arriving from a link: check it before asking for a new password.
    useEffect(() => {
        if (!token) {
            setStep(1);
            return;
        }
        api.get(`/auth/${role}/reset/${encodeURIComponent(token)}`)
            .then((data) => {
                if (data.valid) {
                    setStep(2);
                } else {
                    setStep(1);
                    setNotice({ type: 'bad', text: 'This reset link is invalid or has expired. Please request a new one.' });
                }
            })
            .catch((err) => { setStep(1); setNotice({ type: 'bad', text: err.message }); });
    }, [role, token]);

    async function sendLink(e) {
        e.preventDefault();
        setBusy(true);
        try {
            const data = await api.post(`/auth/${role}/forgot`, { email });
            setNotice({ type: 'ok', text: data.message, link: data.resetUrl });
        } catch (err) {
            setNotice({ type: 'bad', text: err.message });
        } finally {
            setBusy(false);
        }
    }

    async function reset(e) {
        e.preventDefault();
        setBusy(true);
        try {
            const data = await api.post(`/auth/${role}/reset`, { token, password, confirm });
            setNotice({ type: 'ok', text: data.message });
            setStep(3);
        } catch (err) {
            setNotice({ type: 'bad', text: err.message });
            if (err.status === 410) setStep(1);
        } finally {
            setBusy(false);
        }
    }

    const body = (
        <>
            <ol className="reset-steps">
                {['Your email', 'New password', 'Done'].map((label, i) => {
                    const n = i + 1;
                    return <li key={label} className={step > n ? 'is-done' : (step === n ? 'is-current' : '')}>{label}</li>;
                })}
            </ol>

            {notice && (
                <Notice type={notice.type}>
                    {notice.text}
                    {notice.link && (
                        <>
                            <br /><br />
                            <strong>Reset Link (valid 30 min):</strong><br />
                            <a href={notice.link} className="reset-link">{notice.link}</a>
                            <br /><br /><em>In a production system this link would be e-mailed to you.</em>
                        </>
                    )}
                </Notice>
            )}

            {step === 1 && (
                <form onSubmit={sendLink}>
                    <div className="field">
                        <label htmlFor="email">{copy.label}</label>
                        <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={copy.placeholder} required autoComplete="email" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block" disabled={busy}>Send reset link</button>
                </form>
            )}

            {step === 2 && (
                <form onSubmit={reset}>
                    <div className="field">
                        <label htmlFor="new_password">New password</label>
                        <input type="password" id="new_password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} autoComplete="new-password" />
                    </div>
                    <div className="field">
                        <label htmlFor="confirm_password">Confirm new password</label>
                        <input type="password" id="confirm_password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your new password" required minLength={6} autoComplete="new-password" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block" disabled={busy}>Reset password</button>
                </form>
            )}

            {step === 3 && (
                <>
                    {role !== 'admin' && <div className="done-icon" aria-hidden="true">&#10003;</div>}
                    <Link to={`/${role}/login`} className="btn btn-primary btn-block">Sign in</Link>
                </>
            )}

            <Link to={`/${role}/login`} className="auth-back">&larr; Back to sign in</Link>
        </>
    );

    if (role === 'admin') {
        return (
            <div className="site-page admin-scope pg-reset">
                <main className="admin-auth">
                    <div className="admin-auth__card">
                        <Link className="admin-auth__logo" to="/"><img src="/images/logoo5.png" alt="DaaktarSahab home" /></Link>
                        <h1>Reset your password</h1>
                        <p className="auth-sub">{copy.sub}</p>
                        {body}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="site-page pg-reset">
            <main className="auth-page">
                <div className="auth-card">
                    <div className={`auth-visual${role === 'doctor' ? ' is-doctor' : ''}`}>
                        <div>
                            <Link className="auth-visual__logo" to="/"><img src="/images/logoo5.png" alt="DaaktarSahab home" /></Link>
                            <h2>Locked out?</h2>
                            <p>{copy.blurb}</p>
                        </div>
                    </div>
                    <div className="auth-form">
                        <h1>Reset your password</h1>
                        <p className="auth-sub">{copy.sub}</p>
                        {body}
                    </div>
                </div>
            </main>
        </div>
    );
}
