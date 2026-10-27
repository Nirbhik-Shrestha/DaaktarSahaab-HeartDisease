import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import AdminShell from '../../components/AdminShell.jsx';
import { Notice } from '../../components/Layout.jsx';
import { checkFormat } from '../auth/PatientLogin.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { NAME_PATTERN, PHONE_PATTERN, EMAIL_PATTERN } from '@shared/constants.js';

export default function AddDoctor() {
    usePageTitle('Add Doctor - DaaktarSahab Admin');
    const navigate = useNavigate();
    const { data: spec } = useApi('/admin/specialties');
    const [values, setValues] = useState({ name: '', specialtyId: '', nmc: '', contact: '', address: '', email: '', password: '' });
    const [errors, setErrors] = useState([]);
    const [busy, setBusy] = useState(false);
    const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await api.post('/admin/doctors', values);
            navigate('/admin/doctors', { state: { added: true } });
        } catch (err) {
            setErrors(err.messages);
            setBusy(false);
        }
    }

    return (
        <AdminShell narrow>
            <div className="admin-head">
                <div>
                    <h1>Add a doctor</h1>
                    <p>The doctor signs in with this email and password.</p>
                </div>
                <Link className="btn btn-light" to="/admin/doctors">&larr; Back to doctors</Link>
            </div>

            {errors.length > 0 && <Notice type="bad" title="The doctor could not be added:" items={errors} />}

            <section className="panel">
                <form onSubmit={submit}>
                    <p className="panel__label">Doctor details</p>
                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="dname">Full name</label>
                            <input type="text" id="dname" value={values.name} onChange={set('name')} required
                                onInput={checkFormat(NAME_PATTERN, "Use letters, spaces and . , ' - only.")} />
                        </div>
                        <div className="field">
                            <label htmlFor="spid">Specialty</label>
                            <select id="spid" value={values.specialtyId} onChange={set('specialtyId')} required>
                                <option value="" disabled hidden>Choose a specialty</option>
                                {(spec?.specialties || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="nmc">NMC number</label>
                            <input type="text" id="nmc" value={values.nmc} onChange={set('nmc')} required />
                        </div>
                        <div className="field">
                            <label htmlFor="dcontact">Contact number</label>
                            <input type="text" id="dcontact" value={values.contact} onChange={set('contact')} placeholder="98XXXXXXXX" required
                                onInput={checkFormat(PHONE_PATTERN, 'Enter a 10-digit mobile number starting with 97 or 98.')} />
                        </div>
                        <div className="field field--wide">
                            <label htmlFor="daddress">Address</label>
                            <input type="text" id="daddress" value={values.address} onChange={set('address')} required />
                        </div>
                    </div>

                    <p className="panel__label" style={{ marginTop: 8 }}>Sign-in details</p>
                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="demail">Email</label>
                            <input type="email" id="demail" value={values.email} onChange={set('email')} required autoComplete="off"
                                onInput={checkFormat(EMAIL_PATTERN, 'Your email is not in proper format.')} />
                        </div>
                        <div className="field">
                            <label htmlFor="dpassword">Password</label>
                            <input type="password" id="dpassword" value={values.password} onChange={set('password')} minLength={6} required autoComplete="new-password" />
                            <p className="hint">At least 6 characters. The doctor can change it after signing in.</p>
                        </div>
                    </div>

                    <div className="btn-row">
                        <button type="submit" className="btn btn-primary" disabled={busy}>Add doctor</button>
                        <Link className="btn btn-light" to="/admin/doctors">Cancel</Link>
                    </div>
                </form>
            </section>
        </AdminShell>
    );
}
