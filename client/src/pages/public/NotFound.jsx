import { Link } from 'react-router';
import { usePageTitle } from '../../lib/hooks.js';

export default function NotFound() {
    usePageTitle('404 Not Found');
    return (
        <div className="not-found">
            <div className="not-found__box">
                <h1>404</h1>
                <h2>Page Not Found</h2>
                <p>Sorry, the page you are looking for does not exist.</p>
                <p><Link to="/">Go to Homepage</Link></p>
            </div>
        </div>
    );
}
