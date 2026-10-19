/** Page frame pieces shared by the portals: footer, banner, notices, guards. */
import { Link, Navigate, useLocation } from 'react-router';
import SiteHeader from './SiteHeader.jsx';
import { useAuth, LOGIN_PATH } from '../lib/auth.jsx';

export function Footer() {
    return (
        <footer className="footer">
            <div className="footer-inner">
                <div className="footer-left">
                    <img src="/images/logoo5.png" alt="DaaktarSahab Logo" className="footer-logo" />
                    <div className="footer-info">
                        <h3>DaaktarSahab</h3>
                        <p>Contact: <a href="tel:+97712345678">+977-1-2345678</a></p>
                        <p>Address: 123 Healthcare Street, Kathmandu, Nepal</p>
                    </div>
                </div>
                <div className="footer-right">
                    <ul className="footer-links">
                        <li><Link to="/about">About Us</Link></li>
                        <li><Link to="/contact">Contact Us</Link></li>
                        <li><Link to="/terms">Terms of Use</Link></li>
                        <li><Link to="/privacy">Privacy Policy</Link></li>
                    </ul>
                </div>
            </div>
            <div className="footer-bottom">
                <p>&copy; 2024 DaaktarSahab | All Rights Reserved</p>
            </div>
        </footer>
    );
}

/**
 * A standard page: header, content, footer. `kind` is "site" (most pages) or
 * "home" (the two homepages); `page` adds the page's own style scope.
 */
export function Page({ header = 'main', kind = 'site', page = '', children }) {
    return (
        <div className={`${kind === 'home' ? 'home-page' : 'site-page'}${page ? ` ${page}` : ''}`}>
            <SiteHeader variant={header} />
            {children}
            <Footer />
        </div>
    );
}

/** The slim photo banner at the top of inner pages. */
export function PageHero({ eyebrow, title, doctor = false, meta, children }) {
    return (
        <section className={`page-hero${doctor ? ' page-hero--doctor' : ''}`}>
            <div className="page-hero__inner">
                <span className="page-hero__eyebrow">{eyebrow}</span>
                <h1>{title}</h1>
                {children && <p>{children}</p>}
                {meta && <div className="page-hero__meta">{meta.map((m) => <span key={m}>{m}</span>)}</div>}
            </div>
        </section>
    );
}

/** A coloured notice; type is "ok", "bad" or "info". */
export function Notice({ type = 'info', title, items, children, role }) {
    return (
        <div className={`notice notice-${type}`} role={role ?? (type === 'bad' ? 'alert' : 'status')}>
            {title && <strong>{title}</strong>}
            {children}
            {items && items.length > 0 && (
                <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
            )}
        </div>
    );
}

export function Loading({ children = 'Loading...' }) {
    return <div className="page-loading">{children}</div>;
}

/** Shown when a page's data could not be loaded. */
export function LoadError({ error, back }) {
    return (
        <section className="panel">
            <div className="empty-state">
                <p>{error?.message || 'Something went wrong. Please try again.'}</p>
                {back && <Link to={back[0]} className="btn btn-light">{back[1]}</Link>}
            </div>
        </section>
    );
}

/** Only for a signed-in account of `role`; anyone else goes to that portal's sign-in. */
export function RequireRole({ role, children }) {
    const { user, ready } = useAuth();
    const location = useLocation();
    if (!ready) return null;
    if (!user || user.role !== role) {
        return <Navigate to={LOGIN_PATH[role]} replace state={{ from: location.pathname + location.search }} />;
    }
    return children;
}
