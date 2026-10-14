/**
 * The doctor portal's API. Every query is matched on the signed-in doctor's
 * id, never their name (two doctors may share a name).
 */
import { Router } from 'express';
import { Appointment, Schedule, Reading, Conversation, Message } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { httpError, isId } from '../lib/http.js';
import { today, ageOn } from '../lib/dates.js';
import { validateSessionInput, createSession, scheduleCapacity } from '../lib/schedules.js';
import { readingDetail } from '../lib/readings.js';
import { hashPassword, verifyPassword } from './auth.js';
import { MAX_NOTES_LENGTH, MIN_PASSWORD_LENGTH } from '../../../shared/constants.js';

const router = Router();
router.use(requireRole('doctor'));

const STATUSES = ['booked', 'completed', 'no_show'];

/** Which appointments have a shared reading, and the chat with each patient. */
async function appointmentLinks(doctorId, appointments) {
    const shared = await Reading.find({ appointment: { $in: appointments.map((a) => a._id) } }, 'appointment').lean();
    const conversations = await Conversation.find({ doctor: doctorId }, 'patient').lean();
    return {
        sharedBy: new Map(shared.map((r) => [String(r.appointment), String(r._id)])),
        chatBy: new Map(conversations.map((c) => [String(c.patient), String(c._id)])),
    };
}

function appointmentRow(a, links) {
    return {
        id: String(a._id),
        patientName: a.patient?.name ?? 'Unknown',
        patientDob: a.patient?.dob ?? null,
        date: a.date,
        start: a.start,
        end: a.end,
        status: a.status,
        doctorNotes: a.doctorNotes,
        notesUpdatedAt: a.notesUpdatedAt,
        sharedReadingId: links.sharedBy.get(String(a._id)) || null,
        conversationId: links.chatBy.get(String(a.patient?._id)) || null,
    };
}

// ---- Dashboard -----------------------------------------------------------

router.get('/dashboard', async (req, res) => {
    const did = req.user._id;
    const now = today();

    const upcoming = await Appointment.find({ doctor: did, date: { $gte: now }, status: 'booked' })
        .sort({ date: 1, start: 1 }).populate('patient', 'name').lean();
    const links = await appointmentLinks(did, upcoming);
    const rows = upcoming.map((a) => appointmentRow(a, links));

    // Past visits not yet marked completed or no-show.
    const needsUpdate = await Appointment.countDocuments({ doctor: did, date: { $lt: now }, status: 'booked' });

    // Upcoming sessions and how many of their slots are still free.
    const schedules = await Schedule.find({ doctor: did, date: { $gte: now } }).lean();
    const capacity = await scheduleCapacity(schedules);
    let freeSlots = 0;
    for (const cap of capacity.values()) freeSlots += cap.total - cap.booked;

    // Patients who have booked, most recent visit first.
    const patients = await Appointment.aggregate([
        { $match: { doctor: did } },
        { $group: { _id: '$patient', lastVisit: { $max: '$date' } } },
        { $sort: { lastVisit: -1 } },
        { $lookup: { from: 'patients', localField: '_id', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        { $project: { name: '$p.name', lastVisit: 1 } },
    ]);

    res.json({
        today: now,
        todayVisits: rows.filter((r) => r.date === now),
        nextVisits: rows.slice(0, 5),
        upcomingCount: rows.length,
        needsUpdate,
        sessionCount: schedules.length,
        freeSlots,
        patients: patients.map((p) => ({ id: String(p._id), name: p.name, lastVisit: p.lastVisit })),
    });
});

// ---- Appointments --------------------------------------------------------

router.get('/appointments', async (req, res) => {
    const now = today();
    const all = await Appointment.find({ doctor: req.user._id })
        .sort({ date: 1, start: 1 }).populate('patient', 'name dob').lean();
    const links = await appointmentLinks(req.user._id, all);
    const rows = all.map((a) => appointmentRow(a, links));
    res.json({
        upcoming: rows.filter((r) => r.date >= now),
        past: rows.filter((r) => r.date < now).reverse(),
    });
});

async function ownAppointment(req) {
    if (!isId(req.params.id)) throw httpError(404, 'No appointment was found in your schedule with that reference.');
    const appointment = await Appointment.findOne({ _id: req.params.id, doctor: req.user._id }).populate('patient', 'name dob');
    if (!appointment) throw httpError(404, 'No appointment was found in your schedule with that reference.');
    return appointment;
}

router.get('/appointments/:id', async (req, res) => {
    const appointment = await ownAppointment(req);
    const links = await appointmentLinks(req.user._id, [appointment]);
    res.json({
        appointment: {
            ...appointmentRow(appointment.toObject(), links),
            // A visit cannot be recorded before it happens.
            canRecord: appointment.date <= today(),
        },
    });
});

// Record the visit: its status and notes the patient can read.
router.put('/appointments/:id', async (req, res) => {
    const appointment = await ownAppointment(req);
    const status = typeof req.body.status === 'string' ? req.body.status : '';
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

    const errors = [];
    if (appointment.date > today()) errors.push(`This visit can be recorded from ${appointment.date}.`);
    if (!STATUSES.includes(status)) errors.push('Please choose a status.');
    if (notes.length > MAX_NOTES_LENGTH) errors.push(`Notes can be at most ${MAX_NOTES_LENGTH} characters.`);
    if (errors.length) throw httpError(422, 'Not saved.', { errors });

    const notesOrNull = notes === '' ? null : notes;
    // notesUpdatedAt only moves when the notes themselves change.
    if (notesOrNull !== appointment.doctorNotes) {
        appointment.notesUpdatedAt = new Date();
    }
    appointment.status = status;
    appointment.doctorNotes = notesOrNull;
    await appointment.save();
    res.json({ ok: true });
});

/**
 * The heart check a patient shared with one of this doctor's appointments.
 * Access is deliberately narrow: only a reading attached to an appointment
 * in THIS doctor's schedule.
 */
router.get('/appointments/:id/assessment', async (req, res) => {
    const appointment = await ownAppointment(req);
    const reading = await Reading.findOne({ appointment: appointment._id, patient: appointment.patient._id }).lean();
    if (!reading) throw httpError(404, 'No shared heart check was found for this appointment.');
    res.json({
        reading: await readingDetail(reading),
        patient: { name: appointment.patient.name, dob: appointment.patient.dob },
        appointment: { id: String(appointment._id), date: appointment.date, start: appointment.start, end: appointment.end },
    });
});

/**
 * A heart check the patient posted in their chat with this doctor. Only
 * readable through that message, and only while the reading exists; having a
 * chat does not open up the patient's other readings.
 */
router.get('/chat-assessments/:messageId', async (req, res) => {
    const notFound = () => httpError(404, 'This heart check is not available. The patient may have deleted it, or it was not shared with you.');
    if (!isId(req.params.messageId)) throw notFound();
    const message = await Message.findOne({ _id: req.params.messageId, kind: 'assessment', senderRole: 'patient' }).lean();
    if (!message || !message.reading) throw notFound();
    const conversation = await Conversation.findOne({ _id: message.conversation, doctor: req.user._id })
        .populate('patient', 'name dob').lean();
    if (!conversation) throw notFound();
    const reading = await Reading.findOne({ _id: message.reading, patient: conversation.patient._id }).lean();
    if (!reading) throw notFound();
    res.json({
        reading: await readingDetail(reading),
        patient: { name: conversation.patient.name, dob: conversation.patient.dob },
        sharedAt: message.createdAt,
        conversationId: String(conversation._id),
    });
});

// ---- Patients ------------------------------------------------------------

router.get('/patients', async (req, res) => {
    const rows = await Appointment.aggregate([
        { $match: { doctor: req.user._id } },
        { $group: { _id: '$patient', visits: { $sum: 1 }, latest: { $max: '$date' } } },
        { $lookup: { from: 'patients', localField: '_id', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        { $sort: { 'p.name': 1 } },
    ]);
    const now = today();
    res.json({
        today: now,
        patients: rows.map((r) => ({
            id: String(r._id),
            name: r.p.name,
            email: r.p.email,
            contact: r.p.contact,
            address: r.p.address,
            dob: r.p.dob,
            age: ageOn(r.p.dob, now),
            visits: r.visits,
            latest: r.latest,
        })),
    });
});

// ---- Sessions ------------------------------------------------------------

router.get('/sessions', async (req, res) => {
    const now = today();
    const schedules = await Schedule.find({ doctor: req.user._id }).sort({ date: 1 }).lean();
    const capacity = await scheduleCapacity(schedules);
    const rows = schedules.map((s) => {
        const cap = capacity.get(String(s._id));
        return { id: String(s._id), date: s.date, totalSlots: cap.total, bookedSlots: cap.booked, start: cap.start, end: cap.end };
    });
    res.json({
        today: now,
        upcoming: rows.filter((r) => r.date >= now),
        past: rows.filter((r) => r.date < now).reverse(),
    });
});

// The doctor id comes from the sign-in, never the form, so a doctor can only
// add availability to their own calendar.
router.post('/sessions', async (req, res) => {
    const input = { doctorId: String(req.user._id), date: req.body.date, startTime: req.body.startTime, slots: req.body.slots };
    const errors = await validateSessionInput(input);
    if (errors.length) throw httpError(422, 'This session could not be added.', { errors });
    try {
        await createSession(input);
    } catch (err) {
        if (err.code === 11000) {
            throw httpError(422, 'This session could not be added.', { errors: [`You already have a session on ${input.date}.`] });
        }
        throw err;
    }
    res.status(201).json({ ok: true });
});

// A session patients have booked into cannot be removed here: deleting it
// would drop their appointments without telling them.
router.delete('/sessions/:id', async (req, res) => {
    if (!isId(req.params.id)) throw httpError(404, 'That session could not be found.');
    const schedule = await Schedule.findOne({ _id: req.params.id, doctor: req.user._id });
    if (!schedule) throw httpError(404, 'That session could not be found.');
    if (await Appointment.exists({ schedule: schedule._id })) {
        throw httpError(409, 'That session already has bookings, so it cannot be removed. Contact the admin if it must be cancelled.');
    }
    await Schedule.deleteOne({ _id: schedule._id, doctor: req.user._id });
    res.json({ ok: true });
});

// ---- Profile -------------------------------------------------------------

router.get('/profile', async (req, res) => {
    await req.user.populate('specialty', 'name');
    const d = req.user;
    res.json({
        profile: {
            name: d.name, email: d.email, contact: d.contact, address: d.address, nmc: d.nmc,
            specialty: d.specialty?.name ?? '',
        },
    });
});

// Doctors change their own password; other details are managed by the admin.
router.put('/password', async (req, res) => {
    const current = typeof req.body.current === 'string' ? req.body.current : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const confirm = typeof req.body.confirm === 'string' ? req.body.confirm : '';

    const errors = [];
    if (!(await verifyPassword(current, req.user.password))) errors.push('Your current password is not correct.');
    if (password.length < MIN_PASSWORD_LENGTH) errors.push(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    else if (password !== confirm) errors.push('The new passwords do not match.');
    if (errors.length) throw httpError(422, 'Your password was not changed.', { errors });

    req.user.password = await hashPassword(password);
    await req.user.save();
    res.json({ ok: true });
});

export default router;
