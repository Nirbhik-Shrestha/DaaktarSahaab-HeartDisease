import { useState } from 'react';
import { Link } from 'react-router';
import { Page, PageHero, Notice, Loading, LoadError } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { dayLong, timeRange, stampDate } from '../../lib/format.js';

function DoctorCell({ row }) {
    return (
        <td data-label="Doctor">
            <div><span className="cell-strong">Dr. {row.doctorName}</span><br />
                <span className="cell-muted">{row.specialty}</span></div>
        </td>
    );
}

function WhenCell({ row }) {
    return (
        <td className="nowrap" data-label="Date & time">
            <div><span className="cell-strong">{dayLong(row.date)}</span><br />
                <span className="cell-muted">{timeRange(row.start, row.end)}</span></div>
        </td>
    );
}

function ShareForm({ row, readings, onShare, busy }) {
    const [readingId, setReadingId] = useState('');
    return (
        <form className="share-form" onSubmit={(e) => { e.preventDefault(); onShare(row.id, readingId); }}>
            <select value={readingId} onChange={(e) => setReadingId(e.target.value)} required aria-label="Heart check to share">
                <option value="" disabled hidden>Choose a reading</option>
                {readings.map((r) => <option key={r.id} value={r.id}>{stampDate(r.takenAt)}</option>)}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Share</button>
        </form>
    );
}

export default function Appointments() {
    usePageTitle('My Appointments - DaaktarSahab');
    const { data, error, reload } = useApi('/patient/appointments');
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);

    async function act(request, success) {
        setBusy(true);
        try {
            await request();
            setNotice(['ok', success]);
        } catch (err) {
            setNotice(['bad', err.message]);
        }
        await reload();
        setBusy(false);
        window.scrollTo(0, 0);
    }

    const share = (id, readingId) => act(() => api.post(`/patient/appointments/${id}/share`, { readingId }),
        'Your heart assessment is now visible to that doctor.');
    const unshare = (id) => act(() => api.del(`/patient/appointments/${id}/share`),
        'Your heart assessment is no longer shared with that doctor.');
    const cancel = (id) => {
        if (!window.confirm('Cancel this appointment? The time slot will be released for other patients.')) return;
        act(() => api.del(`/patient/appointments/${id}`), 'Your appointment was cancelled and the timeslot is free again.');
    };

    const upcoming = data?.upcoming || [];
    const past = data?.past || [];
    const unshared = data?.unsharedReadings || [];

    return (
        <Page header="patient" page="pg-patient-appointments">
            <PageHero eyebrow="My appointments" title="Your appointments">
                Share a heart check with your doctor before a visit, and read their notes afterwards.
            </PageHero>

            <main className="page-body">
                {notice && <Notice type={notice[0]}>{notice[1]}</Notice>}
                {error && !data && <LoadError error={error} />}
                {!data && !error && <Loading />}

                {data && (
                    <>
                        <section className="panel">
                            <div className="panel__head">
                                <div>
                                    <h2 className="panel__title">Upcoming</h2>
                                    <p className="panel__sub">{upcoming.length} {upcoming.length === 1 ? 'appointment' : 'appointments'}</p>
                                </div>
                                <Link to="/patient/schedule" className="btn btn-primary btn-sm">+ Book an appointment</Link>
                            </div>

                            {upcoming.length ? (
                                <div className="table-scroll">
                                    <table className="data-table stack">
                                        <thead>
                                            <tr><th>Doctor</th><th>Date &amp; time</th><th>Heart check</th><th /></tr>
                                        </thead>
                                        <tbody>
                                            {upcoming.map((row) => (
                                                <tr key={row.id}>
                                                    <DoctorCell row={row} />
                                                    <WhenCell row={row} />
                                                    <td data-label="Heart check">
                                                        {row.sharedReadingId ? (
                                                            <div className="shared">
                                                                <span className="badge badge-success">&#10003; Shared</span>
                                                                <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => unshare(row.id)}>Stop sharing</button>
                                                            </div>
                                                        ) : unshared.length ? (
                                                            <ShareForm row={row} readings={unshared} onShare={share} busy={busy} />
                                                        ) : (
                                                            <span className="cell-muted">No reading yet &mdash; <Link to="/patient/heart-check">take the check</Link></span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div className="row-actions">
                                                            {row.conversationId && (
                                                                <Link to={`/patient/messages?cid=${row.conversationId}`} className="btn btn-light btn-sm">Message doctor</Link>
                                                            )}
                                                            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => cancel(row.id)}>Cancel</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>You have no upcoming appointments.</p>
                                    <Link to="/patient/schedule" className="btn btn-primary">Browse available sessions</Link>
                                </div>
                            )}
                        </section>

                        <section className="panel">
                            <div className="panel__head">
                                <div>
                                    <h2 className="panel__title">Past</h2>
                                    <p className="panel__sub">Visits your doctor has recorded, with their notes.</p>
                                </div>
                            </div>

                            {past.length ? (
                                <div className="table-scroll">
                                    <table className="data-table stack">
                                        <thead>
                                            <tr><th>Doctor</th><th>Date &amp; time</th><th>Status</th><th>Doctor's notes</th><th /></tr>
                                        </thead>
                                        <tbody>
                                            {past.map((row) => (
                                                <tr key={row.id}>
                                                    <DoctorCell row={row} />
                                                    <WhenCell row={row} />
                                                    <td data-label="Status">
                                                        {row.status === 'completed' ? <span className="badge badge-success">&#10003; Completed</span>
                                                            : row.status === 'no_show' ? <span className="badge badge-danger">&#10007; Missed</span>
                                                                : <span className="badge badge-muted">Not recorded</span>}
                                                    </td>
                                                    <td className="notes-cell" data-label="Notes">
                                                        {(row.doctorNotes || '').trim() ? (
                                                            <details>
                                                                <summary>Read notes</summary>
                                                                <div className="doctor-notes">{row.doctorNotes}</div>
                                                                {row.notesUpdatedAt && (
                                                                    <div className="cell-muted notes-date">Updated {stampDate(row.notesUpdatedAt)}</div>
                                                                )}
                                                            </details>
                                                        ) : <span className="cell-muted">&mdash;</span>}
                                                    </td>
                                                    <td>
                                                        {row.conversationId && (
                                                            <div className="row-actions">
                                                                <Link to={`/patient/messages?cid=${row.conversationId}`} className="btn btn-light btn-sm">Message doctor</Link>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
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
