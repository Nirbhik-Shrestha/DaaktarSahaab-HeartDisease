import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { Page, PageHero, Notice, Loading, LoadError } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { dayLong, dayMonth, timeRange, today } from '../../lib/format.js';

/** Status badge; a past visit still "booked" is waiting for the doctor. */
function StatusBadge({ row, now }) {
    if (row.status === 'completed') return <span className="badge badge-success">&#10003; Completed</span>;
    if (row.status === 'no_show') return <span className="badge badge-danger">&#10007; No-show</span>;
    return row.date < now
        ? <span className="badge badge-warning">Needs update</span>
        : <span className="badge badge-info">Booked</span>;
}

function Rows({ rows, now }) {
    return rows.map((row) => {
        const needsRecord = row.status === 'booked' && !(row.doctorNotes || '').trim();
        return (
            <tr key={row.id}>
                <td className="cell-strong" data-label="Patient">{row.patientName}</td>
                <td className="nowrap" data-label="Date & time">
                    <div><span className="cell-strong">{row.date === now ? 'Today' : dayLong(row.date)}</span><br />
                        <span className="cell-muted">{timeRange(row.start, row.end)}</span></div>
                </td>
                <td data-label="Heart check">
                    {row.sharedReadingId
                        ? <Link className="btn btn-light btn-sm" to={`/doctor/appointments/${row.id}/assessment`}>View shared check</Link>
                        : <span className="cell-muted">Not shared</span>}
                </td>
                <td data-label="Status"><StatusBadge row={row} now={now} /></td>
                <td>
                    <div className="row-actions">
                        {row.date > now ? (
                            <span className="cell-muted">Record from {dayMonth(row.date)}</span>
                        ) : (
                            <Link className={`btn ${needsRecord ? 'btn-primary' : 'btn-light'} btn-sm`} to={`/doctor/appointments/${row.id}`}>
                                {needsRecord ? 'Record visit' : 'View / edit notes'}
                            </Link>
                        )}
                        {row.conversationId && (
                            <Link className="btn btn-light btn-sm" to={`/doctor/messages?cid=${row.conversationId}`}>Message patient</Link>
                        )}
                    </div>
                </td>
            </tr>
        );
    });
}

const HEAD = <tr><th>Patient</th><th>Date &amp; time</th><th>Heart check</th><th>Status</th><th /></tr>;

export default function Appointments() {
    usePageTitle('My Appointments - DaaktarSahab');
    const location = useLocation();
    const { data, error } = useApi('/doctor/appointments');
    const now = today();
    const saved = location.state?.saved;

    // The dashboard's "Record visits" link points at #past.
    useEffect(() => {
        if (data && location.hash === '#past') document.getElementById('past')?.scrollIntoView();
    }, [data, location.hash]);

    return (
        <Page header="doctor" page="pg-doctor-appointments">
            <PageHero eyebrow="My appointments" title="Your appointments" doctor>
                See who is booked with you, open heart checks they have shared, and record each visit afterwards.
            </PageHero>

            <main className="page-body">
                {saved && <Notice type="ok">Consultation saved. The patient can now see your notes.</Notice>}
                {error && !data && <LoadError error={error} />}
                {!data && !error && <Loading />}

                {data && (
                    <>
                        <section className="panel">
                            <div className="panel__head">
                                <div>
                                    <h2 className="panel__title">Today and upcoming</h2>
                                    <p className="panel__sub">{data.upcoming.length} {data.upcoming.length === 1 ? 'appointment' : 'appointments'}</p>
                                </div>
                                <Link to="/doctor/schedule" className="btn btn-light btn-sm">Manage sessions</Link>
                            </div>
                            {data.upcoming.length ? (
                                <div className="table-scroll">
                                    <table className="data-table stack">
                                        <thead>{HEAD}</thead>
                                        <tbody><Rows rows={data.upcoming} now={now} /></tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>No upcoming appointments.</p>
                                    <Link to="/doctor/schedule" className="btn btn-light">Add a session</Link>
                                </div>
                            )}
                        </section>

                        <section className="panel" id="past">
                            <div className="panel__head">
                                <div>
                                    <h2 className="panel__title">Past appointments</h2>
                                    <p className="panel__sub">Mark each visit as completed or no-show, and add notes for the patient.</p>
                                </div>
                            </div>
                            {data.past.length ? (
                                <div className="table-scroll">
                                    <table className="data-table stack">
                                        <thead>{HEAD}</thead>
                                        <tbody><Rows rows={data.past} now={now} /></tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state"><p>No past appointments yet.</p></div>
                            )}
                        </section>
                    </>
                )}
            </main>
        </Page>
    );
}
