import { Link } from 'react-router';
import { Page, PageHero, Loading, LoadError } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { dayMedium } from '../../lib/format.js';

export default function Patients() {
    usePageTitle('My Patients - DaaktarSahab');
    const { data, error } = useApi('/doctor/patients');
    const patients = data?.patients || [];

    return (
        <Page header="doctor">
            <PageHero eyebrow="Patients" title="Your patients" doctor>
                Everyone who has booked an appointment with you, with their contact details.
            </PageHero>

            <main className="page-body">
                {error && !data ? <LoadError error={error} /> : (
                    <section className="panel">
                        <div className="panel__head">
                            <div>
                                <h2 className="panel__title">All patients</h2>
                                <p className="panel__sub">{data ? `${patients.length} ${patients.length === 1 ? 'patient' : 'patients'}` : ''}</p>
                            </div>
                            <Link to="/doctor/appointments" className="btn btn-light btn-sm">My appointments</Link>
                        </div>

                        {!data ? <Loading /> : patients.length ? (
                            <div className="table-scroll">
                                <table className="data-table stack">
                                    <thead>
                                        <tr><th>Patient</th><th>Contact</th><th>Address</th><th>Visits</th></tr>
                                    </thead>
                                    <tbody>
                                        {patients.map((row) => (
                                            <tr key={row.id}>
                                                <td data-label="Patient">
                                                    <div>
                                                        <span className="cell-strong">{row.name}</span><br />
                                                        <span className="cell-muted">Born {dayMedium(row.dob)}{row.age !== null ? ` (${row.age})` : ''}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Contact">
                                                    <div>
                                                        <a href={`mailto:${row.email}`}>{row.email}</a><br />
                                                        <span className="cell-muted">{row.contact}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Address">{row.address}</td>
                                                <td data-label="Visits">
                                                    <div>
                                                        <span className="cell-strong">{row.visits}</span><br />
                                                        <span className="cell-muted nowrap">{row.latest >= data.today ? 'Next' : 'Last'}: {dayMedium(row.latest)}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>No patients have booked with you yet.</p>
                                <Link to="/doctor/schedule" className="btn btn-light">Add a session</Link>
                            </div>
                        )}
                    </section>
                )}
            </main>
        </Page>
    );
}
