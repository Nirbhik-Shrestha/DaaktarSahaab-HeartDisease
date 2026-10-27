import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import AdminShell from '../../components/AdminShell.jsx';
import { Notice, Loading } from '../../components/Layout.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';

export default function Doctors() {
    usePageTitle('Doctors - DaaktarSahab Admin');
    const location = useLocation();
    const { data, reload } = useApi('/admin/doctors');
    const { data: spec } = useApi('/admin/specialties');
    const [notice, setNotice] = useState(location.state?.added
        ? ['ok', 'Doctor added. They can sign in with the email and password you set.'] : null);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const dialog = useRef(null);
    const doctors = data?.doctors || [];

    useEffect(() => {
        if (editing && !dialog.current.open) dialog.current.showModal();
        if (!editing && dialog.current?.open) dialog.current.close();
    }, [editing]);

    async function save(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await api.put(`/admin/doctors/${editing.id}`, editing);
            setNotice(['ok', 'Doctor details saved.']);
            setEditing(null);
            reload();
        } catch (err) {
            setNotice(['bad', err.message]);
            setEditing(null);
        } finally {
            setBusy(false);
        }
    }

    // Their sessions, appointments and conversations are removed too.
    async function remove(doctor) {
        if (!window.confirm(`Remove ${doctor.name}? Their sessions and booked appointments will be deleted too.`)) return;
        try {
            await api.del(`/admin/doctors/${doctor.id}`);
            setNotice(['ok', 'Doctor removed, along with their sessions and appointments.']);
        } catch (err) {
            setNotice(['bad', err.message]);
        }
        reload();
    }

    const set = (key) => (e) => setEditing({ ...editing, [key]: e.target.value });

    return (
        <AdminShell>
            <div className="admin-head">
                <div>
                    <h1>Doctors</h1>
                    <p>{data ? `${doctors.length} doctors registered` : ''}</p>
                </div>
                <Link className="btn btn-primary" to="/admin/doctors/new">Add doctor</Link>
            </div>

            {notice && <Notice type={notice[0]}>{notice[1]}</Notice>}

            <section className="panel">
                {!data ? <Loading /> : doctors.length ? (
                    <div className="table-scroll">
                        <table className="data-table stack">
                            <thead>
                                <tr><th>Name</th><th>Specialty</th><th>Email</th><th>Contact</th><th>NMC no.</th><th /></tr>
                            </thead>
                            <tbody>
                                {doctors.map((row) => (
                                    <tr key={row.id}>
                                        <td className="cell-strong" data-label="Name">{row.name}</td>
                                        <td data-label="Specialty"><span className="badge badge-info">{row.specialty}</span></td>
                                        <td data-label="Email">{row.email}</td>
                                        <td className="nowrap" data-label="Contact">{row.contact}</td>
                                        <td className="nowrap" data-label="NMC no.">{row.nmc}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button type="button" className="btn btn-light btn-sm" onClick={() => setEditing({ ...row })}>Edit</button>
                                                <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(row)}>Remove</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>No doctors yet.</p>
                        <Link className="btn btn-primary" to="/admin/doctors/new">Add the first doctor</Link>
                    </div>
                )}
            </section>

            <dialog className="admin-dialog" ref={dialog} aria-labelledby="editTitle"
                onClose={() => setEditing(null)}
                // A click on the dimmed backdrop lands on the dialog element itself.
                onClick={(e) => { if (e.target === dialog.current) setEditing(null); }}>
                {editing && (
                    <form onSubmit={save}>
                        <div className="admin-dialog__head">
                            <h2 id="editTitle">Edit doctor</h2>
                            <button type="button" className="admin-dialog__close" aria-label="Close" onClick={() => setEditing(null)}>&times;</button>
                        </div>
                        <div className="admin-dialog__body">
                            <div className="form-grid">
                                <div className="field field--wide">
                                    <label htmlFor="dname">Name</label>
                                    <input type="text" id="dname" value={editing.name} onChange={set('name')} required autoFocus />
                                </div>
                                <div className="field field--wide">
                                    <label htmlFor="demail">Email</label>
                                    <input type="email" id="demail" value={editing.email} onChange={set('email')} required />
                                </div>
                                <div className="field">
                                    <label htmlFor="spid">Specialty</label>
                                    <select id="spid" value={editing.specialtyId} onChange={set('specialtyId')} required>
                                        {(spec?.specialties || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="field">
                                    <label htmlFor="dcontact">Contact</label>
                                    <input type="text" id="dcontact" value={editing.contact} onChange={set('contact')} required />
                                </div>
                                <div className="field field--wide">
                                    <label htmlFor="nmc">NMC number</label>
                                    <input type="text" id="nmc" value={editing.nmc} onChange={set('nmc')} required />
                                </div>
                            </div>
                        </div>
                        <div className="admin-dialog__foot">
                            <button type="button" className="btn btn-light" onClick={() => setEditing(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={busy}>Save changes</button>
                        </div>
                    </form>
                )}
            </dialog>
        </AdminShell>
    );
}
