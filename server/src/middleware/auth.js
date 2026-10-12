/**
 * Who is signed in, and which portal they belong to.
 *
 * Sign-in sets an httpOnly cookie holding a signed token with the account's
 * id and role. Every portal route calls requireRole() first: a patient's
 * cookie is refused by /api/doctor and /api/admin, and the current account is
 * loaded fresh on every request, so a deleted account is signed out at once.
 */
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ACCOUNT_MODELS } from '../models/index.js';
import { httpError } from '../lib/http.js';

export const COOKIE_NAME = 'ds_session';
const TOKEN_TTL = '12h';

const cookieOptions = () => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    // No maxAge: a browser-session cookie, removed when the browser closes.
});

export function signIn(res, role, account) {
    const token = jwt.sign({ sub: String(account._id), role }, config.jwtSecret, { expiresIn: TOKEN_TTL });
    res.cookie(COOKIE_NAME, token, cookieOptions());
}

export function signOut(res) {
    res.clearCookie(COOKIE_NAME, cookieOptions());
}

/** {role, account} for the request's cookie, or null. */
export async function currentAccount(req) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return null;
    let payload;
    try {
        payload = jwt.verify(token, config.jwtSecret);
    } catch {
        return null;
    }
    const Model = ACCOUNT_MODELS[payload.role];
    if (!Model) return null;
    const account = await Model.findById(payload.sub);
    return account ? { role: payload.role, account } : null;
}

/** Let the request through only for a signed-in account of `role`. */
export function requireRole(role) {
    return async (req, res, next) => {
        const current = await currentAccount(req);
        if (!current || current.role !== role) {
            if (req.cookies?.[COOKIE_NAME] && !current) {
                // The account was deleted, or the token expired.
                signOut(res);
            }
            throw httpError(401, 'Please log in again.', { role });
        }
        req.role = role;
        req.user = current.account;
        next();
    };
}

/**
 * Changes must come from our own pages. The custom header cannot be added by
 * a form on another site, and a cross-site fetch() carrying it needs a CORS
 * preflight this API never grants. (The cookie is also SameSite=Lax.)
 */
export function requireSameSite(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.get('X-Requested-With') === 'fetch') {
        return next();
    }
    throw httpError(403, 'This can only be done from the DaaktarSahab pages.');
}

/** The signed-in account as the React app sees it. */
export function accountSummary(role, account) {
    return {
        id: String(account._id),
        role,
        email: account.email,
        name: role === 'admin' ? 'Admin' : account.name,
    };
}
