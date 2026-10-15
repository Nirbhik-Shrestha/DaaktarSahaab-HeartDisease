/**
 * Messaging between a patient and a doctor they have booked with.
 *
 * There is one conversation per patient-doctor pair, opened the first time
 * the patient books that doctor and kept for good: cancelling a booking
 * leaves it and its history in place. Only the two people in a conversation
 * can read or post to it; admins have no access. Every lookup below puts
 * "this conversation is mine" into the query itself, so an id taken from the
 * request is never trusted on its own.
 *
 * Message bodies are stored as the plain text that was typed; the React app
 * renders them as text, never as HTML.
 *
 *   GET    /api/chat/conversations                      list (+ unread total)
 *   GET    /api/chat/unread                             total, for the header badge
 *   GET    /api/chat/conversations/:cid/messages        ?after=<id> new ones (marks them read)
 *                                                       ?before=<id> the page before
 *   GET    /api/chat/conversations/:cid/context         appointments (+ patient details for doctors)
 *   POST   /api/chat/conversations/:cid/messages        multipart: body, file?, readingId?
 *   GET    /api/chat/files/:messageId                   an attachment's bytes
 *   GET    /api/chat/readings                           patients: their readings, to share
 *   GET    /api/chat/replies                            doctors: quick replies
 *   POST   /api/chat/replies     DELETE /api/chat/replies/:id
 */
import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import {
    Conversation, Message, Reading, Appointment, QuickReply,
} from '../models/index.js';
import { currentAccount } from '../middleware/auth.js';
import { httpError, isId } from '../lib/http.js';
import { today, ageOn } from '../lib/dates.js';
import { removeAttachmentFile } from '../lib/cascade.js';
import { ensureRiskScores } from '../lib/readings.js';
import { config } from '../config.js';
import {
    CHAT_MAX_LENGTH, CHAT_PREVIEW_LENGTH, CHAT_PAGE_SIZE, CHAT_UPLOAD_LIMIT, CHAT_UPLOAD_TYPES,
    CHAT_QUICK_REPLY_MAX_LENGTH, CHAT_QUICK_REPLY_LIMIT,
} from '../../../shared/constants.js';

const router = Router();

// Offered to every doctor in Quick replies, next to their own saved ones.
export const SUGGESTED_REPLIES = [
    'Please bring your latest ECG report to your visit.',
    'Please take the heart check before your visit and share it with me here.',
    'Thank you, I have received this and will review it before your appointment.',
    'Please continue your current medication until we meet.',
    'If your symptoms get worse, call 102 or go to the nearest hospital straight away.',
];

const OWNER = { patient: 'patient', doctor: 'doctor' };
const other = (role) => (role === 'patient' ? 'doctor' : 'patient');
const chars = (text) => [...text].length;
const sizeLabel = (bytes) => (bytes >= 1048576 ? `${Math.round(bytes / 104857.6) / 10} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// Patients and doctors only.
router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const current = await currentAccount(req);
    if (!current || !OWNER[current.role]) throw httpError(401, 'Please log in again.');
    req.role = current.role;
    req.user = current.account;
    next();
});

/** The conversation, only if the signed-in user is part of it. */
async function findConversation(req, cid) {
    if (!isId(cid)) return null;
    return Conversation.findOne({ _id: cid, [OWNER[req.role]]: req.user._id })
        .populate('patient', 'name dob')
        .populate({ path: 'doctor', select: 'name specialty', populate: { path: 'specialty', select: 'name' } })
        .lean();
}

async function requireConversation(req) {
    const conversation = await findConversation(req, req.params.cid);
    // 404 rather than 403: whether someone else's id exists is not ours to say.
    if (!conversation) throw httpError(404, 'Conversation not found.');
    return conversation;
}

// ---- Formatting ----------------------------------------------------------

function formatMessage(m, role, readings) {
    const message = {
        id: String(m._id),
        mine: m.senderRole === role,
        body: m.body,
        createdAt: m.createdAt,
        attachment: null,
        assessment: null,
    };
    if (m.attachment) {
        message.attachment = {
            url: `/api/chat/files/${m._id}`,
            name: m.attachment.originalName,
            size: sizeLabel(m.attachment.size),
            image: m.attachment.mime.startsWith('image/'),
        };
    }
    if (m.kind === 'assessment') {
        const reading = m.reading ? readings.get(String(m.reading)) : null;
        // The patient opens their own result page; the doctor gets the chat
        // share view, which checks the reading was posted to them.
        message.assessment = reading
            ? { available: true, readingId: String(reading._id), takenAt: reading.takenAt, riskScore: reading.riskScore ?? null }
            : { available: false };
    }
    return message;
}

async function formatMessages(list, role) {
    const ids = list.filter((m) => m.kind === 'assessment' && m.reading).map((m) => m.reading);
    const readings = ids.length ? await Reading.find({ _id: { $in: ids } }, 'takenAt riskScore').lean() : [];
    const byId = new Map(readings.map((r) => [String(r._id), r]));
    return list.map((m) => formatMessage(m, role, byId));
}

function preview(m) {
    let text;
    if (m.kind === 'assessment') text = 'Shared a heart check';
    else if (m.body === '' && m.attachment) text = `Attachment: ${m.attachment.originalName}`;
    else text = m.body.replace(/\s+/gu, ' ');
    const list = [...text];
    return list.length > CHAT_PREVIEW_LENGTH ? `${list.slice(0, CHAT_PREVIEW_LENGTH).join('').trimEnd()}…` : text;
}

// ---- List and unread -----------------------------------------------------

async function unreadTotal(req) {
    const ids = await Conversation.find({ [OWNER[req.role]]: req.user._id }).distinct('_id');
    return Message.countDocuments({ conversation: { $in: ids }, senderRole: other(req.role), readAt: null });
}

router.get('/conversations', async (req, res) => {
    const role = req.role;
    const conversations = await Conversation.find({ [OWNER[role]]: req.user._id })
        .populate('patient', 'name')
        .populate({ path: 'doctor', select: 'name specialty', populate: { path: 'specialty', select: 'name' } })
        .lean();
    const stats = await Message.aggregate([
        { $match: { conversation: { $in: conversations.map((c) => c._id) } } },
        { $sort: { _id: -1 } },
        {
            $group: {
                _id: '$conversation',
                last: { $first: '$$ROOT' },
                unread: { $sum: { $cond: [{ $and: [{ $eq: ['$senderRole', other(role)] }, { $eq: ['$readAt', null] }] }, 1, 0] } },
            },
        },
    ]);
    const statsBy = new Map(stats.map((s) => [String(s._id), s]));

    let total = 0;
    const list = conversations.map((c) => {
        const s = statsBy.get(String(c._id));
        total += s ? s.unread : 0;
        return {
            id: String(c._id),
            // A patient sees the doctor (with specialty); a doctor sees the patient.
            name: role === 'patient' ? `Dr. ${c.doctor?.name ?? ''}` : (c.patient?.name ?? ''),
            subtitle: role === 'patient' ? (c.doctor?.specialty?.name ?? '') : '',
            last: s ? { preview: preview(s.last), mine: s.last.senderRole === role, at: s.last.createdAt } : null,
            unread: s ? s.unread : 0,
            activeAt: s ? s.last.createdAt : c.createdAt,
        };
    });
    list.sort((a, b) => new Date(b.activeAt) - new Date(a.activeAt) || b.id.localeCompare(a.id));
    res.json({ conversations: list, unread: total });
});

router.get('/unread', async (req, res) => {
    res.json({ unread: await unreadTotal(req) });
});

// ---- Messages ------------------------------------------------------------

/**
 * One page of messages, oldest first.
 *
 *   ?after=<id>   the messages after it (polling forward); marks them read
 *   ?before=<id>  the page just before it ("Load older messages")
 *   neither       the newest page (a thread being opened); marks it read
 */
router.get('/conversations/:cid/messages', async (req, res) => {
    const conversation = await requireConversation(req);
    const { after, before } = req.query;
    if ((after && !isId(after)) || (before && !isId(before))) throw httpError(400, 'Invalid position.');

    const filter = { conversation: conversation._id };
    let rows;
    let hasOlder = false;
    if (after) {
        filter._id = { $gt: new mongoose.Types.ObjectId(after) };
        rows = await Message.find(filter).sort({ _id: 1 }).limit(CHAT_PAGE_SIZE).lean();
    } else {
        if (before) filter._id = { $lt: new mongoose.Types.ObjectId(before) };
        // One extra row tells us whether anything older is left.
        rows = await Message.find(filter).sort({ _id: -1 }).limit(CHAT_PAGE_SIZE + 1).lean();
        hasOlder = rows.length > CHAT_PAGE_SIZE;
        rows = rows.slice(0, CHAT_PAGE_SIZE).reverse();
    }
    const messages = await formatMessages(rows, req.role);

    if (before) {
        return res.json({ messages, hasOlder });
    }

    // Mark the other side's messages read, up to the newest one actually
    // delivered: a message that arrives in between still counts as unread.
    if (rows.length) {
        await Message.updateMany(
            { conversation: conversation._id, senderRole: other(req.role), readAt: null, _id: { $lte: rows[rows.length - 1]._id } },
            { $set: { readAt: new Date() } },
        );
    }

    // My newest message the other side has read, for "Seen".
    const seen = await Message.findOne(
        { conversation: conversation._id, senderRole: req.role, readAt: { $ne: null } },
        'readAt',
    ).sort({ _id: -1 }).lean();

    const response = { messages, seen: seen ? { id: String(seen._id), at: seen.readAt } : null };
    if (!after) response.hasOlder = hasOlder;
    // A full page means more are waiting: the browser asks again at once.
    response.more = Boolean(after) && rows.length >= CHAT_PAGE_SIZE;
    res.json(response);
});

/**
 * What to show under the name at the top of a thread: the next and last
 * appointment between the two. A doctor also gets the patient's age and
 * their latest heart check, but only one the patient chose to share with this
 * doctor (attached to one of the doctor's appointments, or posted here).
 */
router.get('/conversations/:cid/context', async (req, res) => {
    const conversation = await requireConversation(req);
    const pid = conversation.patient._id;
    const did = conversation.doctor._id;
    const now = today();

    const next = await Appointment.findOne({ patient: pid, doctor: did, date: { $gte: now }, status: 'booked' })
        .sort({ date: 1, start: 1 }).lean();
    const last = await Appointment.findOne({
        patient: pid, doctor: did, $or: [{ date: { $lt: now } }, { status: { $ne: 'booked' } }],
    }).sort({ date: -1, start: -1 }).lean();

    const context = {
        next: next ? { date: next.date, start: next.start } : null,
        last: last ? { date: last.date, start: last.start, status: last.status } : null,
    };

    if (req.role === 'doctor') {
        context.age = ageOn(conversation.patient.dob, now);
        const appointmentIds = await Appointment.find({ patient: pid, doctor: did }).distinct('_id');
        const viaAppointment = await Reading.find({ patient: pid, appointment: { $in: appointmentIds } }).lean();
        const posted = await Message.find({ conversation: conversation._id, kind: 'assessment', senderRole: 'patient', reading: { $ne: null } }, 'reading').lean();
        const viaChat = posted.length
            ? await Reading.find({ _id: { $in: posted.map((m) => m.reading) }, patient: pid }).lean()
            : [];

        const candidates = [
            ...viaAppointment.map((r) => ({ reading: r, appointmentId: String(r.appointment), messageId: null })),
            ...viaChat.map((r) => ({
                reading: r,
                appointmentId: null,
                // The newest message that posted this reading.
                messageId: String(posted.filter((m) => String(m.reading) === String(r._id)).map((m) => m._id).sort().pop()),
            })),
        ].sort((a, b) => new Date(b.reading.takenAt) - new Date(a.reading.takenAt) || String(b.reading._id).localeCompare(String(a.reading._id)));

        if (candidates.length) {
            const pick = candidates[0];
            await ensureRiskScores([pick.reading]);
            context.check = {
                takenAt: pick.reading.takenAt,
                riskScore: pick.reading.riskScore ?? null,
                appointmentId: pick.appointmentId,
                messageId: pick.messageId,
            };
        } else {
            context.check = null;
        }
    }
    res.json({ context });
});

// ---- Sending -------------------------------------------------------------

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: CHAT_UPLOAD_LIMIT, files: 1, fields: 10 },
});

function parseUpload(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (err && err.code === 'LIMIT_FILE_SIZE') {
            return next(httpError(413, `That file is too large. The limit is ${sizeLabel(CHAT_UPLOAD_LIMIT)}.`));
        }
        if (err) return next(httpError(400, 'The file could not be uploaded. Please try again.'));
        next();
    });
}

/** The type read from the file's own bytes, never the name or the browser's claim. */
export function sniffMime(buffer) {
    const b = buffer;
    if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
    if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png';
    if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
    if (b.length >= 5 && b.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf';
    return null;
}

/** A display name for an upload: no path, no control characters, right extension. */
export function cleanFileName(name, extension) {
    let base = String(name || '').replace(/\\/g, '/').split('/').pop();
    base = base.replace(/[\x00-\x1F\x7F]+/g, '').trim();
    const dot = base.lastIndexOf('.');
    const given = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
    const matches = given === extension || (extension === 'jpg' && given === 'jpeg');
    let stem = matches ? base.slice(0, dot) : base;
    stem = [...stem].slice(0, 140).join('');
    if (!stem) stem = 'attachment';
    return `${stem}.${matches ? given : extension}`;
}

router.post('/conversations/:cid/messages', parseUpload, async (req, res) => {
    // One line-ending style, and no whitespace-only messages.
    const body = (typeof req.body.body === 'string' ? req.body.body : '').replace(/\r\n?/g, '\n').trim();
    const file = req.file || null;
    // Only a patient shares readings, and only their own (checked below).
    const readingId = req.role === 'patient' && isId(req.body.readingId) ? req.body.readingId : null;

    if (!body.isWellFormed()) throw httpError(422, 'That message contains characters that cannot be sent.');
    if (!body && !file && !readingId) throw httpError(422, 'Please type a message.');
    if (chars(body) > CHAT_MAX_LENGTH) throw httpError(422, `Messages can be at most ${CHAT_MAX_LENGTH} characters.`);

    const conversation = await requireConversation(req);

    let reading = null;
    if (readingId) {
        reading = await Reading.findOne({ _id: readingId, patient: conversation.patient._id }).lean();
        if (!reading) throw httpError(404, 'That heart check could not be found.');
    }

    let attachment = null;
    if (file) {
        const mime = sniffMime(file.buffer);
        if (!mime || !CHAT_UPLOAD_TYPES[mime]) throw httpError(415, 'Only photos (JPG, PNG, WebP) and PDF files can be sent.');
        if (!file.size) throw httpError(400, 'The file could not be uploaded. Please try again.');
        const extension = CHAT_UPLOAD_TYPES[mime];
        const storedName = `${randomBytes(16).toString('hex')}.${extension}`;
        await mkdir(config.uploadDir, { recursive: true });
        await writeFile(path.join(config.uploadDir, storedName), file.buffer, { mode: 0o600 });
        attachment = { storedName, originalName: cleanFileName(file.originalname, extension), mime, size: file.size };
    }

    let message;
    try {
        message = await Message.create({
            conversation: conversation._id,
            senderRole: req.role,
            kind: reading ? 'assessment' : 'text',
            body,
            reading: reading ? reading._id : null,
            attachment,
        });
    } catch (err) {
        if (attachment) await removeAttachmentFile(attachment.storedName);
        throw err;
    }

    const [formatted] = await formatMessages([message.toObject()], req.role);
    res.status(201).json({ message: formatted });
});

// ---- Attachments ---------------------------------------------------------

router.get('/files/:messageId', async (req, res) => {
    const notFound = () => httpError(404, 'File not found.');
    if (!isId(req.params.messageId)) throw notFound();
    const message = await Message.findOne({ _id: req.params.messageId, attachment: { $ne: null } }).lean();
    if (!message) throw notFound();
    // The ownership check: the message must be in one of the user's conversations.
    if (!(await Conversation.exists({ _id: message.conversation, [OWNER[req.role]]: req.user._id }))) throw notFound();

    const { storedName, originalName, mime } = message.attachment;
    const file = path.join(config.uploadDir, path.basename(storedName));
    let info;
    try {
        info = await stat(file);
    } catch {
        throw notFound();
    }

    const ascii = originalName.replace(/[^A-Za-z0-9._-]+/g, '_');
    res.set({
        'Content-Type': mime,
        'Content-Length': String(info.size),
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        // Shown in the browser (photos, PDFs), with the sender's file name on save.
        'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    });
    if (mime.startsWith('image/')) {
        // An image opened on its own can load nothing and run nothing. Not set
        // for PDFs: it would also block the browser's built-in PDF viewer.
        res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
    }
    createReadStream(file).pipe(res);
});

// ---- Patients: readings to share -----------------------------------------

router.get('/readings', async (req, res) => {
    if (req.role !== 'patient') throw httpError(400, 'Unknown action.');
    const readings = await ensureRiskScores(
        await Reading.find({ patient: req.user._id }, 'takenAt riskScore age sex cp trestbps chol fbs restecg thalach exang oldpeak slope ca thal')
            .sort({ takenAt: -1, _id: -1 }).limit(20).lean(),
    );
    res.json({ readings: readings.map((r) => ({ id: String(r._id), takenAt: r.takenAt, riskScore: r.riskScore ?? null })) });
});

// ---- Doctors: quick replies ----------------------------------------------

function doctorOnly(req) {
    if (req.role !== 'doctor') throw httpError(400, 'Unknown action.');
}

router.get('/replies', async (req, res) => {
    doctorOnly(req);
    const saved = await QuickReply.find({ doctor: req.user._id }).sort({ _id: 1 }).lean();
    res.json({ suggested: SUGGESTED_REPLIES, saved: saved.map((r) => ({ id: String(r._id), body: r.body })) });
});

router.post('/replies', async (req, res) => {
    doctorOnly(req);
    const body = (typeof req.body.body === 'string' ? req.body.body : '').replace(/\r\n?/g, '\n').trim();
    if (!body.isWellFormed()) throw httpError(422, 'That message contains characters that cannot be sent.');
    if (!body) throw httpError(422, 'Please type a message.');
    if (chars(body) > CHAT_QUICK_REPLY_MAX_LENGTH) throw httpError(422, `Quick replies can be at most ${CHAT_QUICK_REPLY_MAX_LENGTH} characters.`);
    if (await QuickReply.countDocuments({ doctor: req.user._id }) >= CHAT_QUICK_REPLY_LIMIT) {
        throw httpError(422, `You can save up to ${CHAT_QUICK_REPLY_LIMIT} quick replies.`);
    }
    const reply = await QuickReply.create({ doctor: req.user._id, body });
    res.status(201).json({ reply: { id: String(reply._id), body: reply.body } });
});

router.delete('/replies/:id', async (req, res) => {
    doctorOnly(req);
    if (!isId(req.params.id)) throw httpError(404, 'Quick reply not found.');
    const { deletedCount } = await QuickReply.deleteOne({ _id: req.params.id, doctor: req.user._id });
    if (!deletedCount) throw httpError(404, 'Quick reply not found.');
    res.json({ deleted: req.params.id });
});

export default router;
