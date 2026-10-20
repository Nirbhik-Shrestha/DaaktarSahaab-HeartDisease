import { useState } from 'react';
import { Page, PageHero, Notice } from '../../components/Layout.jsx';
import { usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';

const EMPTY = { name: '', email: '', subject: '', message: '' };

export default function Contact() {
    usePageTitle('Contact Us - DaaktarSahab');
    const [values, setValues] = useState(EMPTY);
    const [errors, setErrors] = useState([]);
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);

    const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setErrors([]);
        try {
            await api.post('/public/contact', values);
            setSent(true);
            setValues(EMPTY);
            window.scrollTo(0, 0);
        } catch (err) {
            setSent(false);
            setErrors(err.status ? err.messages : ['Your message could not be sent right now. Please try again later, or email us directly.']);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Page page="pg-contact">
            <PageHero eyebrow="Contact" title="Get in touch">
                Questions, concerns or feedback? Send us a message and we'll get back to you by email.
            </PageHero>

            <main className="page-body">
                {sent && <Notice type="ok">Thanks, your message was sent. We'll reply to the email address you gave.</Notice>}
                {errors.length > 0 && <Notice type="bad" title="Your message was not sent:" items={errors} />}

                <div className="page-grid">
                    <section className="panel">
                        <div className="panel__head">
                            <h2 className="panel__title">Send us a message</h2>
                        </div>

                        <form onSubmit={submit}>
                            <div className="form-grid">
                                <div className="field">
                                    <label htmlFor="name">Your name</label>
                                    <input type="text" id="name" value={values.name} onChange={set('name')} maxLength={100} required autoComplete="name" />
                                </div>
                                <div className="field">
                                    <label htmlFor="email">Email</label>
                                    <input type="email" id="email" value={values.email} onChange={set('email')} maxLength={100} required autoComplete="email" />
                                </div>
                                <div className="field field--wide">
                                    <label htmlFor="subject">Subject</label>
                                    <input type="text" id="subject" value={values.subject} onChange={set('subject')} maxLength={150} required />
                                </div>
                                <div className="field field--wide">
                                    <label htmlFor="message">Message</label>
                                    <textarea id="message" value={values.message} onChange={set('message')} maxLength={5000} required />
                                    <p className="hint">Please don't include medical test results here. For advice about your health, book a doctor.</p>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={busy}>Send message</button>
                        </form>
                    </section>

                    <aside className="panel">
                        <p className="panel__label">Contact details</p>
                        <ul className="contact-list">
                            <li>
                                <img src="/images/mail.png" alt="" />
                                <div><span>Email</span><a href="mailto:support@daaktarsahab.com">support@daaktarsahab.com</a></div>
                            </li>
                            <li>
                                <img src="/images/contact.png" alt="" />
                                <div><span>Phone</span><a href="tel:+97712345678">+977-1-2345678</a></div>
                            </li>
                            <li>
                                <img src="/images/location.png" alt="" />
                                <div><span>Address</span><strong>123 Healthcare Street, Kathmandu, Nepal</strong></div>
                            </li>
                        </ul>
                    </aside>
                </div>
            </main>
        </Page>
    );
}
