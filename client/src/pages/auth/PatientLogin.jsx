import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Notice } from '../../components/Layout.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { today } from '../../lib/format.js';
import { NAME_PATTERN, PHONE_PATTERN, EMAIL_PATTERN, PHONE_MESSAGE } from '@shared/constants.js';

/** Browser-side format check with the server's own message. */
export const checkFormat = (pattern, message) => (e) => {
    const input = e.target;
    input.setCustomValidity(input.value === '' || pattern.test(input.value) ? '' : message);
};

const TEXT = {
    login: { title: 'Welcome back', sub: 'Sign in to your patient account.', button: 'Sign in' },
    register: { title: 'Create your account', sub: 'It takes a minute. You can take a heart check straight after.', button: 'Create account' },
};

export default function PatientLogin() {
    const [params] = useSearchParams();
    const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
    const [values, setValues] = useState({ name: '', email: '', password: '', contact: '', dob: '', address: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    usePageTitle('Patient Sign In - DaaktarSahab');

    // Already signed in as a patient: nothing to do here.
    if (user?.role === 'patient' && !busy) {
        return <Navigate to={location.state?.from || '/patient'} replace />;
    }

    const register = mode === 'register';
    const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const data = register
                ? await api.post('/auth/patient/register', values)
                : await api.post('/auth/patient/login', { email: values.email, password: values.password });
            setUser(data.user);
            navigate(location.state?.from || '/patient', { replace: true });
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <div className="site-page pg-patient-login">
            <main className="auth-page">
                <div className="auth-card">
                    <div className="auth-visual">
                        <div>
                            <Link className="auth-visual__logo" to="/"><img src="/images/logoo5.png" alt="DaaktarSahab home" /></Link>
                            <h2>Your heart, in good hands</h2>
                            <p>Check your heart risk, book a cardiologist and read your doctor's advice, all in one place.</p>
                        </div>
                    </div>

                    <div className="auth-form">
                        <h1>{TEXT[mode].title}</h1>
                        <p className="auth-sub">{TEXT[mode].sub}</p>

                        <div className="auth-tabs" role="tablist">
                            {['login', 'register'].map((m) => (
                                <button key={m} type="button" role="tab" aria-selected={mode === m ? 'true' : 'false'}
                                    onClick={() => { setMode(m); setError(''); }}>
                                    {m === 'login' ? 'Sign in' : 'Create account'}
                                </button>
                            ))}
                        </div>

                        {error && <Notice type="bad">{error}</Notice>}

                        <form onSubmit={submit}>
                            {register && (
                                <div className="field">
                                    <label htmlFor="name">Full name</label>
                                    <input type="text" id="name" value={values.name} onChange={set('name')} required autoComplete="name"
                                        onInput={checkFormat(NAME_PATTERN, "Please use letters, spaces and . , ' - only.")} />
                                </div>
                            )}

                            <div className="field">
                                <label htmlFor="email">Email</label>
                                <input type="email" id="email" value={values.email} onChange={set('email')} required autoComplete="email"
                                    onInput={checkFormat(EMAIL_PATTERN, 'Please enter a valid email address.')} />
                            </div>

                            <div className="field">
                                <label htmlFor="password">Password</label>
                                <input type="password" id="password" value={values.password} onChange={set('password')} required
                                    minLength={register ? 6 : undefined} autoComplete={register ? 'new-password' : 'current-password'} />
                                {register && <p className="hint">At least 6 characters.</p>}
                            </div>

                            {!register && <p className="auth-links"><Link to="/patient/forgot-password">Forgot your password?</Link></p>}

                            {register && (
                                <>
                                    <div className="form-grid">
                                        <div className="field">
                                            <label htmlFor="contactNumber">Mobile number</label>
                                            <input type="text" id="contactNumber" value={values.contact} onChange={set('contact')} required
                                                inputMode="numeric" placeholder="98XXXXXXXX" autoComplete="tel"
                                                onInput={checkFormat(PHONE_PATTERN, PHONE_MESSAGE)} />
                                        </div>
                                        <div className="field">
                                            <label htmlFor="dob">Date of birth</label>
                                            <input type="date" id="dob" value={values.dob} onChange={set('dob')} required max={today()} />
                                        </div>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="address">Address</label>
                                        <input type="text" id="address" value={values.address} onChange={set('address')} required autoComplete="street-address" />
                                    </div>
                                </>
                            )}

                            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{TEXT[mode].button}</button>
                        </form>

                        <Link className="auth-back" to="/">&larr; Back to DaaktarSahab</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
