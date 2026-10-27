/**
 * A heart check a patient shared with this doctor, either attached to one of
 * the doctor's appointments (source="appointment") or posted in their chat
 * (source="chat"). The API only returns readings shared with this doctor.
 */
import { Link, useParams } from 'react-router';
import { Page, PageHero, Notice, Loading } from '../../components/Layout.jsx';
import { RiskCard, ValuesList } from '../../components/Assessment.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { dayLong, dayMedium, stampDateTime, stampDateTimeLong, timeRange } from '../../lib/format.js';

export default function SharedAssessment({ source }) {
    usePageTitle('Shared Heart Check - DaaktarSahab');
    const { id } = useParams();
    const path = source === 'chat' ? `/doctor/chat-assessments/${id}` : `/doctor/appointments/${id}/assessment`;
    const { data, error } = useApi(path);
    const reading = data?.reading;

    let content;
    if (error) {
        content = (
            <section className="panel">
                <div className="empty-state">
                    <p>
                        {source === 'chat'
                            ? 'This heart check is not available. The patient may have deleted it, or it was not shared with you.'
                            : "No shared heart check was found for this appointment. A patient's reading is only visible here once they share it with their booking."}
                    </p>
                    {source === 'chat'
                        ? <Link to="/doctor/messages" className="btn btn-light">Back to messages</Link>
                        : <Link to="/doctor/appointments" className="btn btn-light">Back to appointments</Link>}
                </div>
            </section>
        );
    } else if (!reading) {
        content = <Loading />;
    } else {
        content = (
            <div className="page-grid">
                <div>
                    <section className="panel">
                        <div className="panel__head">
                            <div>
                                <h2 className="panel__title">Model assessment</h2>
                                <p className="panel__sub">Reading taken {stampDateTimeLong(reading.takenAt)}</p>
                            </div>
                        </div>
                        {reading.assessment
                            ? <RiskCard assessment={reading.assessment} />
                            : <Notice type="bad">The prediction model could not be run.</Notice>}
                    </section>

                    <section className="panel">
                        <div className="panel__head">
                            <h2 className="panel__title">Submitted values</h2>
                        </div>
                        <ValuesList values={reading.values} />
                    </section>
                </div>

                <aside className="panel">
                    <p className="panel__label">{source === 'chat' ? 'Patient' : 'Patient and appointment'}</p>
                    <ul className="detail-list">
                        <li><span>Patient</span><strong>{data.patient.name}</strong></li>
                        <li><span>Date of birth</span><strong>{dayMedium(data.patient.dob)}</strong></li>
                        {source === 'chat' ? (
                            <li><span>Shared</span><strong>{stampDateTime(data.sharedAt)}</strong></li>
                        ) : (
                            <>
                                <li><span>Appointment</span><strong>{dayLong(data.appointment.date)}</strong></li>
                                <li><span>Time</span><strong>{timeRange(data.appointment.start, data.appointment.end)}</strong></li>
                            </>
                        )}
                    </ul>
                    <div className="btn-row" style={{ marginTop: 16 }}>
                        {source === 'chat' ? (
                            <Link className="btn btn-primary btn-block" to={`/doctor/messages?cid=${data.conversationId}`}>Back to the conversation</Link>
                        ) : (
                            <>
                                <Link className="btn btn-primary btn-block" to={`/doctor/appointments/${data.appointment.id}`}>Record the visit</Link>
                                <Link className="btn btn-light btn-block" to="/doctor/appointments">Back to appointments</Link>
                            </>
                        )}
                    </div>
                </aside>
            </div>
        );
    }

    return (
        <Page header="doctor">
            <PageHero eyebrow="Shared heart check" title={data ? `${data.patient.name}'s heart check` : 'Heart check'} doctor>
                {source === 'chat'
                    ? 'Shared by the patient in your conversation.'
                    : 'Shared by the patient with their appointment so you can review it before the visit.'}
            </PageHero>
            <main className="page-body">{content}</main>
        </Page>
    );
}
