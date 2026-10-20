import { Link } from 'react-router';
import { Page } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { plural } from '../../lib/format.js';

export default function Home() {
    usePageTitle('DaaktarSahab - Heart checks and doctor appointments');
    const { data: stats } = useApi('/public/stats');

    return (
        <Page kind="home" page="pg-home">
            <main>
                <section className="hero" aria-label="Welcome to DaaktarSahab">
                    <div className="hero-content">
                        <span className="hero-eyebrow">Heart health, made simple</span>
                        <h1>Welcome to <span>DaaktarSahab</span></h1>
                        <p>Check your heart disease risk in minutes, book a cardiologist, and keep your doctor's advice in one place.</p>
                        <div className="hero-actions">
                            <Link className="btn btn-primary" to="/patient/login?mode=register">Create a free account</Link>
                            <Link className="btn btn-light" to="/patient/login">Sign in</Link>
                        </div>
                    </div>
                </section>

                <section className="section">
                    <div className="container">
                        <h2 className="section-title">What you can do</h2>
                        <div className="cards">
                            <div className="card">
                                <p className="card-label">Heart check</p>
                                <p className="card-main">Know your risk</p>
                                <p className="card-sub">Answer 13 questions from routine test reports and get a heart disease risk score from 0 to 100, with the factors behind it.</p>
                                <Link className="card-link" to="/patient/login?mode=register">Start a heart check</Link>
                            </div>

                            <div className="card">
                                <p className="card-label">Doctors</p>
                                {stats && stats.doctors > 0 ? (
                                    <>
                                        <p className="card-main">{plural(stats.doctors, 'doctor')}, {plural(stats.specialties, 'specialty', 'specialties')}</p>
                                        <p className="card-sub">
                                            {stats.sessions > 0 ? `${plural(stats.sessions, 'upcoming session')} open for booking` : 'New sessions are added regularly'}
                                            {stats.cardiologists > 0 ? `, with ${plural(stats.cardiologists, 'cardiologist')} on hand.` : '.'}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="card-main">Book a specialist</p>
                                        <p className="card-sub">See when doctors are available and book a one-hour slot that suits you.</p>
                                    </>
                                )}
                                <Link className="card-link" to="/patient/login">Book an appointment</Link>
                            </div>

                            <div className="card">
                                <p className="card-label">Follow-up</p>
                                <p className="card-main">Advice you can keep</p>
                                <p className="card-sub">Share a result with your doctor before the visit, read their notes afterwards, and download any result as a PDF.</p>
                                <Link className="card-link" to="/patient/login?mode=register">Create an account</Link>
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
                                    <h3>Create your account</h3>
                                    <p>It takes a minute and only needs your contact details. <Link to="/patient/login?mode=register">Sign up</Link>.</p>
                                </div>
                            </div>
                            <div className="step">
                                <span className="step-number">2</span>
                                <div>
                                    <h3>Take the heart check</h3>
                                    <p>Enter values from your blood tests, ECG and stress test to get your risk score.</p>
                                </div>
                            </div>
                            <div className="step">
                                <span className="step-number">3</span>
                                <div>
                                    <h3>See a cardiologist</h3>
                                    <p>Book a session, share your result with the doctor and read their advice afterwards.</p>
                                </div>
                            </div>
                        </div>

                        <div className="staff-strip">
                            <div>
                                <h2>Doctors and staff</h2>
                                <p>Manage your sessions, appointments and consultation notes.</p>
                            </div>
                            <div className="hero-actions">
                                <Link className="btn btn-light" to="/doctor/login">Doctor sign in</Link>
                                <Link className="btn btn-light" to="/admin/login">Admin sign in</Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </Page>
    );
}
