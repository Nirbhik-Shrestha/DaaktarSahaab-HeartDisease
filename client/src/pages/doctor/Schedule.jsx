import { useState } from 'react';
import { Page, PageHero, Notice, Loading, LoadError } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { dayLong, timeRange, today } from '../../lib/format.js';
import { MAX_SLOTS_PER_SESSION } from '@shared/constants.js';

const range = (row) => (row.totalSlots ? timeRange(row.start, row.end) : null);

function BookedBadge({ row }) {
    const { totalSlots: total, bookedSlots: booked } = row;
    if (total === 0) return <span className="badge badge-muted">&mdash;</span>;
    if (booked === total) return <span className="badge badge-info">Fully booked</span>;
    if (booked > 0) return <span className="badge badge-success">{booked} of {total} booked</span>;
    return <span className="badge badge-muted">0 of {total} booked</span>;
}

export default function Schedule() {
    usePageTitle('My Sessions - DaaktarSahab');
    const { data, error, reload } = useApi('/doctor/sessions');
    const [form, setForm] = useState({ date: '', startTime: '', slots: '' });
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const now = today();
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    async function add(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await api.post('/doctor/sessions', form);
            setForm({ date: '', startTime: '', slots: '' });
            setNotice({ type: 'ok', text: 'Session added. Patients can book it now.' });
            await reload();
        } catch (err) {
            setNotice({ type: 'bad', title: 'This session could not be added:', items: err.messages });
        } finally {
            setBusy(false);
        }
    }

    async function remove(id) {
        if (!window.confirm('Remove this session?')) return;
        try {
            await api.del(`/doctor/sessions/${id}`);
            setNotice({ type: 'ok', text: 'Session removed.' });
        } catch (err) {
            setNotice({ type: 'bad', text: err.message });
        }
        reload();
    }

    return (
        <Page header="doctor" page="pg-doctor-schedule">
            <PageHero eyebrow="Schedules" title="Your sessions" doctor>
                Add the days and hours you are available. Each session is split into one-hour slots that patients can book.
            </PageHero>

            <main className="page-body">
                {notice && <Notice type={notice.type} title={notice.title} items={notice.items}>{notice.text}</Notice>}

                <section className="panel">
                    <div className="panel__head">
                        <div>
                            <h2 className="panel__title">Add a session</h2>
                            <p className="panel__sub">One session per day, up to {MAX_SLOTS_PER_SESSION} one-hour slots, finishing by midnight.</p>
                        </div>
                    </div>
                    <form onSubmit={add} className="session-form">
                        <div className="field">
                            <label htmlFor="sdate">Date</label>
                            <input type="date" id="sdate" min={now} value={form.date} onChange={set('date')} required />
                        </div>
                        <div className="field">
                            <label htmlFor="stime">Start time</label>
                            <input type="time" id="stime" value={form.startTime} onChange={set('startTime')} required />
                        </div>
                        <div className="field">
                            <label htmlFor="nop">Number of slots</label>
                            <input type="number" id="nop" min={1} max={MAX_SLOTS_PER_SESSION} placeholder="e.g. 4" value={form.slots} onChange={set('slots')} required />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={busy}>Add session</button>
                    </form>
                </section>

                {error && !data && <LoadError error={error} />}
                {!data && !error && <Loading />}
                {data && (
                    <>
                        <section className="panel">
                            <div className="panel__head">
                                <div>
                                    <h2 className="panel__title">Upcoming sessions</h2>
                                    <p className="panel__sub">{data.upcoming.length} from today onwards</p>
                                </div>
                            </div>
                            {data.upcoming.length ? (
                                <div className="table-scroll">
                                    <table className="data-table stack">
                                        <thead><tr><th>Date</th><th>Time</th><th>Booked</th><th /></tr></thead>
                                        <tbody>
                                            {data.upcoming.map((row) => (
                                                <tr key={row.id}>
                                                    <td className="cell-strong nowrap" data-label="Date">{row.date === now ? 'Today' : dayLong(row.date)}</td>
                                                    <td data-label="Time">{range(row) || <span className="cell-muted">No time slots</span>}</td>
                                                    <td data-label="Booked"><BookedBadge row={row} /></td>
                                                    <td>
                                                        {row.bookedSlots > 0
                                                            // Patients rely on this session; removing it would silently drop their bookings.
                                                            ? <span className="cell-muted">Has bookings</span>
                                                            : <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(row.id)}>Remove</button>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state"><p>No upcoming sessions. Add one above so patients can book you.</p></div>
                            )}
                        </section>

                        <section className="panel">
                            <div className="panel__head">
                                <div>
                                    <h2 className="panel__title">Past sessions</h2>
                                    <p className="panel__sub">Most recent first.</p>
                                </div>
                            </div>
                            {data.past.length ? (
                                <div className="table-scroll">
                                    <table className="data-table stack">
                                        <thead><tr><th>Date</th><th>Time</th><th>Booked</th></tr></thead>
                                        <tbody>
                                            {data.past.map((row) => (
                                                <tr key={row.id}>
                                                    <td className="cell-strong nowrap" data-label="Date">{dayLong(row.date)}</td>
                                                    <td data-label="Time">{range(row) || <span className="cell-muted">No time slots</span>}</td>
                                                    <td data-label="Booked">{row.bookedSlots} of {row.totalSlots}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state"><p>No past sessions.</p></div>
                            )}
                        </section>
                    </>
                )}
            </main>
        </Page>
    );
}
