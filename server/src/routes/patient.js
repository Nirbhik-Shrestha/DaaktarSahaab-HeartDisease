/**
 * The patient portal's API. Every route runs as the signed-in patient, and
 * every query includes `patient: req.user._id`, so an id taken from the URL
 * can never reach someone else's records.
 */
import { Router } from 'express';
import {
    Doctor, Specialty, Schedule, Appointment, Reading, Patient, Conversation, nextSequence,
} from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { httpError, isId, str } from '../lib/http.js';
import { today, isValidDate } from '../lib/dates.js';
import { scheduleCapacity } from '../lib/schedules.js';
import { deleteReading } from '../lib/cascade.js';
import {
    ensureRiskScores, readingSummary, readingDetail, safeScore,
} from '../lib/readings.js';
import { buildAssessmentPdf } from '../lib/pdf.js';
import { validateAssessment } from '../../../shared/assessment.js';
import { NAME_PATTERN, PHONE_PATTERN, EMAIL_PATTERN, PHONE_MESSAGE } from '../../../shared/constants.js';

const router = Router();
router.use(requireRole('patient'));

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- Dashboard -----------------------------------------------------------

router.get('/dashboard', async (req, res) => {
    const pid = req.user._id;
    const now = today();

    const next = await Appointment.findOne({ patient: pid, date: { $gte: now }, status: 'booked' })
        .sort({ date: 1, start: 1 })
        .populate({ path: 'doctor', select: 'name specialty', populate: { path: 'specialty', select: 'name' } })
        .lean();

    // The two most recent heart checks, for the latest score and its change.
    const checks = await ensureRiskScores(await Reading.find({ patient: pid }).sort({ takenAt: -1, _id: -1 }).limit(2).lean());

    const note = await Appointment.findOne({ patient: pid, doctorNotes: { $nin: [null, ''] } })
        .sort({ notesUpdatedAt: -1 })
        .populate('doctor', 'name')
        .lean();

    res.json({
        nextVisit: next ? {
            doctorName: next.doctor?.name ?? 'Unknown',
            specialty: next.doctor?.specialty?.name ?? '',
            date: next.date,
            start: next.start,
            end: next.end,
        } : null,
        checks: checks.map((c) => ({ id: String(c._id), takenAt: c.takenAt, riskScore: c.riskScore })),
        latestNote: note ? { notes: note.doctorNotes, date: note.date, doctorName: note.doctor?.name ?? '' } : null,
    });
});

// ---- Doctors and sessions ------------------------------------------------

async function listDoctors(filter) {
    const doctors = await Doctor.find(filter).populate('specialty', 'name').sort({ name: 1 }).lean();
    const upcoming = await Schedule.aggregate([
        { $match: { doctor: { $in: doctors.map((d) => d._id) }, date: { $gte: today() } } },
        { $group: { _id: '$doctor', n: { $sum: 1 } } },
    ]);
    const counts = new Map(upcoming.map((u) => [String(u._id), u.n]));
    return doctors.map((d) => ({
        id: String(d._id),
        name: d.name,
        specialty: d.specialty?.name ?? '',
        address: d.address,
        contact: d.contact,
        email: d.email,
        upcomingSessions: counts.get(String(d._id)) || 0,
    }));
}

// ?search= matches a doctor's name or specialty (links like ?search=Cardiologist).
router.get('/doctors', async (req, res) => {
    const search = str(req.query.search);
    let filter = {};
    if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        const specialties = await Specialty.find({ name: pattern }).distinct('_id');
        filter = { $or: [{ name: pattern }, { specialty: { $in: specialties } }] };
    }
    res.json({ doctors: await listDoctors(filter) });
});

router.get('/cardiologists', async (req, res) => {
    const specialties = await Specialty.find({ name: /Cardiologist/i }).distinct('_id');
    res.json({ doctors: await listDoctors({ specialty: { $in: specialties } }) });
});

// Upcoming sessions, optionally for one doctor and/or matching a search over
// doctor name, specialty or date.
router.get('/sessions', async (req, res) => {
    const doctorId = isId(req.query.doctor) ? req.query.doctor : null;
    const search = str(req.query.search);

    const filter = { date: { $gte: today() } };
    if (doctorId) filter.doctor = doctorId;
    if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        const specialties = await Specialty.find({ name: pattern }).distinct('_id');
        const doctors = await Doctor.find({ $or: [{ name: pattern }, { specialty: { $in: specialties } }] }).distinct('_id');
        filter.$or = [{ doctor: { $in: doctors } }, { date: pattern }];
    }

    const schedules = await Schedule.find(filter)
        .populate({ path: 'doctor', select: 'name specialty', populate: { path: 'specialty', select: 'name' } })
        .lean();
    const capacity = await scheduleCapacity(schedules);
    const sessions = schedules
        .map((s) => {
            const cap = capacity.get(String(s._id));
            return {
                id: String(s._id),
                date: s.date,
                doctorName: s.doctor?.name ?? 'Unknown',
                specialty: s.doctor?.specialty?.name ?? '',
                totalSlots: cap.total,
                bookedSlots: cap.booked,
            };
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.doctorName.localeCompare(b.doctorName));

    const doctor = doctorId ? await Doctor.findById(doctorId, 'name').lean() : null;
    res.json({ doctorName: doctor ? doctor.name : null, sessions });
});

// One session with every slot, flagging the booked ones.
router.get('/sessions/:id', async (req, res) => {
    if (!isId(req.params.id)) throw httpError(404, 'No session found with the provided ID.');
    const schedule = await Schedule.findById(req.params.id)
        .populate({ path: 'doctor', select: 'name email specialty', populate: { path: 'specialty', select: 'name' } })
        .lean();
    if (!schedule) throw httpError(404, 'No session found with the provided ID.');

    const taken = new Set((await Appointment.find({ schedule: schedule._id }).distinct('slot')).map(String));
    res.json({
        session: {
            id: String(schedule._id),
            date: schedule.date,
            isPast: schedule.date < today(),
            doctorName: schedule.doctor?.name ?? 'Unknown',
            doctorEmail: schedule.doctor?.email ?? '',
            specialty: schedule.doctor?.specialty?.name ?? '',
            slots: [...schedule.slots]
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((slot) => ({ id: String(slot._id), start: slot.start, end: slot.end, booked: taken.has(String(slot._id)) })),
        },
    });
});

// ---- Booking -------------------------------------------------------------

/**
 * Book a slot. The unique indexes on Appointment make this safe when two
 * requests race: two patients cannot both take one slot, and one patient
 * cannot take two slots of the same session by submitting twice.
 */
router.post('/appointments', async (req, res) => {
    const slotId = req.body.slotId;
    if (!isId(slotId)) throw httpError(422, 'Please choose a time slot.');

    const schedule = await Schedule.findOne({ 'slots._id': slotId }).lean();
    if (!schedule) throw httpError(404, 'That time slot no longer exists. Please choose another one.');
    if (schedule.date < today()) {
        throw httpError(409, 'That session has already taken place. Please choose an upcoming session.');
    }
    if (await Appointment.exists({ patient: req.user._id, schedule: schedule._id })) {
        throw httpError(409, 'You already have an appointment booked for this schedule. Please choose a different schedule.');
    }

    const slot = schedule.slots.find((s) => String(s._id) === String(slotId));
    let appointment;
    try {
        appointment = await Appointment.create({
            patient: req.user._id,
            doctor: schedule.doctor,
            schedule: schedule._id,
            slot: slot._id,
            // The date comes from the session itself, never from the form.
            date: schedule.date,
            start: slot.start,
            end: slot.end,
        });
    } catch (err) {
        if (err.code === 11000) {
            const onePerSession = err.keyPattern && err.keyPattern.schedule;
            throw httpError(409, onePerSession
                ? 'You already have an appointment booked for this schedule. Please choose a different schedule.'
                : 'This time slot is already booked. Please choose a different time slot.');
        }
        throw err;
    }

    // Booking a doctor is what lets the patient message them. The same pair
    // keeps one conversation however many times they book, and it outlives
    // any later cancellation. A chat problem never undoes the booking.
    try {
        await Conversation.updateOne(
            { patient: req.user._id, doctor: schedule.doctor },
            { $setOnInsert: { patient: req.user._id, doctor: schedule.doctor } },
            { upsert: true },
        );
    } catch (err) {
        if (err.code !== 11000) console.error('Could not open conversation:', err.message);
    }

    const doctor = await Doctor.findById(schedule.doctor, 'name specialty').populate('specialty', 'name').lean();
    res.status(201).json({
        appointment: {
            id: String(appointment._id),
            doctorName: doctor?.name ?? '',
            specialty: doctor?.specialty?.name ?? '',
            date: appointment.date,
            start: appointment.start,
            end: appointment.end,
        },
    });
});

// ---- Appointments --------------------------------------------------------

router.get('/appointments', async (req, res) => {
    const pid = req.user._id;
    const now = today();
    const appointments = await Appointment.find({ patient: pid })
        .sort({ date: 1, start: 1 })
        .populate({ path: 'doctor', select: 'name specialty', populate: { path: 'specialty', select: 'name' } })
        .lean();

    const shared = await Reading.find({ appointment: { $in: appointments.map((a) => a._id) } }, 'appointment').lean();
    const sharedBy = new Map(shared.map((r) => [String(r.appointment), String(r._id)]));
    const conversations = await Conversation.find({ patient: pid }, 'doctor').lean();
    const chatBy = new Map(conversations.map((c) => [String(c.doctor), String(c._id)]));

    const upcoming = [];
    const past = [];
    for (const a of appointments) {
        const row = {
            id: String(a._id),
            date: a.date,
            start: a.start,
            end: a.end,
            status: a.status,
            doctorNotes: a.doctorNotes,
            notesUpdatedAt: a.notesUpdatedAt,
            doctorName: a.doctor?.name ?? 'Unknown',
            specialty: a.doctor?.specialty?.name ?? '',
            sharedReadingId: sharedBy.get(String(a._id)) || null,
            conversationId: chatBy.get(String(a.doctor?._id)) || null,
        };
        // A visit the doctor has already recorded counts as past even on the
        // day itself, so its notes show up straight away.
        (a.date >= now && a.status === 'booked' ? upcoming : past).push(row);
    }

    // Readings the patient could still attach to an upcoming visit.
    const unshared = await Reading.find({ patient: pid, appointment: null }, 'takenAt').sort({ _id: -1 }).lean();

    res.json({
        upcoming,
        past: past.reverse(), // most recent visit first
        unsharedReadings: unshared.map((r) => ({ id: String(r._id), takenAt: r.takenAt })),
    });
});

async function ownAppointment(req) {
    if (!isId(req.params.id)) throw httpError(404, 'That appointment could not be found.', { code: 'notfound' });
    const appointment = await Appointment.findOne({ _id: req.params.id, patient: req.user._id });
    if (!appointment) throw httpError(404, 'That appointment could not be found.', { code: 'notfound' });
    return appointment;
}

// Cancelling frees the slot at once; a shared reading is kept, only unlinked.
router.delete('/appointments/:id', async (req, res) => {
    const appointment = await ownAppointment(req);
    if (appointment.date < today()) {
        throw httpError(409, 'That appointment has already taken place, so it cannot be cancelled.', { code: 'past' });
    }
    if (appointment.status !== 'booked') {
        // Deleting it would also delete the doctor's record and notes.
        throw httpError(409, 'Your doctor has already recorded that visit, so it cannot be cancelled.', { code: 'recorded' });
    }
    await Reading.updateMany({ appointment: appointment._id }, { $set: { appointment: null } });
    await Appointment.deleteOne({ _id: appointment._id, status: 'booked' });
    res.json({ ok: true });
});

// Share one of the patient's readings with an upcoming appointment, so the
// doctor can review it beforehand. One reading per appointment.
router.post('/appointments/:id/share', async (req, res) => {
    const appointment = await ownAppointment(req);
    if (appointment.date < today()) throw httpError(404, 'That appointment could not be found.', { code: 'notfound' });

    const readingId = req.body.readingId;
    if (!isId(readingId) || !(await Reading.exists({ _id: readingId, patient: req.user._id }))) {
        throw httpError(404, 'That heart check could not be found.', { code: 'notfound' });
    }
    await Reading.updateMany({ appointment: appointment._id, patient: req.user._id }, { $set: { appointment: null } });
    await Reading.updateOne({ _id: readingId, patient: req.user._id }, { $set: { appointment: appointment._id } });
    res.json({ ok: true });
});

router.delete('/appointments/:id/share', async (req, res) => {
    const appointment = await ownAppointment(req);
    if (appointment.date < today()) throw httpError(404, 'That appointment could not be found.', { code: 'notfound' });
    await Reading.updateMany({ appointment: appointment._id, patient: req.user._id }, { $set: { appointment: null } });
    res.json({ ok: true });
});

// ---- Heart checks --------------------------------------------------------

router.get('/readings', async (req, res) => {
    const readings = await ensureRiskScores(
        await Reading.find({ patient: req.user._id }).sort({ takenAt: -1, _id: -1 }).lean(),
    );
    res.json({ readings: readings.map(readingSummary) });
});

router.post('/readings', async (req, res) => {
    const { values, errors } = validateAssessment(req.body);
    if (errors.length) throw httpError(422, 'Please check your answers.', { errors });

    // Scored now, so the trend chart has it straight away.
    const score = safeScore(values);
    const reading = await Reading.create({
        ...values,
        patient: req.user._id,
        number: await nextSequence('reading'),
        riskScore: score ? score.riskScore : null,
    });
    res.status(201).json({ id: String(reading._id) });
});

async function ownReading(req) {
    if (!isId(req.params.id)) throw httpError(404, 'No record found.');
    const reading = await Reading.findOne({ _id: req.params.id, patient: req.user._id }).lean();
    if (!reading) throw httpError(404, 'No record found.');
    return reading;
}

router.get('/readings/:id', async (req, res) => {
    res.json({ reading: await readingDetail(await ownReading(req)) });
});

router.put('/readings/:id', async (req, res) => {
    const reading = await ownReading(req);
    const { values, errors } = validateAssessment(req.body);
    if (errors.length) throw httpError(422, 'Please check your answers.', { errors });

    const score = safeScore(values);
    await Reading.updateOne(
        { _id: reading._id, patient: req.user._id },
        { $set: { ...values, riskScore: score ? score.riskScore : null } },
    );
    res.json({ ok: true });
});

router.delete('/readings/:id', async (req, res) => {
    const reading = await ownReading(req);
    await deleteReading(reading._id);
    res.json({ ok: true });
});

// A PDF to print or take to any doctor, including one not on this platform.
router.get('/readings/:id/pdf', async (req, res) => {
    const reading = await ownReading(req);
    const detail = await readingDetail(reading);
    if (!detail.assessment) {
        throw httpError(503, 'The prediction model could not be run, so the PDF cannot be created right now. Please try again later.');
    }
    const { filename, stream } = buildAssessmentPdf({ patient: req.user, reading, assessment: detail.assessment });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
});

// ---- Profile -------------------------------------------------------------

function profileOf(patient) {
    return {
        number: patient.number,
        name: patient.name,
        email: patient.email,
        contact: patient.contact,
        address: patient.address,
        dob: patient.dob,
    };
}

router.get('/profile', async (req, res) => {
    const checkCount = await Reading.countDocuments({ patient: req.user._id });
    res.json({ profile: profileOf(req.user), checkCount });
});

// Same rules as sign-up.
router.put('/profile', async (req, res) => {
    const values = {
        name: str(req.body.name),
        email: str(req.body.email).toLowerCase(),
        contact: str(req.body.contact),
        address: str(req.body.address),
        dob: str(req.body.dob),
    };
    const others = { _id: { $ne: req.user._id } };
    const errors = [];
    if (!values.name || !NAME_PATTERN.test(values.name)) errors.push('Please enter a valid name.');
    if (!EMAIL_PATTERN.test(values.email)) errors.push('Please enter a valid email address.');
    else if (await Patient.exists({ ...others, email: values.email })) errors.push('That email address is already used by another account.');
    if (!PHONE_PATTERN.test(values.contact)) errors.push(PHONE_MESSAGE);
    else if (await Patient.exists({ ...others, contact: values.contact })) errors.push('That phone number is already used by another account.');
    if (!values.address) errors.push('Please enter your address.');
    if (!isValidDate(values.dob) || values.dob > today()) errors.push('Please enter a valid date of birth.');
    if (errors.length) throw httpError(422, 'Your details were not saved.', { errors });

    Object.assign(req.user, values);
    await req.user.save();
    res.json({ profile: profileOf(req.user) });
});

export default router;
