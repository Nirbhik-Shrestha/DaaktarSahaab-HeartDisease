import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Page, PageHero, Notice, Loading } from '../../components/Layout.jsx';
import { AssessmentFields } from '../../components/Assessment.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { stampDateLong } from '../../lib/format.js';

export default function EditReading() {
    usePageTitle('Edit Heart Check - DaaktarSahab');
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, error } = useApi(`/patient/readings/${id}`);
    const [values, setValues] = useState(null);
    const [errors, setErrors] = useState([]);
    const [busy, setBusy] = useState(false);
    const reading = data?.reading;

    useEffect(() => {
        if (reading) {
            setValues(Object.fromEntries(Object.entries(reading.values).map(([k, v]) => [k, String(v)])));
        }
    }, [reading]);

    // Missing or someone else's reading: back to the list of the patient's own.
    if (error) return <Navigate to="/patient/history" replace />;

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await api.put(`/patient/readings/${id}`, values);
            navigate('/patient/history', { state: { notice: 'Your reading was updated and its risk score recalculated.' } });
        } catch (err) {
            setErrors(err.messages);
            setBusy(false);
            window.scrollTo(0, 0);
        }
    }

    return (
        <Page header="patient" page="pg-edit-reading">
            <PageHero eyebrow="Edit heart check" title="Edit your answers">
                {reading ? `Correct any value from your reading of ${stampDateLong(reading.takenAt)}. The risk score is recalculated when you save.` : ''}
            </PageHero>

            <main className="page-body">
                {errors.length > 0 && <Notice type="bad" title="Please check your answers:" items={errors} />}
                {!values ? <Loading /> : (
                    <form onSubmit={submit}>
                        <AssessmentFields values={values} onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))} />
                        <div className="edit-actions">
                            <p>Saving replaces this reading's answers.</p>
                            <div className="btn-row">
                                <Link to="/patient/history" className="btn btn-light">Cancel</Link>
                                <button type="submit" className="btn btn-primary" disabled={busy}>Save changes</button>
                            </div>
                        </div>
                    </form>
                )}
            </main>
        </Page>
    );
}
