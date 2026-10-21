import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Page, PageHero, Loading, LoadError } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { dayLong } from '../../lib/format.js';

function Availability({ total, free }) {
    if (total === 0) return <span className="badge badge-muted">No time slots</span>;
    if (free === 0) return <span className="badge badge-muted">Fully booked</span>;
    return <span className={`badge ${free <= 2 ? 'badge-warning' : 'badge-success'}`}>{free} of {total} left</span>;
}

export default function Schedule() {
    usePageTitle('Available Sessions - DaaktarSahab');
    // Optional filters: one doctor (from the Doctors page) and/or a search
    // over doctor name, specialty or date.
    const [params, setParams] = useSearchParams();
    const doctorId = params.get('doctor') || '';
    const keyword = (params.get('search') || '').trim();
    const [text, setText] = useState(keyword);
    useEffect(() => setText(keyword), [keyword]);

    const query = new URLSearchParams();
    if (doctorId) query.set('doctor', doctorId);
    if (keyword) query.set('search', keyword);
    const { data, error } = useApi(`/patient/sessions?${query}`);
    const sessions = data?.sessions || [];
    const doctorName = data?.doctorName;

    function search(e) {
        e.preventDefault();
        const next = {};
        if (doctorId) next.doctor = doctorId;
        if (text.trim()) next.search = text.trim();
        setParams(next);
    }

    return (
        <Page header="patient">
            <PageHero eyebrow="Schedules" title={doctorName ? `Sessions with Dr. ${doctorName}` : 'Available sessions'}>
                Pick a session, then choose a one-hour time slot on the next page.
            </PageHero>

            <main className="page-body">
                <section className="panel">
                    <form onSubmit={search} className="search-bar" role="search">
                        <input type="text" value={text} onChange={(e) => setText(e.target.value)}
                            placeholder="Search by doctor, specialty or date (YYYY-MM-DD)" aria-label="Search sessions" />
                        <button type="submit" className="btn btn-primary">Search</button>
                        {(keyword || doctorId) && <Link to="/patient/schedule" className="btn btn-light">Show all</Link>}
                    </form>
                </section>

                {error ? <LoadError error={error} /> : (
                    <section className="panel">
                        <div className="panel__head">
                            <div>
                                <h2 className="panel__title">Upcoming sessions</h2>
                                <p className="panel__sub">{data ? `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} from today onwards` : ''}</p>
                            </div>
                        </div>

                        {!data ? <Loading /> : sessions.length ? (
                            <div className="table-scroll">
                                <table className="data-table stack">
                                    <thead>
                                        <tr><th>Doctor</th><th>Specialty</th><th>Date</th><th>Availability</th><th /></tr>
                                    </thead>
                                    <tbody>
                                        {sessions.map((row) => {
                                            const free = row.totalSlots - row.bookedSlots;
                                            return (
                                                <tr key={row.id}>
                                                    <td className="cell-strong" data-label="Doctor">Dr. {row.doctorName}</td>
                                                    <td data-label="Specialty">{row.specialty}</td>
                                                    <td data-label="Date">{dayLong(row.date)}</td>
                                                    <td data-label="Availability"><Availability total={row.totalSlots} free={free} /></td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {row.totalSlots > 0 && free > 0
                                                            ? <Link className="btn btn-primary btn-sm" to={`/patient/booking/${row.id}`}>Book</Link>
                                                            : <span className="btn btn-sm is-disabled">Unavailable</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>
                                    {keyword ? `No upcoming sessions match "${keyword}".`
                                        : doctorName ? `Dr. ${doctorName} has no upcoming sessions.`
                                            : 'There are no upcoming sessions right now.'}
                                </p>
                                <Link to="/patient/doctors" className="btn btn-light">Browse doctors</Link>
                            </div>
                        )}
                    </section>
                )}
            </main>
        </Page>
    );
}
