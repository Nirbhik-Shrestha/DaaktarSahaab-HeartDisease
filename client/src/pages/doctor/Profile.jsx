import { useState } from 'react';
import { Page, PageHero, Notice, Loading } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';

const EMPTY = { current: '', password: '', confirm: '' };

export default function Profile() {
    usePageTitle('My Profile - DaaktarSahab');
    const { data } = useApi('/doctor/profile');
    const [form, setForm] = useState(EMPTY);
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const profile = data?.profile;
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    // Doctors change their own password; other details are managed by the admin.
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await api.put('/doctor/password', form);
            setForm(EMPTY);
            setNotice({ type: 'ok', text: 'Your password was changed. Use the new one next time you sign in.' });
        } catch (err) {
            setNotice({ type: 'bad', title: 'Your password was not changed:', items: err.messages });
        } finally {
            setBusy(false);
        }
    }

    return (
        <Page header="doctor" page="pg-profile">
            <PageHero eyebrow="My profile" title="Your details" doctor>
                How patients see you on DaaktarSahab, and where to change your password.
            </PageHero>

            <main className="page-body">
                {notice && <Notice type={notice.type} title={notice.title} items={notice.items}>{notice.text}</Notice>}

                {!profile ? <Loading /> : (
                    <div className="page-grid">
                        <section className="panel">
                            <div className="profile-summary">
                                <img src="/images/user.png" alt="" />
                                <div>
                                    <h2>Dr. {profile.name}</h2>
                                    <p><span className="badge badge-info">{profile.specialty}</span></p>
                                </div>
                            </div>
                            <ul className="detail-list">
                                <li><span>Email</span><strong>{profile.email}</strong></li>
                                <li><span>Phone</span><strong>{profile.contact}</strong></li>
                                <li><span>Practice address</span><strong>{profile.address}</strong></li>
                                <li><span>NMC registration</span><strong>{profile.nmc}</strong></li>
                            </ul>
                            <div className="notice notice-info" style={{ margin: '18px 0 0' }}>
                                To change these details, please ask the DaaktarSahab admin team.
                            </div>
                        </section>

                        <aside className="panel">
                            <p className="panel__label">Change password</p>
                            <form onSubmit={submit}>
                                <div className="field">
                                    <label htmlFor="current_password">Current password</label>
                                    <input type="password" id="current_password" value={form.current} onChange={set('current')} required autoComplete="current-password" />
                                </div>
                                <div className="field">
                                    <label htmlFor="new_password">New password</label>
                                    <input type="password" id="new_password" value={form.password} onChange={set('password')} minLength={6} required autoComplete="new-password" />
                                    <p className="hint">At least 6 characters.</p>
                                </div>
                                <div className="field">
                                    <label htmlFor="confirm_password">Confirm new password</label>
                                    <input type="password" id="confirm_password" value={form.confirm} onChange={set('confirm')} minLength={6} required autoComplete="new-password" />
                                </div>
                                <button type="submit" className="btn btn-primary btn-block" disabled={busy}>Change password</button>
                            </form>
                        </aside>
                    </div>
                )}
            </main>
        </Page>
    );
}
