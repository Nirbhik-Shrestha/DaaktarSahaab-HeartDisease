import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Page, PageHero, Loading, LoadError } from '../../components/Layout.jsx';
import DoctorCard from '../../components/DoctorCard.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';

export default function Doctors() {
    usePageTitle('Our Doctors - DaaktarSahab');
    // Search comes from the URL (links like ?search=Cardiologist) or the box;
    // it matches a doctor's name or specialty.
    const [params, setParams] = useSearchParams();
    const keyword = (params.get('search') || '').trim();
    const [text, setText] = useState(keyword);
    useEffect(() => setText(keyword), [keyword]);

    const { data, error } = useApi(`/patient/doctors?search=${encodeURIComponent(keyword)}`);
    const doctors = data?.doctors || [];

    function search(e) {
        e.preventDefault();
        setParams(text.trim() ? { search: text.trim() } : {});
    }

    return (
        <Page header="patient">
            <PageHero eyebrow="Doctors" title="Find a doctor">
                Browse the doctors on DaaktarSahab and see when they are available to book.
            </PageHero>

            <main className="page-body">
                <section className="panel">
                    <form onSubmit={search} className="search-bar" role="search">
                        <input type="text" value={text} onChange={(e) => setText(e.target.value)}
                            placeholder="Search by name or specialty, e.g. Cardiologist" aria-label="Search doctors" />
                        <button type="submit" className="btn btn-primary">Search</button>
                        {keyword && <Link to="/patient/doctors" className="btn btn-light">Clear</Link>}
                    </form>
                </section>

                {error ? <LoadError error={error} /> : (
                    <section className="panel">
                        <div className="panel__head">
                            <div>
                                <h2 className="panel__title">{keyword ? `Results for "${keyword}"` : 'All doctors'}</h2>
                                <p className="panel__sub">{data ? `${doctors.length} ${doctors.length === 1 ? 'doctor' : 'doctors'}` : ''}</p>
                            </div>
                        </div>

                        {!data ? <Loading /> : doctors.length ? (
                            <div className="doctor-grid">
                                {doctors.map((doc) => <DoctorCard key={doc.id} doctor={doc} />)}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>{keyword ? `No doctors match "${keyword}".` : 'No doctors are registered yet.'}</p>
                                <Link to="/patient/doctors" className="btn btn-light">Show all doctors</Link>
                            </div>
                        )}
                    </section>
                )}
            </main>
        </Page>
    );
}
