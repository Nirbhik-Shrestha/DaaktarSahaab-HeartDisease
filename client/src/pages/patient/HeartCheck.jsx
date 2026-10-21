import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page, PageHero } from '../../components/Layout.jsx';
import { AssessmentFields, isFilled } from '../../components/Assessment.jsx';
import { usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { ASSESSMENT_FIELDS, ASSESSMENT_GROUPS } from '@shared/assessment.js';

const FIELD_ENTRIES = Object.entries(ASSESSMENT_FIELDS);
const TOTAL = FIELD_ENTRIES.length;
const GROUP_KEYS = Object.keys(ASSESSMENT_GROUPS);

export default function HeartCheck() {
    usePageTitle('Heart Disease Prediction - DaaktarSahab');
    const navigate = useNavigate();
    const [values, setValues] = useState({});
    const [errors, setErrors] = useState([]);
    const [busy, setBusy] = useState(false);
    const [active, setActive] = useState(null);
    const formRef = useRef(null);

    // Per section: how many of its questions are answered.
    const progress = GROUP_KEYS.map((key) => {
        const names = FIELD_ENTRIES.filter(([, f]) => f.group === key).map(([n]) => n);
        return { key, size: names.length, done: names.filter((n) => isFilled(values[n])).length };
    });
    const answered = progress.reduce((sum, g) => sum + g.done, 0);

    // Highlight the section currently in the middle of the screen.
    useEffect(() => {
        if (!('IntersectionObserver' in window) || !formRef.current) return undefined;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
        }, { rootMargin: '-40% 0px -55% 0px' });
        formRef.current.querySelectorAll('fieldset.field-group').forEach((g) => io.observe(g));
        return () => io.disconnect();
    }, []);

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        try {
            const { id } = await api.post('/patient/readings', values);
            navigate(`/patient/readings/${id}`);
        } catch (err) {
            setErrors(err.messages);
            setBusy(false);
            window.scrollTo(0, 0);
        }
    }

    function jump(e, key) {
        e.preventDefault();
        document.getElementById(`group-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    return (
        <Page header="patient" page="pg-heart-form">
            <PageHero eyebrow="Heart check" title="Heart Disease Prediction"
                meta={[`${TOTAL} questions`, 'About 5 minutes', 'Keep your test reports nearby']}>
                Answer {TOTAL} questions from your health reports to estimate your heart disease risk.
            </PageHero>

            <main className="container">
                <aside className="form-progress" aria-label="Form progress">
                    <p className="form-progress__title">Your progress</p>
                    <p className="form-progress__count"><span>{answered}</span> of {TOTAL} answered</p>
                    <div className="form-progress__bar"><i style={{ width: `${(answered / TOTAL) * 100}%` }} /></div>
                    <ol>
                        {progress.map((g, i) => {
                            const classes = [active === `group-${g.key}` && 'is-active', g.done === g.size && 'is-done'].filter(Boolean).join(' ');
                            return (
                                <li key={g.key}>
                                    <a href={`#group-${g.key}`} className={classes} onClick={(e) => jump(e, g.key)}>
                                        <b>{i + 1}</b>
                                        <span>{ASSESSMENT_GROUPS[g.key].title}</span>
                                        <small>{g.done}/{g.size}</small>
                                    </a>
                                </li>
                            );
                        })}
                    </ol>
                    <p className="form-progress__privacy">🔐 Your answers are private. You choose whether to share a result with a doctor.</p>
                </aside>

                <div className="form-main">
                    <details className="info-box" open>
                        <summary>Before you start: what you will need</summary>
                        <p>This assessment uses the same 13 measurements cardiologists record. Some you know already; others come from test reports:</p>
                        <ul>
                            <li><strong>Blood tests</strong>: a lipid profile (cholesterol) and a fasting blood sugar test.</li>
                            <li><strong>ECG and exercise stress test</strong> (treadmill test / TMT).</li>
                            <li><strong>Coronary angiogram</strong> and a <strong>thallium stress scan</strong>, if you have had them.</li>
                        </ul>
                        <p>Each question below says where to find the value. Enter exactly what the report says. Guessing makes the result less reliable.</p>
                        <p>Haven't had some of these tests? <Link to="/patient/doctors?search=Cardiologist">Book a cardiologist</Link>. They can order the tests and go through the values with you.</p>
                    </details>

                    {errors.length > 0 && (
                        <div className="form-errors" role="alert">
                            <strong>Please check your answers:</strong>
                            <ul>{errors.map((err) => <li key={err}>{err}</li>)}</ul>
                        </div>
                    )}

                    <form ref={formRef} onSubmit={submit}>
                        <AssessmentFields values={values} onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))} />
                        <div className="form-submit">
                            <span className="form-submit__count"><b>{answered}</b> of {TOTAL} answered</span>
                            <button type="submit" disabled={busy}>{busy ? 'Checking...' : 'See my heart risk'}</button>
                        </div>
                    </form>
                </div>
            </main>
        </Page>
    );
}
