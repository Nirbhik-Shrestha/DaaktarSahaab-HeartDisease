import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from './lib/auth.jsx';
import App from './App.jsx';

// Order matters as it did in the PHP pages: page styles come after site.css.
import './styles/base.css';
import './styles/home.css';
import './styles/site.css';
import './styles/admin.css';
import './styles/risk.css';
import './styles/chat.css';
import './styles/header.css';
import './styles/pages.css';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>,
);
