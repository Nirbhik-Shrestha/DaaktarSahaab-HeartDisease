import { useState } from 'react';
import AdminShell from '../../components/AdminShell.jsx';
import { Notice, Loading } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { dayMedium } from '../../lib/format.js';

export default function Patients() {
    usePageTitle('Patients - DaaktarSahab Admin');
    const { data, reload } = useApi('/admin/patients');
    const [notice, setNotice] = useState(null);
    const patients = data?.patients || [];

    // Their appointments, heart checks and conversations are removed too.
    async function remove(patient) {
        if (!window.confirm(`Remove ${patient.name}? Their appointments and saved heart checks will be deleted too.`)) return;
        try {
            await api.del(`/admin/patients/${patient.id}`);
            setNotice(['ok', 'Patient removed, along with their appointments and heart checks.']);
        } catch (err) {
            setNotice(['bad', err.message]);
        }
        reload();
    }

    return (
        <AdminShell>
            <div className="admin-head">
                <div>
                    <h1>Patients</h1>
                    <p>{data ? `${patients.length} registered accounts` : ''}</p>
                </div>
            </div>

            {notice && <Notice type={notice[0]}>{notice[1]}</Notice>}

            <section className="panel">
                {!data ? <Loading /> : patients.length ? (
                    <div className="table-scroll">
                        <table className="data-table stack">
                            <thead>
                                <tr><th>Name</th><th>Email</th><th>Contact</th><th>Address</th><th>Date of birth</th><th>Bookings</th><th /></tr>
                            </thead>
                            <tbody>
                                {patients.map((row) => (
                                    <tr key={row.id}>
                                        <td className="cell-strong" data-label="Name">{row.name}</td>
                                        <td data-label="Email">{row.email}</td>
                                        <td className="nowrap" data-label="Contact">{row.contact}</td>
                                        <td data-label="Address">{row.address}</td>
                                        <td className="nowrap" data-label="Date of birth">{row.dob ? dayMedium(row.dob) : '—'}</td>
                                        <td data-label="Bookings">{row.appointments}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(row)}>Remove</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state"><p>No patients have signed up yet.</p></div>
                )}
            </section>
        </AdminShell>
    );
}
