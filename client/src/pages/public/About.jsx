import { Link } from 'react-router';
import { Page, PageHero } from '../../components/Layout.jsx';
import { usePageTitle } from '../../lib/hooks.js';

const FEATURES = [
    ['Heart risk check', 'Answer 13 questions from routine test reports and get a heart disease risk score from 0 to 100, with the factors behind it.'],
    ['Book a specialist', 'Browse doctors by specialty, see their upcoming sessions and book a one-hour slot that suits you.'],
    ['Share before your visit', 'Attach a heart check to an appointment so your doctor can review it beforehand. You can stop sharing at any time.'],
    ['Consultation notes', "After a visit, read your doctor's notes and advice on your appointments page."],
    ['Your records in one place', 'Keep every heart check, see how your score changes over time and download any result as a PDF.'],
    ['For doctors', 'Doctors manage their sessions, review shared heart checks and record the outcome of each visit.'],
];

export default function About() {
    usePageTitle('About Us - DaaktarSahab');
    return (
        <Page>
            <PageHero eyebrow="About us" title="About DaaktarSahab">
                An online healthcare service from Nepal that helps patients understand their heart health and see the right doctor.
            </PageHero>

            <main className="page-body">
                <section className="panel prose">
                    <h2>Who we are</h2>
                    <p><strong>DaaktarSahab</strong> is an online healthcare service based in Nepal, connecting patients with certified medical professionals. Our platform bridges the gap between doctors and patients, making healthcare more accessible and straightforward.</p>
                    <p>We believe that reliable medical information and professional advice should be simple to get. Our goal is to make that easier for everyone in Nepal through a service that is clear and easy to use.</p>

                    <h2>Our mission</h2>
                    <p>Our mission is to simplify healthcare and make it accessible to everyone, everywhere. We strive to build a trustworthy, personal and uncomplicated service that meets the needs of our community.</p>
                </section>

                <section className="panel">
                    <div className="panel__head">
                        <div>
                            <h2 className="panel__title">What we offer</h2>
                            <p className="panel__sub">Everything below is available today with a free patient account.</p>
                        </div>
                    </div>
                    <div className="feature-grid">
                        {FEATURES.map(([title, text]) => (
                            <div className="feature" key={title}>
                                <h3>{title}</h3>
                                <p>{text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="panel prose">
                    <h2>Our vision</h2>
                    <p>DaaktarSahab was founded to make healthcare and medical consultation less complicated and more widely accessible. We are committed to improving healthcare in Nepal through technology, so that everyone can reach the medical care they need.</p>
                    <div className="btn-row" style={{ marginTop: 20 }}>
                        <Link to="/patient/login?mode=register" className="btn btn-primary">Create a free account</Link>
                        <Link to="/contact" className="btn btn-light">Contact us</Link>
                    </div>
                </section>
            </main>
        </Page>
    );
}
