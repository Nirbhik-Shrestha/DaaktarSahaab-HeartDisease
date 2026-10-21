import { Link } from 'react-router';

/** A doctor in the patient's doctor grid, with a link to their sessions. */
export default function DoctorCard({ doctor, countInButton = true }) {
    const upcoming = doctor.upcomingSessions;
    return (
        <article className="doctor-card">
            <img src="/images/user.png" alt="" />
            <h3>Dr. {doctor.name}</h3>
            <span className="badge badge-info">{doctor.specialty}</span>
            {doctor.address && <p>{doctor.address}</p>}
            {doctor.contact && <p>{doctor.contact}</p>}
            <div className="doctor-card__actions">
                {upcoming > 0 ? (
                    <Link className="btn btn-primary" to={`/patient/schedule?doctor=${doctor.id}`}>
                        {countInButton ? `View ${upcoming} upcoming ${upcoming === 1 ? 'session' : 'sessions'}` : 'Book appointment'}
                    </Link>
                ) : (
                    <span className="btn is-disabled">No sessions scheduled</span>
                )}
            </div>
        </article>
    );
}
