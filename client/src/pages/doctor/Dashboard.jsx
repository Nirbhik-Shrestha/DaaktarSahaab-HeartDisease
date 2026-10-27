import { Link } from 'react-router';
import { Page, Loading } from '../../components/Layout.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { clock, dayFull, dayMedium, dayShort, timeRange } from '../../lib/format.js';

export default function Dashboard() {
    usePageTitle('Doctor Dashboard - DaaktarSahab');
    const { user } = useAuth();
    const { data } = useApi('/doctor/dashboard');

    return (
        <Page header="doctor" page="pg-doctor-home">
            <section className="doctor-hero">
                <div className="doctor-hero__inner">
                    <span className="page-hero__eyebrow">Doctor dashboard</span>
                    <h1>Welcome, <span>Dr. {user?.name}</span></h1>
                    <p>{data ? `Today is ${dayFull(data.today)}. Here is your overview.` : 'Here is your overview.'}</p>
                    <div className="btn-row">
                        <Link to="/doctor/appointments" className="btn btn-primary">My appointments</Link>
                        <Link to="/doctor/schedule" className="btn btn-light">Add a session</Link>
                    </div>
                </div>
            </section>

            <main className="page-body">
                {!data ? <Loading /> : (
                    <>
                        <div className="stat-grid">
                            <div className="stat-card">
                                <p className="panel__label">Today</p>
                                <p className="stat-number">{data.todayVisits.length}</p>
                                <p className="stat-text">
                                    {data.todayVisits.length ? (
                                        <>
                                            {data.todayVisits.length === 1 ? 'appointment' : 'appointments'} today. Next:{' '}
                                            <strong>{data.todayVisits[0].patientName}</strong> at {clock(data.todayVisits[0].start)}.
                                        </>
                                    ) : 'No appointments today.'}
                                </p>
                                <Link className="stat-link" to="/doctor/appointments">View appointments</Link>
                            </div>

                            <div className={`stat-card${data.needsUpdate > 0 ? ' is-attention' : ''}`}>
                                <p className="panel__label">Needs your update</p>
                                <p className="stat-number">{data.needsUpdate}</p>
                                <p className="stat-text">
                                    {data.needsUpdate > 0
                                        ? `${data.needsUpdate === 1 ? 'past visit is' : 'past visits are'} not yet marked completed or no-show.`
                                        : 'All your past visits are recorded.'}
                                </p>
                                <Link className="stat-link" to="/doctor/appointments#past">Record visits</Link>
                            </div>

                            <div className="stat-card">
                                <p className="panel__label">Your sessions</p>
                                <p className="stat-number">{data.sessionCount}</p>
                                <p className="stat-text">
                                    {data.sessionCount > 0
                                        ? `upcoming ${data.sessionCount === 1 ? 'session' : 'sessions'}, with ${data.freeSlots} open ${data.freeSlots === 1 ? 'slot' : 'slots'} for patients to book.`
                                        : 'No upcoming sessions. Add one so patients can book you.'}
                                </p>
                                <Link className="stat-link" to="/doctor/schedule">Manage sessions</Link>
                            </div>
                        </div>

                        <div className="page-grid">
                            <section className="panel">
                                <div className="panel__head">
                                    <div>
                                        <h2 className="panel__title">Next appointments</h2>
                                        <p className="panel__sub">{data.upcomingCount} booked from today onwards</p>
                                    </div>
                                    <Link to="/doctor/appointments" className="btn btn-light btn-sm">View all</Link>
                                </div>

                                {data.nextVisits.length ? (
                                    <div className="table-scroll">
                                        <table className="data-table stack">
                                            <thead>
                                                <tr><th>Patient</th><th>Date &amp; time</th><th>Heart check</th></tr>
                                            </thead>
                                            <tbody>
                                                {data.nextVisits.map((row) => (
                                                    <tr key={row.id}>
                                                        <td className="cell-strong" data-label="Patient">{row.patientName}</td>
                                                        <td className="nowrap" data-label="Date & time">
                                                            <div>
                                                                <span className="cell-strong">{row.date === data.today ? 'Today' : dayShort(row.date)}</span><br />
                                                                <span className="cell-muted">{timeRange(row.start, row.end)}</span>
                                                            </div>
                                                        </td>
                                                        <td data-label="Heart check">
                                                            {row.sharedReadingId
                                                                ? <Link className="btn btn-light btn-sm" to={`/doctor/appointments/${row.id}/assessment`}>View shared check</Link>
                                                                : <span className="badge badge-muted">Not shared</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <p>No upcoming appointments yet.</p>
                                        <Link to="/doctor/schedule" className="btn btn-light">Add a session</Link>
                                    </div>
                                )}
                            </section>

                            <aside className="panel">
                                <p className="panel__label">Your patients</p>
                                <p className="stat-number">{data.patients.length}</p>
                                <p className="stat-text" style={{ marginBottom: 12 }}>{data.patients.length === 1 ? 'patient has' : 'patients have'} booked with you.</p>
                                {data.patients.length > 0 && (
                                    <ul className="patient-list">
                                        {data.patients.slice(0, 5).map((p) => (
                                            <li key={p.id}>
                                                <strong>{p.name}</strong>
                                                <span>{dayMedium(p.lastVisit)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <Link className="btn btn-light btn-sm btn-block" style={{ marginTop: 14 }} to="/doctor/patients">View all patients</Link>
                            </aside>
                        </div>
                    </>
                )}
            </main>
        </Page>
    );
}
