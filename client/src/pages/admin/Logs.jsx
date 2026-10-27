import AdminShell, { AppointmentStatus } from '../../components/AdminShell.jsx';
import { Loading } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { clock, friendlyDay } from '../../lib/format.js';

export default function Logs() {
    usePageTitle('Logs - DaaktarSahab Admin');
    const { data } = useApi('/admin/logs');

    if (!data) return <AdminShell><Loading /></AdminShell>;
    const notRecorded = data.appointments.filter((a) => a.status === 'booked').length;

    return (
        <AdminShell>
            <div className="admin-head">
                <div>
                    <h1>Logs</h1>
                    <p>Sessions and appointments before today, most recent first.</p>
                </div>
            </div>

            <section className="panel">
                <div className="panel__head">
                    <div>
                        <h2 className="panel__title">Past appointments</h2>
                        <p className="panel__sub">
                            {data.appointments.length} in total{notRecorded > 0 && `, ${notRecorded} not yet recorded by the doctor`}
                        </p>
                    </div>
                </div>
                {data.appointments.length ? (
                    <div className="table-scroll">
                        <table className="data-table stack">
                            <thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                            <tbody>
                                {data.appointments.map((row) => (
                                    <tr key={row.id}>
                                        <td className="cell-strong" data-label="Patient">{row.patientName}</td>
                                        <td data-label="Doctor">{row.doctorName}</td>
                                        <td className="nowrap" data-label="Date">{friendlyDay(row.date, data.today)}</td>
                                        <td className="nowrap" data-label="Time">{clock(row.start)}</td>
                                        <td data-label="Status"><AppointmentStatus status={row.status} date={row.date} today={data.today} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <div className="empty-state"><p>No past appointments.</p></div>}
            </section>

            <section className="panel">
                <div className="panel__head">
                    <div>
                        <h2 className="panel__title">Past sessions</h2>
                        <p className="panel__sub">{data.sessions.length} in total</p>
                    </div>
                </div>
                {data.sessions.length ? (
                    <div className="table-scroll">
                        <table className="data-table stack">
                            <thead><tr><th>Doctor</th><th>Date</th><th>Time</th><th>Booked</th></tr></thead>
                            <tbody>
                                {data.sessions.map((row) => (
                                    <tr key={row.id}>
                                        <td className="cell-strong" data-label="Doctor">{row.doctorName}</td>
                                        <td className="nowrap" data-label="Date">{friendlyDay(row.date, data.today)}</td>
                                        <td className="nowrap" data-label="Time">
                                            {row.totalSlots > 0 ? <>{clock(row.start)} &ndash; {clock(row.end)}</> : <span className="cell-muted">No time slots</span>}
                                        </td>
                                        <td data-label="Booked">{row.bookedSlots} of {row.totalSlots}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <div className="empty-state"><p>No past sessions.</p></div>}
            </section>
        </AdminShell>
    );
}
