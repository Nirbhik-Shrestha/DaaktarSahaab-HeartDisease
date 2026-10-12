/**
 * Sign in, sign up (patients), sign out, and password reset for all roles.
 *
 *   GET  /api/auth/me
 *   POST /api/auth/:role/login             {email, password}
 *   POST /api/auth/patient/register        {name, email, password, contact, address, dob}
 *   POST /api/auth/logout
 *   POST /api/auth/:role/forgot            {email}
 *   GET  /api/auth/:role/reset/:token      is the link still valid?
 *   POST /api/auth/:role/reset             {token, password, confirm}
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { ACCOUNT_MODELS, Patient, nextSequence } from '../models/index.js';
import { signIn, signOut, currentAccount, accountSummary } from '../middleware/auth.js';
import { httpError, str } from '../lib/http.js';
import { today, isValidDate } from '../lib/dates.js';
import { config } from '../config.js';
import {
    NAME_PATTERN, PHONE_PATTERN, EMAIL_PATTERN, PHONE_MESSAGE, MIN_PASSWORD_LENGTH,
} from '../../../shared/constants.js';

const router = Router();
const RESET_TTL_MS = 30 * 60 * 1000;
const ROLE_LABEL = { patient: 'patient account', doctor: 'doctor account', admin: 'account' };

function modelFor(role) {
    const Model = ACCOUNT_MODELS[role];
    if (!Model) throw httpError(404, 'Not found.');
    return Model;
}

export const hashPassword = (password) => bcrypt.hash(password, 10);

/** Accounts migrated from PHP have $2y$ hashes; bcrypt treats them as $2b$. */
export function verifyPassword(password, hash) {
    if (!hash) return Promise.resolve(false);
    return bcrypt.compare(String(password), hash.replace(/^\$2y\$/, '$2b$'));
}

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

router.get('/me', async (req, res) => {
    const current = await currentAccount(req);
    res.json({ user: current ? accountSummary(current.role, current.account) : null });
});

router.post('/logout', (req, res) => {
    signOut(res);
    res.json({ ok: true });
});

router.post('/patient/register', async (req, res) => {
    const name = str(req.body.name);
    const email = str(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const contact = str(req.body.contact);
    const address = str(req.body.address);
    const dob = str(req.body.dob);

    // The browser checks these too, but that is trivially bypassed.
    let error = null;
    if (!name || !NAME_PATTERN.test(name)) error = 'Please enter a valid name.';
    else if (!EMAIL_PATTERN.test(email)) error = 'Please enter a valid email address.';
    else if (password.length < MIN_PASSWORD_LENGTH) error = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    else if (!PHONE_PATTERN.test(contact)) error = PHONE_MESSAGE;
    else if (!address) error = 'Please enter your address.';
    else if (!isValidDate(dob) || dob > today()) error = 'Please enter a valid date of birth.';
    else if (await Patient.exists({ email })) error = 'An account with this email already exists. Try signing in instead.';
    else if (await Patient.exists({ contact })) error = 'An account with this phone number already exists.';
    if (error) throw httpError(422, error);

    const patient = await Patient.create({
        name, email, contact, address, dob,
        password: await hashPassword(password),
        number: await nextSequence('patient'),
    });
    signIn(res, 'patient', patient);
    res.status(201).json({ user: accountSummary('patient', patient) });
});

router.post('/:role/login', async (req, res) => {
    const { role } = req.params;
    const Model = modelFor(role);
    const email = str(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) throw httpError(422, 'Please enter your email and password.');

    const account = await Model.findOne({ email });
    if (!account || !(await verifyPassword(password, account.password))) {
        throw httpError(401, 'Wrong email or password. Please try again.');
    }
    signIn(res, role, account);
    res.json({ user: accountSummary(role, account) });
});

router.post('/:role/forgot', async (req, res) => {
    const { role } = req.params;
    const Model = modelFor(role);
    const email = str(req.body.email).toLowerCase();
    if (!email) throw httpError(422, 'Please enter your email address.');

    const account = await Model.findOne({ email });
    if (!account) {
        if (!config.showResetLinks) {
            // Production: do not reveal which addresses have accounts.
            return res.json({ message: 'If that address has an account, a reset link has been sent to it.' });
        }
        throw httpError(404, `No ${ROLE_LABEL[role]} found with that email address.`);
    }

    const token = randomBytes(32).toString('hex');
    account.resetTokenHash = hashToken(token);
    account.resetTokenExpiry = new Date(Date.now() + RESET_TTL_MS);
    await account.save();

    const origin = req.get('origin') || config.clientOrigin;
    const resetUrl = `${origin}/${role}/forgot-password?token=${token}`;
    if (!config.showResetLinks) {
        // There is no email service yet; the link goes to the server log.
        console.log(`Password reset link for ${email} (${role}): ${resetUrl}`);
        return res.json({ message: 'If that address has an account, a reset link has been sent to it.' });
    }
    res.json({ message: 'A password-reset link has been generated.', resetUrl });
});

async function findByToken(Model, token) {
    if (typeof token !== 'string' || !/^[a-f\d]{64}$/.test(token)) return null;
    return Model.findOne({ resetTokenHash: hashToken(token), resetTokenExpiry: { $gt: new Date() } });
}

router.get('/:role/reset/:token', async (req, res) => {
    const account = await findByToken(modelFor(req.params.role), req.params.token);
    res.json({ valid: Boolean(account) });
});

router.post('/:role/reset', async (req, res) => {
    const Model = modelFor(req.params.role);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const confirm = typeof req.body.confirm === 'string' ? req.body.confirm : '';
    if (password !== confirm) throw httpError(422, 'Passwords do not match.');
    if (password.length < MIN_PASSWORD_LENGTH) throw httpError(422, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

    const account = await findByToken(Model, req.body.token);
    if (!account) throw httpError(410, 'This reset link is invalid or has expired.');
    account.password = await hashPassword(password);
    account.resetTokenHash = null;
    account.resetTokenExpiry = null;
    await account.save();
    res.json({ message: 'Your password was updated. You can sign in with it now.' });
});

export default router;
