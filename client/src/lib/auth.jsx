/**
 * Who is signed in. Loaded once from /api/auth/me; sign-in pages call
 * setUser() with the account the API returns, and any API call that gets a
 * 401 clears it (the route guard then sends the user to the sign-in page).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export const LOGIN_PATH = { patient: '/patient/login', doctor: '/doctor/login', admin: '/admin/login' };
export const HOME_PATH = { patient: '/patient', doctor: '/doctor', admin: '/admin' };

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        api.get('/auth/me')
            .then((data) => setUser(data.user))
            .catch(() => setUser(null))
            .finally(() => setReady(true));

        const expired = () => setUser(null);
        window.addEventListener('auth:expired', expired);
        return () => window.removeEventListener('auth:expired', expired);
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post('/auth/logout');
        } finally {
            setUser(null);
        }
    }, []);

    const value = useMemo(() => ({ user, ready, setUser, logout }), [user, ready, logout]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
