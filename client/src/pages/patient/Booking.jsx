import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Page, PageHero, Loading } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { dayFull, dayLong, timeRange } from '../../lib/format.js';

export default function Booking() {
    usePageTitle('Book an Appointment - DaaktarSahab');
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, error } = useApi(`/patient/sessions/${id}`);
    const [slotId, setSlotId] = useState('');
    const [busy, setBusy] = useState(false);
    const session = data?.session;

    async function book(e) {
        e.preventDefault();
        setBusy(true);
        let result;
        try {
            const res = await api.post('/patient/appointments', { slotId });
            result = { ok: true, appointment: res.appointment };
        } catch (err) {
            result = { ok: false, error: err.message };
        }
        navigate('/patient/booking-complete', { state: { result } });
    }

    let content;
    if (error) {
        content = (
            <section className="panel">
                <div className="empty-state">
                    <p>{error.message}</p>
                    <Link to="/patient/schedule" className="btn btn-light">Back to sessions</Link>
                </div>
            </section>
        );
    } else if (!session) {
        content = <Loading />;
    } else {
        // Booked slots stay visible but unselectable, so the session's real
        // size is obvious even when it is nearly full.
        const total = session.slots.length;
        const free = session.slots.filter((s) => !s.booked).length;
        content = (
            <div className="page-grid">
                <section className="panel">
                    <div className="panel__head">
                        <div>
                            <h2 className="panel__title">Choose a time slot</h2>
                            <p className="panel__sub">{dayFull(session.date)}</p>
                        </div>
                        {total > 0 && (
                            <span className={`badge ${free > 0 ? 'badge-success' : 'badge-muted'}`}>{free} of {total} available</span>
                        )}
                    </div>

                    {session.isPast ? (
                        <div className="empty-state">
                            <p>This session has already taken place.</p>
                            <Link to="/patient/schedule" className="btn btn-light">See upcoming sessions</Link>
                        </div>
                    ) : total === 0 ? (
                        <div className="empty-state">
                            <p>This session has no time slots yet.</p>
                            <Link to="/patient/schedule" className="btn btn-light">Back to sessions</Link>
                        </div>
                    ) : (
                        <form onSubmit={book}>
                            <div className="slot-grid">
                                {session.slots.map((slot) => (slot.booked ? (
                                    <div key={slot.id} className="slot slot-booked">
                                        <span className="slot-time">{timeRange(slot.start, slot.end)}</span>
                                        <span className="slot-state">Booked</span>
                                    </div>
                                ) : (
                                    <label key={slot.id} className="slot slot-free">
                                        <input type="radio" name="slot" value={slot.id} required
                                            checked={slotId === slot.id} onChange={() => setSlotId(slot.id)} />
                                        <span className="slot-time">{timeRange(slot.start, slot.end)}</span>
                                        <span className="slot-state">Available</span>
                                    </label>
                                )))}
                            </div>

                            {free > 0 ? (
                                <div className="btn-row">
                                    <button type="submit" className="btn btn-primary" disabled={busy}>Book this slot</button>
                                    <Link to="/patient/schedule" className="btn btn-light">Back to sessions</Link>
                                </div>
                            ) : (
                                <>
                                    <div className="notice notice-info">Every time slot in this session is booked. Please choose another session.</div>
                                    <Link to="/patient/schedule" className="btn btn-light">Back to sessions</Link>
                                </>
                            )}
                        </form>
                    )}
                </section>

                <aside className="panel">
                    <p className="panel__label">Session details</p>
                    <ul className="detail-list">
                        <li><span>Doctor</span><strong>Dr. {session.doctorName}</strong></li>
                        <li><span>Specialty</span><strong>{session.specialty}</strong></li>
                        <li><span>Email</span><strong>{session.doctorEmail}</strong></li>
                        <li><span>Date</span><strong>{dayLong(session.date)}</strong></li>
                        <li><span>Channelling fee</span><strong className="fee">NRs 2,000.00</strong></li>
                    </ul>
                </aside>
            </div>
        );
    }

    return (
        <Page header="patient" page="pg-booking">
            <PageHero eyebrow="Booking" title="Book an appointment">
                Choose a free one-hour slot in this session to book your visit.
            </PageHero>
            <main className="page-body">{content}</main>
        </Page>
    );
}
