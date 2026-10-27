/**
 * Record what happened at an appointment: its status (completed / no-show)
 * and consultation notes, which the patient sees on their appointments page.
 * Only from the appointment's own date onwards.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Page, PageHero, Notice, Loading } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { dayFull, dayLong, dayMedium, stampDateTime, timeRange } from '../../lib/format.js';
import { MAX_NOTES_LENGTH } from '@shared/constants.js';

const STATUSES = [
    ['booked', 'Not recorded yet'],
    ['completed', 'Completed'],
    ['no_show', 'No-show (patient did not attend)'],
];

export default function Consultation() {
    usePageTitle('Consultation - DaaktarSahab');
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, error } = useApi(`/doctor/appointments/${id}`);
    const [status, setStatus] = useState('booked');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState([]);
    const [busy, setBusy] = useState(false);
    const appointment = data?.appointment;

    useEffect(() => {
        if (appointment) {
            setStatus(appointment.status);
            setNotes(appointment.doctorNotes || '');
        }
    }, [appointment]);

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await api.put(`/doctor/appointments/${id}`, { status, notes });
            navigate('/doctor/appointments', { state: { saved: true } });
        } catch (err) {
            setErrors(err.messages);
            setBusy(false);
        }
    }

    let content;
    if (error) {
        content = (
            <section className="panel">
                <div className="empty-state">
                    <p>No appointment was found in your schedule with that reference.</p>
                    <Link to="/doctor/appointments" className="btn btn-light">Back to appointments</Link>
                </div>
            </section>
        );
    } else if (!appointment) {
        content = <Loading />;
    } else {
        content = (
            <>
                {errors.length > 0 && <Notice type="bad" title="Not saved:" items={errors} />}
                <div className="page-grid">
                    <section className="panel">
                        <div className="panel__head">
                            <h2 className="panel__title">Visit record</h2>
                        </div>

                        {!appointment.canRecord ? (
                            <div className="empty-state">
                                <p>This appointment is on {dayFull(appointment.date)}. You can record the visit from that day.</p>
                                <Link to="/doctor/appointments" className="btn btn-light">Back to appointments</Link>
                            </div>
                        ) : (
                            <form onSubmit={submit}>
                                <div className="field">
                                    <label htmlFor="status">Status</label>
                                    <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} required>
                                        {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </div>

                                <div className="field">
                                    <label htmlFor="doctor_notes">Consultation notes</label>
                                    <textarea id="doctor_notes" maxLength={MAX_NOTES_LENGTH} value={notes} onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Findings, advice, prescriptions, tests to arrange, follow-up..." />
                                    <p className="hint">The patient can read these notes on their appointments page.</p>
                                    {appointment.notesUpdatedAt && <p className="hint">Last updated {stampDateTime(appointment.notesUpdatedAt)}.</p>}
                                </div>

                                <div className="btn-row">
                                    <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
                                    <Link to="/doctor/appointments" className="btn btn-light">Cancel</Link>
                                </div>
                            </form>
                        )}
                    </section>

                    <aside className="panel">
                        <p className="panel__label">Appointment</p>
                        <ul className="detail-list">
                            <li><span>Patient</span><strong>{appointment.patientName}</strong></li>
                            <li><span>Date of birth</span><strong>{appointment.patientDob ? dayMedium(appointment.patientDob) : '—'}</strong></li>
                            <li><span>Date</span><strong>{dayLong(appointment.date)}</strong></li>
                            <li><span>Time</span><strong>{timeRange(appointment.start, appointment.end)}</strong></li>
                        </ul>
                        <div style={{ marginTop: 16 }}>
                            {appointment.sharedReadingId
                                ? <Link className="btn btn-light btn-block" to={`/doctor/appointments/${appointment.id}/assessment`}>View shared heart check</Link>
                                : <span className="badge badge-muted">Heart check not shared by the patient</span>}
                            {appointment.conversationId && (
                                <Link className="btn btn-light btn-block" style={{ marginTop: 10 }} to={`/doctor/messages?cid=${appointment.conversationId}`}>Message patient</Link>
                            )}
                        </div>
                    </aside>
                </div>
            </>
        );
    }

    return (
        <Page header="doctor" page="pg-consultation">
            <PageHero eyebrow="Consultation" title={appointment ? 'Record the visit' : 'Consultation'} doctor>
                Mark whether the visit took place and write notes. The patient can read your notes on their appointments page.
            </PageHero>
            <main className="page-body">{content}</main>
        </Page>
    );
}
