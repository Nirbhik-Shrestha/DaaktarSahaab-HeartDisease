import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Page, PageHero, Notice, Loading } from '../../components/Layout.jsx';
import { checkFormat } from '../auth/PatientLogin.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { today } from '../../lib/format.js';
import { NAME_PATTERN, PHONE_PATTERN, PHONE_MESSAGE } from '@shared/constants.js';

export default function Profile() {
    usePageTitle('My Profile - DaaktarSahab');
    const { user, setUser } = useAuth();
    const { data } = useApi('/patient/profile');
    const [values, setValues] = useState(null);
    const [saved, setSaved] = useState(null); // the profile as last saved
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (data) {
            setValues(data.profile);
            setSaved(data.profile);
        }
    }, [data]);

    const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await api.put('/patient/profile', values);
            setSaved(res.profile);
            setValues(res.profile);
            setUser({ ...user, name: res.profile.name, email: res.profile.email });
            setNotice({ type: 'ok', text: 'Your details were saved.' });
        } catch (err) {
            setNotice({ type: 'bad', title: 'Your details were not saved:', items: err.messages });
        } finally {
            setBusy(false);
            window.scrollTo(0, 0);
        }
    }

    return (
        <Page header="patient" page="pg-profile">
            <PageHero eyebrow="My profile" title="Your details">
                Keep your contact details up to date so doctors can reach you about your appointments.
            </PageHero>

            <main className="page-body">
                {notice && <Notice type={notice.type} title={notice.title} items={notice.items}>{notice.text}</Notice>}

                {!values ? <Loading /> : (
                    <div className="page-grid">
                        <section className="panel">
                            <div className="panel__head">
                                <h2 className="panel__title">Personal information</h2>
                            </div>

                            <form onSubmit={submit}>
                                <div className="form-grid">
                                    <div className="field">
                                        <label htmlFor="pname">Full name</label>
                                        <input type="text" id="pname" value={values.name} onChange={set('name')} required
                                            onInput={checkFormat(NAME_PATTERN, "Please use letters, spaces and . , ' - only.")} />
                                    </div>
                                    <div className="field">
                                        <label htmlFor="pemail">Email</label>
                                        <input type="email" id="pemail" value={values.email} onChange={set('email')} required />
                                        <p className="hint">You sign in with this address.</p>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="pcontact">Mobile number</label>
                                        <input type="text" id="pcontact" value={values.contact} onChange={set('contact')} required
                                            inputMode="numeric" placeholder="98XXXXXXXX" onInput={checkFormat(PHONE_PATTERN, PHONE_MESSAGE)} />
                                        <p className="hint">10 digits, starting with 97 or 98.</p>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="pdob">Date of birth</label>
                                        <input type="date" id="pdob" value={values.dob} onChange={set('dob')} max={today()} required />
                                    </div>
                                    <div className="field field--wide">
                                        <label htmlFor="paddress">Address</label>
                                        <input type="text" id="paddress" value={values.address} onChange={set('address')} required />
                                    </div>
                                </div>

                                <div className="btn-row">
                                    <button type="submit" className="btn btn-primary" disabled={busy}>Save changes</button>
                                    <Link to="/patient" className="btn btn-light">Cancel</Link>
                                </div>
                            </form>
                        </section>

                        <aside className="panel">
                            <div className="profile-summary">
                                <img src="/images/user.png" alt="" />
                                <div>
                                    <h2>{saved.name}</h2>
                                    <p>Patient no. {saved.number}</p>
                                </div>
                            </div>
                            <ul className="detail-list">
                                <li><span>Heart checks taken</span><strong>{data.checkCount}</strong></li>
                            </ul>
                            <div className="quick-links">
                                <Link to="/patient/appointments" className="btn btn-light btn-block">My appointments</Link>
                                <Link to="/patient/history" className="btn btn-light btn-block">My prediction history</Link>
                            </div>
                        </aside>
                    </div>
                )}
            </main>
        </Page>
    );
}
