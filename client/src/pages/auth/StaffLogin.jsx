/** Sign-in for doctors (split card with the doctor photo) and admins (plain card). */
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Notice } from '../../components/Layout.jsx';
import { useAuth, HOME_PATH } from '../../lib/auth.jsx';
import { usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';

function LoginForm({ role, onSubmit, busy, email, setEmail, password, setPassword }) {
    return (
        <form onSubmit={onSubmit}>
            <div className="field">
                <label htmlFor="email">Email</label>
                <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="field">
                <label htmlFor="password">Password</label>
                <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <p className="auth-links"><Link to={`/${role}/forgot-password`}>Forgot your password?</Link></p>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>Sign in</button>
        </form>
    );
}

export default function StaffLogin({ role }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    usePageTitle(role === 'doctor' ? 'Doctor Sign In - DaaktarSahab' : 'Admin Sign In - DaaktarSahab');

    if (user?.role === role && !busy) {
        return <Navigate to={location.state?.from || HOME_PATH[role]} replace />;
    }

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const data = await api.post(`/auth/${role}/login`, { email, password });
            setUser(data.user);
            navigate(location.state?.from || HOME_PATH[role], { replace: true });
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    const form = <LoginForm {...{ role, busy, email, setEmail, password, setPassword }} onSubmit={submit} />;

    if (role === 'admin') {
        return (
            <div className="site-page admin-scope">
                <main className="admin-auth">
                    <div className="admin-auth__card">
                        <Link className="admin-auth__logo" to="/"><img src="/images/logoo5.png" alt="DaaktarSahab home" /></Link>
                        <h1>Admin sign in</h1>
                        <p className="auth-sub">Manage doctors, patients, sessions and appointments.</p>
                        {error && <Notice type="bad">{error}</Notice>}
                        {form}
                        <Link className="auth-back" to="/">&larr; Back to DaaktarSahab</Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="site-page">
            <main className="auth-page">
                <div className="auth-card">
                    <div className="auth-visual is-doctor">
                        <div>
                            <Link className="auth-visual__logo" to="/"><img src="/images/logoo5.png" alt="DaaktarSahab home" /></Link>
                            <h2>For doctors</h2>
                            <p>Manage your sessions, review heart checks your patients share and record each visit.</p>
                        </div>
                    </div>
                    <div className="auth-form">
                        <h1>Welcome, doctor</h1>
                        <p className="auth-sub">Sign in to your doctor account.</p>
                        {error && <Notice type="bad">{error}</Notice>}
                        {form}
                        <Link className="auth-back" to="/">&larr; Back to DaaktarSahab</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
