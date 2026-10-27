/** Admin layout: the fixed sidebar on the left and the page on the right. */
import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth.jsx';

const LINKS = [
    ['/admin', 'Dashboard', true],
    ['/admin/doctors', 'Doctors'],
    ['/admin/patients', 'Patients'],
    ['/admin/sessions', 'Sessions'],
    ['/admin/appointments', 'Appointments'],
    ['/admin/logs', 'Logs'],
];

export default function AdminShell({ narrow = false, children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    async function signOut(e) {
        e.preventDefault();
        await logout();
        navigate('/');
    }

    return (
        <div className="site-page admin-page admin-scope">
            <div className="admin-shell">
                <aside className="admin-sidebar">
                    <Link className="admin-sidebar__logo" to="/admin"><img src="/images/logoo5.png" alt="DaaktarSahab admin" /></Link>

                    <div className="admin-sidebar__user">
                        <img src="/images/user.png" alt="" />
                        <div>
                            <strong>Admin</strong>
                            <span title={user?.email}>{user?.email}</span>
                        </div>
                    </div>

                    <nav className="admin-nav" aria-label="Admin">
                        <ul>
                            {/* Sub-pages (add doctor, add session) highlight their section. */}
                            {LINKS.map(([to, label, end]) => (
                                <li key={to}>
                                    <NavLink to={to} end={Boolean(end)} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>{label}</NavLink>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="admin-sidebar__foot">
                        <a href="/" onClick={signOut}>Sign out</a>
                    </div>
                </aside>

                <main className="admin-main">
                    <div className={`admin-main__inner${narrow ? ' admin-main__inner--narrow' : ''}`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

/** "Completed", "No-show", "Not recorded" (past and never recorded) or "Booked". */
export function AppointmentStatus({ status, date, today }) {
    if (status === 'completed') return <span className="badge badge-success">&#10003; Completed</span>;
    if (status === 'no_show') return <span className="badge badge-danger">&#10007; No-show</span>;
    return date < today
        ? <span className="badge badge-warning">Not recorded</span>
        : <span className="badge badge-info">Booked</span>;
}
