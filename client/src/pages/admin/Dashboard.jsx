import { useState } from 'react';
import { Link } from 'react-router';
import AdminShell from '../../components/AdminShell.jsx';
import { Notice, Loading } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { clock, dayFull, friendlyDay } from '../../lib/format.js';
import { FEE_PER_APPOINTMENT } from '@shared/constants.js';

const money = (n) => n.toLocaleString('en-US');
const EMPTY = { current: '', password: '', confirm: '' };

export default function Dashboard() {
    usePageTitle('Dashboard - DaaktarSahab Admin');
    const { data } = useApi('/admin/dashboard');
    const [form, setForm] = useState(EMPTY);
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    async function changePassword(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await api.put('/admin/password', form);
            setForm(EMPTY);
            setNotice(['ok', 'Your password was changed.']);
        } catch (err) {
            setNotice(['bad', err.message]);
        } finally {
            setBusy(false);
        }
    }

    if (!data) return <AdminShell><Loading /></AdminShell>;
    const { totals } = data;

    return (
        <AdminShell>
            <div className="admin-head">
                <div>
                    <h1>Dashboard</h1>
                    <p>{dayFull(data.today)}</p>
                </div>
            </div>

            <div className="stat-grid">
                <Link className="stat-card" to="/admin/doctors">
                    <span className="stat-card__label">Doctors</span>
                    <span className="stat-card__value">{totals.doctors}</span>
                    <span className="stat-card__note">{totals.specialties} specialties</span>
                </Link>
                <Link className="stat-card" to="/admin/patients">
                    <span className="stat-card__label">Patients</span>
                    <span className="stat-card__value">{totals.patients}</span>
                    <span className="stat-card__note">Registered accounts</span>
                </Link>
                <Link className="stat-card" to="/admin/appointments">
                    <span className="stat-card__label">Upcoming</span>
                    <span className="stat-card__value">{totals.upcoming}</span>
                    <span className="stat-card__note">Appointments from today</span>
                </Link>
                <div className="stat-card">
                    <span className="stat-card__label">Revenue</span>
                    <span className="stat-card__value">Rs. {money(totals.appointments * FEE_PER_APPOINTMENT)}</span>
                    <span className="stat-card__note">{totals.appointments} bookings at Rs. {money(FEE_PER_APPOINTMENT)}</span>
                </div>
            </div>

            <div className="admin-columns">
                <section className="panel">
                    <div className="panel__head">
                        <div>
                            <h2 className="panel__title">Next appointments</h2>
                            <p className="panel__sub">The next {data.nextAppointments.length} bookings</p>
                        </div>
                        <Link className="panel__link" to="/admin/appointments">View all</Link>
                    </div>
                    {data.nextAppointments.length ? (
                        <div className="table-scroll">
                            <table className="data-table stack">
                                <thead><tr><th>Patient</th><th>Doctor</th><th>When</th></tr></thead>
                                <tbody>
                                    {data.nextAppointments.map((row) => (
                                        <tr key={row.id}>
                                            <td className="cell-strong" data-label="Patient">{row.patientName}</td>
                                            <td data-label="Doctor">{row.doctorName}</td>
                                            <td className="nowrap" data-label="When">
                                                <span>{friendlyDay(row.date, data.today)}<br /><span className="cell-muted">{clock(row.start)}</span></span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <div className="empty-state"><p>No upcoming appointments.</p></div>}
                </section>

                <section className="panel">
                    <div className="panel__head">
                        <div>
                            <h2 className="panel__title">Next sessions</h2>
                            <p className="panel__sub">Doctors' upcoming availability</p>
                        </div>
                        <Link className="panel__link" to="/admin/sessions">View all</Link>
                    </div>
                    {data.nextSessions.length ? (
                        <div className="table-scroll">
                            <table className="data-table stack">
                                <thead><tr><th>Doctor</th><th>Date</th><th>Booked</th></tr></thead>
                                <tbody>
                                    {data.nextSessions.map((row) => {
                                        const { totalSlots: total, bookedSlots: booked } = row;
                                        const tone = total > 0 && booked === total ? 'badge-info' : (booked > 0 ? 'badge-success' : 'badge-muted');
                                        return (
                                            <tr key={row.id}>
                                                <td className="cell-strong" data-label="Doctor">{row.doctorName}</td>
                                                <td className="nowrap" data-label="Date">{friendlyDay(row.date, data.today)}</td>
                                                <td data-label="Booked"><span className={`badge ${tone}`}>{booked} of {total}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : <div className="empty-state"><p>No upcoming sessions.</p></div>}
                </section>
            </div>

            <section className="panel" id="account">
                <div className="panel__head">
                    <div>
                        <h2 className="panel__title">Your account</h2>
                        <p className="panel__sub">Signed in as {data.email}</p>
                    </div>
                </div>

                {notice && <Notice type={notice[0]}>{notice[1]}</Notice>}

                <p className="panel__label">Change password</p>
                <form onSubmit={changePassword}>
                    <div className="form-grid form-grid--3">
                        <div className="field">
                            <label htmlFor="old-password">Current password</label>
                            <input type="password" id="old-password" value={form.current} onChange={set('current')} required autoComplete="current-password" />
                        </div>
                        <div className="field">
                            <label htmlFor="new-password">New password</label>
                            <input type="password" id="new-password" value={form.password} onChange={set('password')} required minLength={6} autoComplete="new-password" />
                        </div>
                        <div className="field">
                            <label htmlFor="confirm-password">Confirm new password</label>
                            <input type="password" id="confirm-password" value={form.confirm} onChange={set('confirm')} required minLength={6} autoComplete="new-password" />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={busy}>Update password</button>
                </form>
            </section>
        </AdminShell>
    );
}
