import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import AdminShell from '../../components/AdminShell.jsx';
import { Notice, Loading } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { clock, friendlyDay } from '../../lib/format.js';

export default function Sessions() {
    usePageTitle('Sessions - DaaktarSahab Admin');
    const location = useLocation();
    const { data, reload } = useApi('/admin/sessions');
    const [notice, setNotice] = useState(location.state?.added ? ['ok', 'Session added. Patients can book it now.'] : null);
    const sessions = data?.sessions || [];

    // Allowed even with bookings (doctors are told to ask the admin); the
    // session's appointments are cancelled with it.
    async function remove(row) {
        let warning = `Remove this session with ${row.doctorName}?`;
        if (row.bookedSlots > 0) {
            warning += ` ${row.bookedSlots} ${row.bookedSlots === 1 ? 'booked appointment' : 'booked appointments'} will be cancelled too.`;
        }
        if (!window.confirm(warning)) return;
        try {
            await api.del(`/admin/sessions/${row.id}`);
            setNotice(['ok', 'Session removed.']);
        } catch (err) {
            setNotice(['bad', err.message]);
        }
        reload();
    }

    return (
        <AdminShell>
            <div className="admin-head">
                <div>
                    <h1>Sessions</h1>
                    <p>{data ? sessions.length : ''} upcoming, from today onwards. Past sessions are under <Link to="/admin/logs">Logs</Link>.</p>
                </div>
                <Link className="btn btn-primary" to="/admin/sessions/new">Add session</Link>
            </div>

            {notice && <Notice type={notice[0]}>{notice[1]}</Notice>}

            <section className="panel">
                {!data ? <Loading /> : sessions.length ? (
                    <div className="table-scroll">
                        <table className="data-table stack">
                            <thead><tr><th>Doctor</th><th>Date</th><th>Time</th><th>Booked</th><th /></tr></thead>
                            <tbody>
                                {sessions.map((row) => {
                                    const { totalSlots: total, bookedSlots: booked } = row;
                                    return (
                                        <tr key={row.id}>
                                            <td className="cell-strong" data-label="Doctor">{row.doctorName}</td>
                                            <td className="nowrap" data-label="Date">{friendlyDay(row.date, data.today)}</td>
                                            <td className="nowrap" data-label="Time">
                                                {total > 0 ? <>{clock(row.start)} &ndash; {clock(row.end)}</> : <span className="cell-muted">No time slots</span>}
                                            </td>
                                            <td data-label="Booked">
                                                {total > 0 && booked === total
                                                    ? <span className="badge badge-info">Fully booked</span>
                                                    : <span className={`badge ${booked > 0 ? 'badge-success' : 'badge-muted'}`}>{booked} of {total} booked</span>}
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(row)}>Remove</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>No upcoming sessions.</p>
                        <Link className="btn btn-primary" to="/admin/sessions/new">Add a session</Link>
                    </div>
                )}
            </section>
        </AdminShell>
    );
}
