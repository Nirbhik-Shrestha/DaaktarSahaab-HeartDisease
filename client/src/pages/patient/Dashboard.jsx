import { Link } from 'react-router';
import { Page } from '../../components/Layout.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { clock, dayMedium, dayShort, daysAway, stampDate } from '../../lib/format.js';
import { isHighRisk, riskPercent } from '@shared/assessment.js';

function shorten(text, limit) {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > limit ? `${clean.slice(0, limit).trimEnd()}...` : clean;
}

export default function Dashboard() {
    usePageTitle('Home - DaaktarSahab');
    const { user } = useAuth();
    const { data } = useApi('/patient/dashboard');
    // The hero greets by first name only.
    const firstName = (user?.name || '').trim().split(' ')[0] || user?.name;

    const next = data?.nextVisit;
    const checks = data?.checks || [];
    const latest = checks[0] && checks[0].riskScore !== null ? checks[0] : null;
    const previous = checks[1] && checks[1].riskScore !== null ? checks[1] : null;
    const note = data?.latestNote;

    return (
        <Page header="patient" kind="home">
            <main>
                <section className="hero" aria-label="Welcome to DaaktarSahab">
                    <div className="hero-content">
                        <span className="hero-eyebrow">Your heart, in good hands</span>
                        <h1>Welcome back, <span>{firstName}</span></h1>
                        <p>Check your heart in minutes, book a cardiologist, and get advice from your doctor, all in one place.</p>
                        <div className="hero-actions">
                            <Link className="btn btn-primary" to="/patient/heart-check">Check your heart</Link>
                            <Link className="btn btn-light" to="/patient/schedule">Book a doctor</Link>
                        </div>
                    </div>
                </section>

                <section className="section">
                    <div className="container">
                        <h2 className="section-title">Your health at a glance</h2>
                        <div className="cards">
                            <div className="card">
                                <p className="card-label">Next appointment</p>
                                {next ? (
                                    <>
                                        <p className="card-main">Dr. {next.doctorName}</p>
                                        <p className="card-sub">{next.specialty}</p>
                                        <p className="card-sub">{daysAway(next.date)}, {dayShort(next.date)} at {clock(next.start)}</p>
                                        <Link className="card-link" to="/patient/appointments">View appointments</Link>
                                    </>
                                ) : (
                                    <>
                                        <p className="card-empty">{data ? 'You have no upcoming appointments.' : 'Loading...'}</p>
                                        <Link className="card-link" to="/patient/schedule">Find an available session</Link>
                                    </>
                                )}
                            </div>

                            <div className="card">
                                <p className="card-label">Latest heart check</p>
                                {latest ? (
                                    <>
                                        <p className="card-main">
                                            <span className="score">{riskPercent(latest.riskScore)}<small>/100</small></span>
                                            <span className={`pill ${isHighRisk(latest.riskScore) ? 'pill-high' : 'pill-low'}`}>
                                                {isHighRisk(latest.riskScore) ? 'High risk' : 'Low risk'}
                                            </span>
                                        </p>
                                        <p className="card-sub">Taken {stampDate(latest.takenAt)}</p>
                                        {previous && (() => {
                                            const delta = riskPercent(latest.riskScore) - riskPercent(previous.riskScore);
                                            return (
                                                <p className="card-sub">
                                                    {delta === 0 ? 'Same as your previous check'
                                                        : `${delta < 0 ? 'Down' : 'Up'} ${Math.abs(delta)} points from your previous check`}
                                                </p>
                                            );
                                        })()}
                                        <Link className="card-link" to="/patient/history">See your history</Link>
                                    </>
                                ) : checks.length ? (
                                    <>
                                        <p className="card-empty">Your latest check could not be scored right now. Please try again later.</p>
                                        <Link className="card-link" to="/patient/history">See your history</Link>
                                    </>
                                ) : (
                                    <>
                                        <p className="card-empty">You haven't taken a heart check yet. It uses 13 values from routine tests and gives you a risk score.</p>
                                        <Link className="card-link" to="/patient/heart-check">Take your first check</Link>
                                    </>
                                )}
                            </div>

                            <div className="card">
                                <p className="card-label">From your doctor</p>
                                {note ? (
                                    <>
                                        <p className="note-quote">{shorten(note.notes, 140)}</p>
                                        <p className="card-sub">Dr. {note.doctorName}, visit on {dayMedium(note.date)}</p>
                                        <Link className="card-link" to="/patient/appointments">Read the full notes</Link>
                                    </>
                                ) : (
                                    <p className="card-empty">After a visit, your doctor's notes and advice will appear here.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="section">
                    <div className="container">
                        <h2 className="section-title">How it works</h2>
                        <div className="steps">
                            <div className="step">
                                <span className="step-number">1</span>
                                <div>
                                    <h3>Take the heart check</h3>
                                    <p>Enter values from your blood tests, ECG and stress test. <Link to="/patient/heart-check">Start the check</Link>.</p>
                                </div>
                            </div>
                            <div className="step">
                                <span className="step-number">2</span>
                                <div>
                                    <h3>Book a cardiologist</h3>
                                    <p>Pick a session and a time slot that suits you. <Link to="/patient/doctors">Browse doctors</Link>.</p>
                                </div>
                            </div>
                            <div className="step">
                                <span className="step-number">3</span>
                                <div>
                                    <h3>Share and get advice</h3>
                                    <p>Share your result with the doctor before the visit and read their notes afterwards. <Link to="/patient/appointments">Your appointments</Link>.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </Page>
    );
}
