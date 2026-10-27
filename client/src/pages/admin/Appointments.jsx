import { Link } from 'react-router';
import AdminShell, { AppointmentStatus } from '../../components/AdminShell.jsx';
import { Loading } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { clock, friendlyDay } from '../../lib/format.js';

export default function Appointments() {
    usePageTitle('Appointments - DaaktarSahab Admin');
    const { data } = useApi('/admin/appointments');
    const rows = data?.appointments || [];

    return (
        <AdminShell>
            <div className="admin-head">
                <div>
                    <h1>Appointments</h1>
                    <p>{data ? rows.length : ''} upcoming, from today onwards. Past appointments are under <Link to="/admin/logs">Logs</Link>.</p>
                </div>
            </div>

            <section className="panel">
                {!data ? <Loading /> : rows.length ? (
                    <div className="table-scroll">
                        <table className="data-table stack">
                            <thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id}>
                                        <td className="cell-strong" data-label="Patient">{row.patientName}</td>
                                        <td data-label="Doctor">
                                            <span>{row.doctorName}<br /><span className="cell-muted">{row.specialty}</span></span>
                                        </td>
                                        <td className="nowrap" data-label="Date">{friendlyDay(row.date, data.today)}</td>
                                        <td className="nowrap" data-label="Time">{clock(row.start)} &ndash; {clock(row.end)}</td>
                                        <td data-label="Status"><AppointmentStatus status={row.status} date={row.date} today={data.today} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state"><p>No upcoming appointments.</p></div>
                )}
            </section>
        </AdminShell>
    );
}
