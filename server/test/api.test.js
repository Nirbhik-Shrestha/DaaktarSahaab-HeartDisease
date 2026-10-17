/**
 * End-to-end API tests against a throwaway database (daaktarsahab_test).
 * Needs MongoDB running locally:  npm test  (from the project root)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

process.env.JWT_SECRET = 'test-secret';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `ds-test-uploads-${process.pid}`);
const TEST_DB = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/daaktarsahab_test';

const { createApp } = await import('../src/app.js');
const { connectDb, disconnectDb } = await import('../src/db.js');
const models = await import('../src/models/index.js');
const { default: bcrypt } = await import('bcryptjs');
const { dayOf } = await import('../src/lib/dates.js');

let server;
let base;

/** A browser stand-in: keeps the sign-in cookie between requests. */
class Client {
    constructor() {
        this.cookie = '';
    }

    async request(method, url, { body, form, csrf = true } = {}) {
        const headers = { Accept: 'application/json' };
        if (csrf) headers['X-Requested-With'] = 'fetch';
        if (this.cookie) headers.Cookie = this.cookie;
        let payload;
        if (form) {
            payload = form;
        } else if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
        }
        const res = await fetch(base + url, { method, headers, body: payload });
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) this.cookie = setCookie.split(';')[0];
        const type = res.headers.get('content-type') || '';
        const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
        return { status: res.status, data, headers: res.headers };
    }

    get(url) { return this.request('GET', url); }
    post(url, body, opts) { return this.request('POST', url, { body, ...opts }); }
    put(url, body) { return this.request('PUT', url, { body }); }
    del(url) { return this.request('DELETE', url); }
}

const addDays = (n) => dayOf(new Date(Date.now() + n * 86400000));
const READING = { age: 63, sex: 1, cp: 3, trestbps: 145, chol: 233, fbs: 1, restecg: 2, thalach: 150, exang: 0, oldpeak: 2.3, slope: 2, ca: 0, thal: 2 };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

const admin = new Client();
const doctor = new Client();
const patient = new Client();
const other = new Client();
const ctx = {};

before(async () => {
    await connectDb(TEST_DB);
    await models.Admin.db.dropDatabase();
    for (const Model of Object.values(models)) {
        if (Model?.init && Model.modelName) await Model.init();
    }
    await models.Admin.create({ email: 'admin@test.com', password: await bcrypt.hash('admin123', 4) });
    ctx.cardio = await models.Specialty.create({ name: 'Cardiologist' });
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
    server?.close();
    await models.Admin.db.dropDatabase();
    await disconnectDb();
    await rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

test('changes without the X-Requested-With header are refused (CSRF guard)', async () => {
    const res = await admin.post('/auth/admin/login', { email: 'admin@test.com', password: 'admin123' }, { csrf: false });
    assert.equal(res.status, 403);
});

test('admin signs in, adds a doctor and a session', async () => {
    const bad = await admin.post('/auth/admin/login', { email: 'admin@test.com', password: 'nope' });
    assert.equal(bad.status, 401);
    const res = await admin.post('/auth/admin/login', { email: 'ADMIN@test.com', password: 'admin123' });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.role, 'admin');

    const missing = await admin.post('/admin/doctors', { name: 'X' });
    assert.equal(missing.status, 422);
    assert.ok(missing.data.errors.includes('Please fill in every field.'));

    const added = await admin.post('/admin/doctors', {
        name: 'Asha Shrestha', email: 'asha@test.com', password: 'doctor123', contact: '9812345678',
        address: 'Kathmandu', nmc: 'NMC-1', specialtyId: String(ctx.cardio._id),
    });
    assert.equal(added.status, 201);
    const dup = await admin.post('/admin/doctors', {
        name: 'Asha 2', email: 'asha@test.com', password: 'doctor123', contact: '9812345678',
        address: 'Kathmandu', nmc: 'NMC-2', specialtyId: String(ctx.cardio._id),
    });
    assert.equal(dup.status, 422);

    const list = await admin.get('/admin/doctors');
    ctx.doctorId = list.data.doctors[0].id;

    const past = await admin.post('/admin/sessions', { doctorId: ctx.doctorId, date: addDays(-1), startTime: '09:00', slots: 3 });
    assert.equal(past.status, 422);
    const late = await admin.post('/admin/sessions', { doctorId: ctx.doctorId, date: addDays(2), startTime: '22:00', slots: 3 });
    assert.equal(late.status, 422);
    const ok = await admin.post('/admin/sessions', { doctorId: ctx.doctorId, date: addDays(2), startTime: '09:00', slots: 3 });
    assert.equal(ok.status, 201);
    const twice = await admin.post('/admin/sessions', { doctorId: ctx.doctorId, date: addDays(2), startTime: '13:00', slots: 1 });
    assert.equal(twice.status, 422);
});

test('patients register (validated) and cannot open other portals', async () => {
    const bad = await patient.post('/auth/patient/register', {
        name: 'Ram', email: 'ram@test.com', password: 'secret1', contact: '12345', address: 'Lalitpur', dob: '1980-01-01',
    });
    assert.equal(bad.status, 422);
    const res = await patient.post('/auth/patient/register', {
        name: 'Ram Thapa', email: 'ram@test.com', password: 'secret1', contact: '9801111111', address: 'Lalitpur', dob: '1980-01-01',
    });
    assert.equal(res.status, 201);
    const dupe = await other.post('/auth/patient/register', {
        name: 'Sita', email: 'sita@test.com', password: 'secret1', contact: '9801111111', address: 'Bhaktapur', dob: '1990-01-01',
    });
    assert.equal(dupe.status, 422);
    assert.equal((await other.post('/auth/patient/register', {
        name: 'Sita Rai', email: 'sita@test.com', password: 'secret1', contact: '9802222222', address: 'Bhaktapur', dob: '1990-01-01',
    })).status, 201);

    assert.equal((await patient.get('/doctor/dashboard')).status, 401);
    assert.equal((await patient.get('/admin/dashboard')).status, 401);
    assert.equal((await patient.get('/patient/dashboard')).status, 200);

    assert.equal((await doctor.post('/auth/doctor/login', { email: 'asha@test.com', password: 'doctor123' })).status, 200);
});

test('booking: one patient per slot, one slot per patient per session', async () => {
    const sessions = await patient.get('/patient/sessions');
    assert.equal(sessions.data.sessions.length, 1);
    ctx.sessionId = sessions.data.sessions[0].id;
    const session = await patient.get(`/patient/sessions/${ctx.sessionId}`);
    const [s1, s2] = session.data.session.slots;

    const booked = await patient.post('/patient/appointments', { slotId: s1.id });
    assert.equal(booked.status, 201);
    ctx.appointmentId = booked.data.appointment.id;

    assert.equal((await patient.post('/patient/appointments', { slotId: s2.id })).status, 409);
    const taken = await other.post('/patient/appointments', { slotId: s1.id });
    assert.equal(taken.status, 409);
    assert.match(taken.data.error, /already booked/);

    const after = await patient.get(`/patient/sessions/${ctx.sessionId}`);
    assert.equal(after.data.session.slots.filter((s) => s.booked).length, 1);
});

test('heart checks are validated, scored, and private', async () => {
    const invalid = await patient.post('/patient/readings', { ...READING, age: 500, thal: 7 });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.data.errors.length, 2);

    const res = await patient.post('/patient/readings', READING);
    assert.equal(res.status, 201);
    ctx.readingId = res.data.id;

    const detail = await patient.get(`/patient/readings/${ctx.readingId}`);
    assert.equal(detail.data.reading.riskScore, 0.5283); // matches the Python model's output
    assert.equal(detail.data.reading.assessment.highRisk, true);
    assert.ok(detail.data.reading.assessment.reasons.length > 0);

    assert.equal((await other.get(`/patient/readings/${ctx.readingId}`)).status, 404);
    assert.equal((await other.del(`/patient/readings/${ctx.readingId}`)).status, 404);

    const pdf = await patient.get(`/patient/readings/${ctx.readingId}/pdf`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(pdf.data.subarray(0, 5).toString(), '%PDF-');
});

test('sharing a heart check with an appointment lets only that doctor see it', async () => {
    assert.equal((await doctor.get(`/doctor/appointments/${ctx.appointmentId}/assessment`)).status, 404);
    assert.equal((await patient.post(`/patient/appointments/${ctx.appointmentId}/share`, { readingId: ctx.readingId })).status, 200);
    const seen = await doctor.get(`/doctor/appointments/${ctx.appointmentId}/assessment`);
    assert.equal(seen.status, 200);
    assert.equal(seen.data.patient.name, 'Ram Thapa');

    // The visit is in the future, so it cannot be recorded yet.
    const early = await doctor.put(`/doctor/appointments/${ctx.appointmentId}`, { status: 'completed', notes: 'x' });
    assert.equal(early.status, 422);
});

test('chat: conversation opened by booking, messages, read receipts, attachments', async () => {
    const list = await patient.get('/chat/conversations');
    assert.equal(list.data.conversations.length, 1);
    ctx.cid = list.data.conversations[0].id;
    assert.equal((await other.get('/chat/conversations')).data.conversations.length, 0);
    assert.equal((await other.get(`/chat/conversations/${ctx.cid}/messages`)).status, 404);

    const form = new FormData();
    form.append('body', 'Hello doctor <script>alert(1)</script>');
    const sent = await patient.request('POST', `/chat/conversations/${ctx.cid}/messages`, { form });
    assert.equal(sent.status, 201);
    assert.equal(sent.data.message.mine, true);

    assert.equal((await doctor.get('/chat/unread')).data.unread, 1);
    const poll = await doctor.get(`/chat/conversations/${ctx.cid}/messages`);
    assert.equal(poll.data.messages[0].body, 'Hello doctor <script>alert(1)</script>');
    assert.equal(poll.data.messages[0].mine, false);
    assert.equal((await doctor.get('/chat/unread')).data.unread, 0);

    const seen = await patient.get(`/chat/conversations/${ctx.cid}/messages?after=${sent.data.message.id}`);
    assert.equal(seen.data.seen.id, sent.data.message.id);

    // A real PNG is accepted; text pretending to be one is not.
    const image = new FormData();
    image.append('body', '');
    image.append('file', new Blob([PNG], { type: 'image/png' }), 'ecg.png');
    const withFile = await doctor.request('POST', `/chat/conversations/${ctx.cid}/messages`, { form: image });
    assert.equal(withFile.status, 201);
    assert.equal(withFile.data.message.attachment.image, true);

    const fake = new FormData();
    fake.append('file', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
    assert.equal((await doctor.request('POST', `/chat/conversations/${ctx.cid}/messages`, { form: fake })).status, 415);

    const url = withFile.data.message.attachment.url.replace('/api', '');
    const download = await patient.get(url);
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('content-type'), 'image/png');
    assert.equal((await other.get(url)).status, 404);

    // A heart check shared in the chat opens for the doctor through that message.
    const share = new FormData();
    share.append('body', '');
    share.append('readingId', ctx.readingId);
    const card = await patient.request('POST', `/chat/conversations/${ctx.cid}/messages`, { form: share });
    assert.equal(card.status, 201);
    assert.equal(card.data.message.assessment.available, true);
    ctx.cardMessageId = card.data.message.id;
    assert.equal((await doctor.get(`/doctor/chat-assessments/${ctx.cardMessageId}`)).status, 200);

    const context = await doctor.get(`/chat/conversations/${ctx.cid}/context`);
    assert.equal(context.data.context.age >= 40, true);
    assert.ok(context.data.context.next);
    assert.ok(context.data.context.check);

    const reply = await doctor.post('/chat/replies', { body: 'Please bring your reports.' });
    assert.equal(reply.status, 201);
    assert.equal((await doctor.get('/chat/replies')).data.saved.length, 1);
    assert.equal((await patient.get('/chat/replies')).status, 400);
});

test('cancelling keeps the reading and the chat; deleting a reading blanks its chat card', async () => {
    assert.equal((await patient.del(`/patient/appointments/${ctx.appointmentId}`)).status, 200);
    const reading = await patient.get(`/patient/readings/${ctx.readingId}`);
    assert.equal(reading.data.reading.shared, false);
    assert.equal((await patient.get('/chat/conversations')).data.conversations.length, 1);

    assert.equal((await patient.del(`/patient/readings/${ctx.readingId}`)).status, 200);
    const messages = await doctor.get(`/chat/conversations/${ctx.cid}/messages`);
    const cardMessage = messages.data.messages.find((m) => m.id === ctx.cardMessageId);
    assert.equal(cardMessage.assessment.available, false);
    assert.equal((await doctor.get(`/doctor/chat-assessments/${ctx.cardMessageId}`)).status, 404);
});

test('doctor sessions: only empty ones can be removed by the doctor', async () => {
    const added = await doctor.post('/doctor/sessions', { date: addDays(3), startTime: '10:00', slots: 2 });
    assert.equal(added.status, 201);
    const sessions = await doctor.get('/doctor/sessions');
    assert.equal(sessions.data.upcoming.length, 2);

    const fresh = sessions.data.upcoming.find((s) => s.date === addDays(3));
    const slot = (await other.get(`/patient/sessions/${fresh.id}`)).data.session.slots[0];
    assert.equal((await other.post('/patient/appointments', { slotId: slot.id })).status, 201);
    assert.equal((await doctor.del(`/doctor/sessions/${fresh.id}`)).status, 409);

    // The admin may, cancelling the booking with it.
    const removed = await admin.del(`/admin/sessions/${fresh.id}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.data.cancelledAppointments, 1);
});

test('password reset: link works once, then expires', async () => {
    const asked = await other.post('/auth/patient/forgot', { email: 'sita@test.com' });
    assert.equal(asked.status, 200);
    const token = new URL(asked.data.resetUrl).searchParams.get('token');
    assert.equal((await other.get(`/auth/patient/reset/${token}`)).data.valid, true);
    assert.equal((await other.post('/auth/patient/reset', { token, password: 'newpass1', confirm: 'nope' })).status, 422);
    assert.equal((await other.post('/auth/patient/reset', { token, password: 'newpass1', confirm: 'newpass1' })).status, 200);
    assert.equal((await other.post('/auth/patient/reset', { token, password: 'again12', confirm: 'again12' })).status, 410);
    assert.equal((await other.post('/auth/patient/login', { email: 'sita@test.com', password: 'newpass1' })).status, 200);
});

test('removing a doctor removes their sessions, appointments and chats', async () => {
    assert.equal((await admin.del(`/admin/doctors/${ctx.doctorId}`)).status, 200);
    assert.equal(await models.Schedule.countDocuments(), 0);
    assert.equal(await models.Appointment.countDocuments(), 0);
    assert.equal(await models.Conversation.countDocuments(), 0);
    assert.equal(await models.Message.countDocuments(), 0);
    // The doctor's sign-in stops working at once.
    assert.equal((await doctor.get('/doctor/dashboard')).status, 401);
});

test('signing out ends the session', async () => {
    assert.equal((await patient.post('/auth/logout')).status, 200);
    assert.equal((await patient.get('/patient/dashboard')).status, 401);
    assert.equal((await patient.get('/auth/me')).data.user, null);
});
