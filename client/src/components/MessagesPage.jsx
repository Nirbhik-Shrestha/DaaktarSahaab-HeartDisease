/**
 * The Messages page for patients and doctors: the panel frame around the
 * chat. A conversation exists for every patient-doctor pair with at least
 * one booking, and stays open after the visit.
 */
import { Link, useSearchParams } from 'react-router';
import { Page, PageHero, Notice, Loading, LoadError } from './Layout.jsx';
import Chat from './Chat.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useApi, usePageTitle } from '../lib/hooks.js';

const COPY = {
    patient: {
        hero: ['Messages', 'Your messages', 'Chat with the doctors you have booked. Each conversation stays open after your visit.'],
        sub: 'One conversation per doctor, however many times you book them.',
        empty: 'Book an appointment to start chatting with a doctor.',
        emptyLink: ['/patient/schedule', 'Browse available sessions', 'btn-primary'],
    },
    doctor: {
        hero: ['Messages', 'Patient messages', 'Reply to patients who have booked with you. Each conversation stays open after the visit.'],
        sub: 'One conversation per patient, however many times they book you.',
        empty: 'No conversations yet. Patients can message you once they book an appointment with you.',
        emptyLink: ['/doctor/schedule', 'Manage sessions', 'btn-light'],
    },
};

const TITLE = 'Messages - DaaktarSahab';

export default function MessagesPage({ role }) {
    usePageTitle(TITLE);
    const { user } = useAuth();
    const [params] = useSearchParams();
    const { data, error } = useApi('/chat/conversations');
    const copy = COPY[role];
    const requested = params.get('cid');
    const conversations = data?.conversations || [];
    // ?cid= (from "Message doctor/patient") only opens a thread this user is part of.
    const notFound = Boolean(data && requested && !conversations.some((c) => c.id === requested));

    const head = (extra) => (
        <>
            <div className="panel__head">
                <div>
                    <h2 className="panel__title">Conversations</h2>
                    <p className="panel__sub">{copy.sub}</p>
                </div>
                <div className="btn-row">
                    {extra}
                    <Link to={`/${role}/appointments`} className="btn btn-light btn-sm">My appointments</Link>
                </div>
            </div>
            <p className="notice notice-info" role="note">Messages are not monitored for emergencies. In an emergency, call 102 or go to the nearest hospital.</p>
        </>
    );

    return (
        <Page header={role}>
            <PageHero eyebrow={copy.hero[0]} title={copy.hero[1]} doctor={role === 'doctor'}>{copy.hero[2]}</PageHero>

            <main className="page-body">
                {notFound && <Notice type="bad">That conversation could not be found.</Notice>}
                {error && !data && <LoadError error={error} />}

                {!data && !error && <Loading />}
                {data && (
                    <section className="panel chat-panel">
                        {conversations.length ? (
                            <Chat
                                role={role}
                                userKey={`${role}-${user?.id}`}
                                initialConversations={conversations}
                                openId={requested}
                                baseTitle={TITLE}
                                head={head}
                            />
                        ) : (
                            <>
                                {head(null)}
                                <div className="empty-state">
                                    <p>{copy.empty}</p>
                                    <Link to={copy.emptyLink[0]} className={`btn ${copy.emptyLink[2]}`}>{copy.emptyLink[1]}</Link>
                                </div>
                            </>
                        )}
                    </section>
                )}
            </main>
        </Page>
    );
}
