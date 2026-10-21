import { Link, Navigate, useLocation } from 'react-router';
import { Page, PageHero } from '../../components/Layout.jsx';
import { usePageTitle } from '../../lib/hooks.js';
import { dayFull, clock } from '../../lib/format.js';

export default function BookingComplete() {
    const result = useLocation().state?.result;
    usePageTitle(`${result?.ok ? 'Appointment Booked' : 'Booking Not Completed'} - DaaktarSahab`);

    // Opened directly (or after a refresh): nothing to report.
    if (!result) return <Navigate to="/patient/appointments" replace />;

    const booked = result.appointment;
    return (
        <Page header="patient" page="pg-booking">
            <PageHero eyebrow="Booking" title={result.ok ? 'You are booked in' : 'Booking not completed'}>
                {result.ok
                    ? 'Your appointment is confirmed. You can find it any time under My Appointments.'
                    : 'Nothing was booked. You can pick another slot or session.'}
            </PageHero>

            <main className="page-body">
                <section className="panel result-panel">
                    {result.ok ? (
                        <>
                            <div className="result-icon ok" aria-hidden="true">&#10003;</div>
                            <h2>Appointment booked</h2>
                            <p>Want the doctor to see your heart check before the visit? You can share it from My Appointments.</p>
                            <ul className="detail-list">
                                <li><span>Doctor</span><strong>Dr. {booked.doctorName}</strong></li>
                                <li><span>Specialty</span><strong>{booked.specialty}</strong></li>
                                <li><span>Date</span><strong>{dayFull(booked.date)}</strong></li>
                                <li><span>Time</span><strong>{clock(booked.start)} - {clock(booked.end)}</strong></li>
                            </ul>
                            <div className="btn-row">
                                <Link to="/patient/appointments" className="btn btn-primary">View my appointments</Link>
                                <Link to="/patient/schedule" className="btn btn-light">Back to sessions</Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="result-icon bad" aria-hidden="true">!</div>
                            <h2>We couldn't book that slot</h2>
                            <p>{result.error}</p>
                            <div className="btn-row">
                                <Link to="/patient/schedule" className="btn btn-primary">Back to sessions</Link>
                                <Link to="/patient/appointments" className="btn btn-light">My appointments</Link>
                            </div>
                        </>
                    )}
                </section>
            </main>
        </Page>
    );
}
