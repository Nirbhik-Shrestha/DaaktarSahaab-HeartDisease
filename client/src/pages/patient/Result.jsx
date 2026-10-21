import { Link, Navigate, useParams } from 'react-router';
import { Page, PageHero, Notice, Loading } from '../../components/Layout.jsx';
import { RiskCard, ValuesList } from '../../components/Assessment.jsx';
import DoctorCard from '../../components/DoctorCard.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { stampDateTimeLong } from '../../lib/format.js';

export default function Result() {
    usePageTitle('Heart Check Result - DaaktarSahab');
    const { id } = useParams();
    const { data, error } = useApi(`/patient/readings/${id}`);
    const { data: cardio } = useApi('/patient/cardiologists');
    const reading = data?.reading;

    // Nothing to show; the history page lists the readings that do exist.
    if (error) return <Navigate to="/patient/history" replace />;

    return (
        <Page header="patient" page="pg-result">
            <PageHero eyebrow="Heart check result" title="Your heart check result">
                {reading ? `Taken on ${stampDateTimeLong(reading.takenAt)}.` : ''}
            </PageHero>

            <main className="page-body">
                {!reading ? <Loading /> : (
                    <div className="page-grid">
                        <div>
                            <section className="panel">
                                {reading.assessment
                                    ? <RiskCard assessment={reading.assessment} />
                                    : <Notice type="bad">The prediction model could not be run. Please try again later.</Notice>}

                                <Notice type="info" role="note">
                                    <strong>Medical disclaimer:</strong> this result comes from a statistical model and is not a diagnosis.
                                    It is not a substitute for professional medical advice. If you have concerns about your heart health,
                                    please see a qualified cardiologist.
                                </Notice>

                                <div className="btn-row">
                                    <a href={`/api/patient/readings/${reading.id}/pdf`} className="btn btn-primary">Download PDF</a>
                                    <Link to="/patient/heart-check" className="btn btn-light">Take another check</Link>
                                    <Link to="/patient/history" className="btn btn-light">View history</Link>
                                </div>
                            </section>

                            <section className="panel">
                                <div className="panel__head">
                                    <div>
                                        <h2 className="panel__title">Recommended cardiologists</h2>
                                        <p className="panel__sub">Book a consultation to go through this result with a specialist.</p>
                                    </div>
                                    <Link to="/patient/doctors?search=Cardiologist" className="btn btn-light btn-sm">View all doctors</Link>
                                </div>

                                {cardio?.doctors?.length ? (
                                    <div className="doctor-grid">
                                        {cardio.doctors.map((doc) => <DoctorCard key={doc.id} doctor={doc} countInButton={false} />)}
                                    </div>
                                ) : cardio ? (
                                    <div className="empty-state">
                                        <p>No cardiologists are registered right now.</p>
                                        <Link to="/patient/doctors" className="btn btn-light">Browse all doctors</Link>
                                    </div>
                                ) : <Loading />}
                            </section>
                        </div>

                        <aside className="panel">
                            <p className="panel__label">Your answers</p>
                            <ValuesList values={reading.values} className="detail-list answers-list" />
                            <div className="btn-row" style={{ marginTop: 16 }}>
                                <Link to={`/patient/readings/${reading.id}/edit`} className="btn btn-light btn-sm">Edit answers</Link>
                            </div>
                        </aside>
                    </div>
                )}
            </main>
        </Page>
    );
}
