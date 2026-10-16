/**
 * Copy everything from the old PHP app's MySQL database into MongoDB.
 *
 *   npm run migrate:mysql             (refuses if MongoDB already has accounts)
 *   npm run migrate:mysql -- --force  (empties the MongoDB collections first)
 *
 * Reads MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE
 * (defaults: WAMP's 127.0.0.1:3306, root, no password, doctorProject).
 * Passwords keep working: PHP's bcrypt hashes are copied as they are.
 *
 * MySQL DATETIME/TIMESTAMP values were written on the clinic's clock
 * (Asia/Kathmandu, UTC+05:45), so they are read as that zone.
 * Chat attachments are copied from the old upload folder (CHAT_UPLOAD_DIR_OLD,
 * default C:/wamp64/doctorproject_uploads/chat) into the new one.
 */
import mysql from 'mysql2/promise';
import mongoose from 'mongoose';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { connectDb, disconnectDb } from '../db.js';
import { config } from '../config.js';
import {
    Admin, Specialty, Doctor, Patient, Schedule, Appointment, Reading,
    Conversation, Message, QuickReply, ContactMessage, Counter,
} from '../models/index.js';
import { scoreReading } from '../ml/predict.js';

const force = process.argv.includes('--force');
const OLD_UPLOADS = process.env.CHAT_UPLOAD_DIR_OLD || 'C:/wamp64/doctorproject_uploads/chat';
const ALL_MODELS = [Admin, Specialty, Doctor, Patient, Schedule, Appointment, Reading,
    Conversation, Message, QuickReply, ContactMessage, Counter];

const oid = () => new mongoose.Types.ObjectId();
const hhmm = (time) => String(time).slice(0, 5);
/** "YYYY-MM-DD HH:MM:SS" on the Kathmandu clock -> Date. */
const kathmandu = (value) => (value ? new Date(`${String(value).replace(' ', 'T')}+05:45`) : null);

const sql = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'doctorProject',
    dateStrings: true, // DATE/DATETIME as written, no time-zone shifting
});
const rows = async (query) => (await sql.query(query))[0];
async function tableExists(name) {
    return (await rows(`SHOW TABLES LIKE '${name}'`)).length > 0;
}
async function columnExists(table, column) {
    return (await rows(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`)).length > 0;
}

await connectDb();
for (const Model of ALL_MODELS) await Model.init();

const existing = await Promise.all([Admin, Doctor, Patient].map((M) => M.countDocuments()));
if (existing.some((n) => n > 0)) {
    if (!force) {
        console.error('MongoDB already has accounts. Re-run with --force to replace everything with the MySQL data.');
        await sql.end();
        await disconnectDb();
        process.exit(1);
    }
    for (const Model of ALL_MODELS) await Model.deleteMany({});
    console.log('Emptied the MongoDB collections (--force).');
}

/** Insert raw documents (keeping our own _id and timestamps). */
async function insert(Model, docs) {
    if (!docs.length) return;
    const casted = docs.map((d) => {
        const doc = new Model(d);
        const error = doc.validateSync();
        if (error) throw new Error(`${Model.modelName}: ${error.message}`);
        return doc.toObject({ depopulate: true });
    });
    await Model.collection.insertMany(casted);
}

// ---- Specialties, admin, doctors, patients --------------------------------
const specialtyId = new Map();
await insert(Specialty, (await rows('SELECT * FROM specialties')).map((r) => {
    const _id = oid();
    specialtyId.set(r.spid, _id);
    return { _id, name: r.sname.trim() };
}));

await insert(Admin, (await rows('SELECT * FROM admin')).map((r) => ({
    _id: oid(), email: r.aemail.toLowerCase(), password: r.apassword,
})));

const doctorId = new Map();
await insert(Doctor, (await rows('SELECT * FROM doctors')).map((r) => {
    const _id = oid();
    doctorId.set(r.did, _id);
    return {
        _id, name: r.dname, email: r.demail.toLowerCase(), password: r.dpassword,
        contact: r.dcontact, address: r.daddress, nmc: r.nmc, specialty: specialtyId.get(r.spid),
    };
}));

const patientId = new Map();
const patients = await rows('SELECT * FROM patients ORDER BY pid');
await insert(Patient, patients.map((r) => {
    const _id = oid();
    patientId.set(r.pid, _id);
    return {
        _id, number: r.pid, name: r.pname, email: r.pemail.toLowerCase(), password: r.ppassword,
        contact: r.pcontact, address: r.paddress, dob: r.pdob,
    };
}));

// ---- Sessions with their slots, and appointments --------------------------
const scheduleDoc = new Map();
const slotInfo = new Map(); // tid -> {slotId, scheduleId, doctorId, start, end}
for (const r of await rows('SELECT * FROM schedule')) {
    scheduleDoc.set(r.scid, { _id: oid(), doctor: doctorId.get(r.did), date: r.sdate, slots: [] });
}
for (const t of await rows('SELECT * FROM timeslot ORDER BY start_time')) {
    const schedule = scheduleDoc.get(t.scid);
    if (!schedule) continue;
    const slot = { _id: oid(), start: hhmm(t.start_time), end: hhmm(t.end_time) };
    schedule.slots.push(slot);
    slotInfo.set(t.tid, { slotId: slot._id, scheduleId: schedule._id, doctorId: schedule.doctor, start: slot.start, end: slot.end });
}
await insert(Schedule, [...scheduleDoc.values()].filter((s) => s.doctor));

const hasStatus = await columnExists('appointment', 'status');
const appointmentId = new Map();
await insert(Appointment, (await rows('SELECT * FROM appointment')).flatMap((r) => {
    const slot = slotInfo.get(r.tid);
    if (!slot || !patientId.has(r.pid)) return [];
    const _id = oid();
    appointmentId.set(r.apid, _id);
    return [{
        _id, patient: patientId.get(r.pid), doctor: slot.doctorId, schedule: slot.scheduleId, slot: slot.slotId,
        date: r.adate, start: slot.start, end: slot.end,
        status: hasStatus ? r.status : 'booked',
        doctorNotes: hasStatus ? r.doctor_notes : null,
        notesUpdatedAt: hasStatus ? kathmandu(r.notes_updated_at) : null,
    }];
}));

// ---- Heart checks ----------------------------------------------------------
const hasScore = await columnExists('patient_data', 'risk_score');
const hasApid = await columnExists('patient_data', 'apid');
const readingId = new Map();
const readings = await rows('SELECT * FROM patient_data ORDER BY pdid');
await insert(Reading, readings.flatMap((r) => {
    if (!patientId.has(r.pid)) return [];
    const _id = oid();
    readingId.set(r.pdid, _id);
    const values = {
        age: r.age, sex: r.sex, cp: r.cp, trestbps: r.trestbps, chol: r.chol, fbs: r.fbs, restecg: r.restecg,
        thalach: r.thalach, exang: r.exang, oldpeak: Number(r.oldpeak), slope: r.slope, ca: r.ca, thal: r.thal,
    };
    const stored = hasScore && r.risk_score !== null ? Number(r.risk_score) : null;
    return [{
        _id, number: r.pdid, patient: patientId.get(r.pid),
        appointment: hasApid && r.apid ? (appointmentId.get(r.apid) ?? null) : null,
        ...values,
        riskScore: stored ?? scoreReading(values).riskScore,
        takenAt: kathmandu(r.timestamp) ?? new Date(),
    }];
}));

// ---- Chat -------------------------------------------------------------------
let messageCount = 0;
let fileCount = 0;
if (await tableExists('chat_conversations')) {
    const conversationId = new Map();
    await insert(Conversation, (await rows('SELECT * FROM chat_conversations')).flatMap((r) => {
        if (!patientId.has(r.pid) || !doctorId.has(r.did)) return [];
        const _id = oid();
        conversationId.set(r.cid, _id);
        const at = kathmandu(r.created_at) ?? new Date();
        return [{ _id, patient: patientId.get(r.pid), doctor: doctorId.get(r.did), createdAt: at, updatedAt: at }];
    }));

    const hasKind = await columnExists('chat_messages', 'kind');
    const attachments = new Map();
    if (await tableExists('chat_attachments')) {
        for (const a of await rows('SELECT * FROM chat_attachments')) attachments.set(a.mid, a);
    }
    await mkdir(config.uploadDir, { recursive: true });

    const messages = [];
    // In mid order, so the new ids sort the same way the old ones did.
    for (const m of await rows('SELECT * FROM chat_messages ORDER BY mid')) {
        if (!conversationId.has(m.cid)) continue;
        const a = attachments.get(m.mid);
        let attachment = null;
        if (a) {
            try {
                await copyFile(path.join(OLD_UPLOADS, path.basename(a.stored_name)), path.join(config.uploadDir, path.basename(a.stored_name)));
                fileCount++;
            } catch {
                console.warn(`Attachment file missing: ${a.stored_name} (message kept, file link will 404)`);
            }
            attachment = { storedName: a.stored_name, originalName: a.original_name, mime: a.mime, size: a.size };
        }
        messages.push({
            _id: oid(),
            conversation: conversationId.get(m.cid),
            senderRole: m.sender_role,
            kind: hasKind ? m.kind : 'text',
            body: m.body,
            reading: hasKind && m.pdid ? (readingId.get(m.pdid) ?? null) : null,
            attachment,
            createdAt: kathmandu(m.created_at) ?? new Date(),
            readAt: kathmandu(m.read_at),
        });
    }
    await insert(Message, messages);
    messageCount = messages.length;

    if (await tableExists('chat_quick_replies')) {
        await insert(QuickReply, (await rows('SELECT * FROM chat_quick_replies')).flatMap((q) => (
            doctorId.has(q.did) ? [{ _id: oid(), doctor: doctorId.get(q.did), body: q.body }] : []
        )));
    }
}

if (await tableExists('contact_messages')) {
    await insert(ContactMessage, (await rows('SELECT * FROM contact_messages')).map((c) => {
        const at = kathmandu(c.created_at) ?? new Date();
        return { _id: oid(), name: c.name, email: c.email, subject: c.subject, message: c.message, createdAt: at, updatedAt: at };
    }));
}

// New patients and readings continue the old numbering.
const maxOf = (list, key) => list.reduce((m, r) => Math.max(m, r[key]), 0);
await Counter.updateOne({ _id: 'patient' }, { $set: { seq: maxOf(patients, 'pid') } }, { upsert: true });
await Counter.updateOne({ _id: 'reading' }, { $set: { seq: maxOf(readings, 'pdid') } }, { upsert: true });

const counts = await Promise.all([Specialty, Admin, Doctor, Patient, Schedule, Appointment, Reading, Conversation, ContactMessage]
    .map(async (M) => `${M.modelName}: ${await M.countDocuments()}`));
console.log(`Migrated from MySQL.\n  ${counts.join('\n  ')}\n  Message: ${messageCount} (${fileCount} attachment files copied)`);

await sql.end();
await disconnectDb();
