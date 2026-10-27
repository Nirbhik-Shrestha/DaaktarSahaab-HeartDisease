import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import AdminShell from '../../components/AdminShell.jsx';
import { Notice } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { today } from '../../lib/format.js';
import { MAX_SLOTS_PER_SESSION } from '@shared/constants.js';

export default function AddSession() {
    usePageTitle('Add Session - DaaktarSahab Admin');
    const navigate = useNavigate();
    const { data } = useApi('/admin/doctor-options');
    const [values, setValues] = useState({ doctorId: '', date: '', startTime: '', slots: '' });
    const [errors, setErrors] = useState([]);
    const [busy, setBusy] = useState(false);
    const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await api.post('/admin/sessions', values);
            navigate('/admin/sessions', { state: { added: true } });
        } catch (err) {
            setErrors(err.messages);
            setBusy(false);
        }
    }

    return (
        <AdminShell narrow>
            <div className="admin-head">
                <div>
                    <h1>Add a session</h1>
                    <p>One session per doctor per day, split into one-hour slots patients can book.</p>
                </div>
                <Link className="btn btn-light" to="/admin/sessions">&larr; Back to sessions</Link>
            </div>

            {errors.length > 0 && <Notice type="bad" title="This session could not be created:" items={errors} />}

            <section className="panel">
                <form onSubmit={submit}>
                    <div className="form-grid">
                        <div className="field field--wide">
                            <label htmlFor="did">Doctor</label>
                            <select id="did" value={values.doctorId} onChange={set('doctorId')} required>
                                <option value="" disabled hidden>Choose a doctor</option>
                                {(data?.doctors || []).map((d) => <option key={d.id} value={d.id}>{d.name} · {d.specialty}</option>)}
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="sdate">Date</label>
                            <input type="date" id="sdate" min={today()} value={values.date} onChange={set('date')} required />
                        </div>
                        <div className="field">
                            <label htmlFor="stime">Start time</label>
                            <input type="time" id="stime" value={values.startTime} onChange={set('startTime')} required />
                        </div>
                        <div className="field">
                            <label htmlFor="nop">Number of slots</label>
                            <input type="number" id="nop" min={1} max={MAX_SLOTS_PER_SESSION} value={values.slots} onChange={set('slots')}
                                placeholder={`1 to ${MAX_SLOTS_PER_SESSION}`} required />
                            <p className="hint">Each slot is one hour and takes one patient. The session must finish by midnight.</p>
                        </div>
                    </div>

                    <div className="btn-row">
                        <button type="submit" className="btn btn-primary" disabled={busy}>Add session</button>
                        <Link className="btn btn-light" to="/admin/sessions">Cancel</Link>
                    </div>
                </form>
            </section>
        </AdminShell>
    );
}
