/**
 * The site header, in three flavours (the old mainHeader.html,
 * patientHeader.html and doctorHeader.html): public, patient and doctor.
 * Signed-in headers show an unread-messages badge, checked on load, every 30
 * seconds while the tab is visible, and straight away from the Messages page
 * (the chat fires "chat:unread").
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';

const LINKS = {
    main: [['/', 'Home'], ['/about', 'About Us'], ['/contact', 'Contact Us']],
    patient: [['/patient', 'Home'], ['/patient/doctors', 'Doctors'], ['/patient/schedule', 'Schedules'], ['/patient/heart-check', 'Heart Problems']],
    doctor: [['/doctor', 'Home'], ['/doctor/patients', 'Patients'], ['/doctor/schedule', 'Schedules'], ['/doctor/appointments', 'My Appointments']],
};

function useUnreadCount(enabled) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!enabled) return undefined;
        let stopped = false;
        const check = () => {
            if (document.hidden) return;
            api.get('/chat/unread')
                .then((data) => { if (!stopped && typeof data.unread === 'number') setCount(data.unread); })
                .catch(() => { /* the badge is a nicety; stay quiet */ });
        };
        const fromChat = (e) => setCount(e.detail);
        document.addEventListener('chat:unread', fromChat);
        document.addEventListener('visibilitychange', check);
        const timer = setInterval(check, 30000);
        check();
        return () => {
            stopped = true;
            clearInterval(timer);
            document.removeEventListener('chat:unread', fromChat);
            document.removeEventListener('visibilitychange', check);
        };
    }, [enabled]);

    return count;
}

function UnreadBadge({ count }) {
    return (
        <span className="header-unread" hidden={!(count > 0)}>
            {count > 99 ? '99+' : String(count)}
        </span>
    );
}

export default function SiteHeader({ variant = 'main' }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const signedIn = variant !== 'main';
    const unread = useUnreadCount(signedIn && user?.role === variant);
    const home = variant === 'main' ? '/' : `/${variant}`;

    async function signOut() {
        await logout();
        navigate('/');
    }

    return (
        <header className="site-header site-header--sticky">
            <Link className="site-header__logo" to={home}><img src="/images/logoo5.png" alt="DaaktarSahab home" /></Link>

            <button
                type="button"
                className="site-header__toggle"
                aria-controls="siteMenu"
                aria-expanded={open ? 'true' : 'false'}
                aria-label="Menu"
                onClick={() => setOpen(!open)}
            >
                <span /><span /><span />
            </button>

            <div className={`site-header__menu${open ? ' is-open' : ''}`} id="siteMenu">
                <nav className="site-nav" aria-label="Main">
                    {LINKS[variant].map(([to, label]) => (
                        <NavLink key={to} to={to} end>{label}</NavLink>
                    ))}
                </nav>

                <div className="site-account">
                    {variant === 'main' && (
                        <div className="account-menu">
                            <button type="button" className="account-menu__btn account-menu__btn--text">Login</button>
                            <p className="account-menu__heading">Log in</p>
                            <ul className="account-menu__list">
                                <li><Link to="/patient/login">As Patient</Link></li>
                                <li><Link to="/doctor/login">As Doctor</Link></li>
                                <li><Link to="/admin/login">As Admin</Link></li>
                            </ul>
                        </div>
                    )}

                    {variant === 'patient' && (
                        <>
                            <div className="account-menu">
                                <button type="button" className="account-menu__btn" aria-label="Account menu">
                                    <img src="/images/user.png" alt="" />
                                    <UnreadBadge count={unread} />
                                </button>
                                <p className="account-menu__heading">Your account</p>
                                <ul className="account-menu__list">
                                    <li><Link to="/patient/profile"><strong>{user?.name}</strong></Link></li>
                                    <li><Link to="/patient/appointments">My Appointments</Link></li>
                                    <li><Link to="/patient/messages">Messages <UnreadBadge count={unread} /></Link></li>
                                    <li><Link to="/patient/history">My Prediction History</Link></li>
                                </ul>
                            </div>
                            <button type="button" className="logout-btn" onClick={signOut}>Logout</button>
                        </>
                    )}

                    {variant === 'doctor' && (
                        <>
                            <div className="account-menu">
                                <button type="button" className="account-menu__btn" aria-label="Account menu">
                                    <img src="/images/user.png" alt="" />
                                    <UnreadBadge count={unread} />
                                </button>
                                <p className="account-menu__heading">Your account</p>
                                <ul className="account-menu__list">
                                    <li><Link to="/doctor/profile"><strong>Dr. {user?.name}</strong></Link></li>
                                    <li><Link to="/doctor/appointments">My Appointments</Link></li>
                                    <li><Link to="/doctor/messages">Messages <UnreadBadge count={unread} /></Link></li>
                                    <li><Link to="/doctor/patients">My Patients</Link></li>
                                    <li><Link to="/doctor/schedule">My Sessions</Link></li>
                                </ul>
                            </div>
                            <button type="button" className="logout-btn" onClick={signOut}>Logout</button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
