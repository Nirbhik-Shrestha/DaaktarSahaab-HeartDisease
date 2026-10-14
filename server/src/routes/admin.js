/** The admin portal's API: doctors, patients, sessions, appointments, logs. */
import { Router } from 'express';
import {
    Doctor, Patient, Specialty, Schedule, Appointment,
} from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { httpError, isId, str } from '../lib/http.js';
import { today } from '../lib/dates.js';
import { validateSessionInput, createSession, scheduleCapacity } from '../lib/schedules.js';
import { deleteDoctor, deletePatient, deleteSchedule } from '../lib/cascade.js';
import { hashPassword, verifyPassword } from './auth.js';
import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from '../../../shared/constants.js';

const router = Router();
router.use(requireRole('admin'));

const DOCTOR_POPULATE = { path: 'doctor', select: 'name specialty', populate: { path: 'specialty', select: 'name' } };

function appointmentRow(a) {
    return {
        id: String(a._id),
        patientName: a.patient?.name ?? 'Unknown',
        doctorName: a.doctor?.name ?? 'Unknown',
        specialty: a.doctor?.specialty?.name ?? '',
        date: a.date,
        start: a.start,
        end: a.end,
        status: a.status,
    };
}

async function sessionRows(filter, sort) {
    const schedules = await Schedule.find(filter).populate('doctor', 'name').lean();
    const capacity = await scheduleCapacity(schedules);
    const rows = schedules.map((s) => {
        const cap = capacity.get(String(s._id));
        return {
            id: String(s._id),
            date: s.date,
            doctorName: s.doctor?.name ?? 'Unknown',
            totalSlots: cap.total,
            bookedSlots: cap.booked,
            start: cap.start,
            end: cap.end,
        };
    });
    return rows.sort(sort);
}

const byDateAsc = (a, b) => a.date.localeCompare(b.date) || String(a.start).localeCompare(String(b.start));
const byDateDesc = (a, b) => b.date.localeCompare(a.date);

// ---- Dashboard -----------------------------------------------------------

router.get('/dashboard', async (req, res) => {
    const now = today();
    const [doctors, patients, specialties, appointments, upcoming] = await Promise.all([
        Doctor.countDocuments(),
        Patient.countDocuments(),
        Specialty.countDocuments(),
        Appointment.countDocuments(),
        Appointment.countDocuments({ date: { $gte: now } }),
    ]);
    const nextAppointments = await Appointment.find({ date: { $gte: now } })
        .sort({ date: 1, start: 1 }).limit(6).populate('patient', 'name').populate(DOCTOR_POPULATE).lean();
    const nextSessions = (await sessionRows({ date: { $gte: now } }, byDateAsc)).slice(0, 6);

    res.json({
        today: now,
        email: req.user.email,
        totals: { doctors, patients, specialties, appointments, upcoming },
        nextAppointments: nextAppointments.map(appointmentRow),
        nextSessions,
    });
});

// ---- Doctors -------------------------------------------------------------

router.get('/specialties', async (req, res) => {
    const specialties = await Specialty.find().sort({ name: 1 }).lean();
    res.json({ specialties: specialties.map((s) => ({ id: String(s._id), name: s.name })) });
});

router.get('/doctors', async (req, res) => {
    const doctors = await Doctor.find().populate('specialty', 'name').sort({ name: 1 }).lean();
    res.json({
        doctors: doctors.map((d) => ({
            id: String(d._id),
            name: d.name,
            email: d.email,
            contact: d.contact,
            address: d.address,
            nmc: d.nmc,
            specialtyId: d.specialty ? String(d.specialty._id) : '',
            specialty: d.specialty?.name ?? '',
        })),
    });
});

router.post('/doctors', async (req, res) => {
    const values = {
        name: str(req.body.name),
        email: str(req.body.email).toLowerCase(),
        contact: str(req.body.contact),
        address: str(req.body.address),
        nmc: str(req.body.nmc),
        specialty: str(req.body.specialtyId),
    };
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    const errors = [];
    if (Object.values(values).includes('') || password === '') errors.push('Please fill in every field.');
    if (values.email && !EMAIL_PATTERN.test(values.email)) errors.push('Please enter a valid email address.');
    if (password && password.length < MIN_PASSWORD_LENGTH) errors.push(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (values.specialty && (!isId(values.specialty) || !(await Specialty.exists({ _id: values.specialty })))) {
        errors.push('Please choose a specialty.');
    }
    if (!errors.length && await Doctor.exists({ email: values.email })) {
        errors.push('A doctor with this email address already exists.');
    }
    if (errors.length) throw httpError(422, 'The doctor could not be added.', { errors });

    await Doctor.create({ ...values, password: await hashPassword(password) });
    res.status(201).json({ ok: true });
});

router.put('/doctors/:id', async (req, res) => {
    if (!isId(req.params.id)) throw httpError(404, 'That doctor could not be found.');
    const values = {
        name: str(req.body.name),
        email: str(req.body.email).toLowerCase(),
        contact: str(req.body.contact),
        nmc: str(req.body.nmc),
        specialty: str(req.body.specialtyId),
    };
    if (!values.name || !values.contact || !values.nmc || !EMAIL_PATTERN.test(values.email)
        || !isId(values.specialty) || !(await Specialty.exists({ _id: values.specialty }))) {
        throw httpError(422, 'Please fill in every field with a valid email address.');
    }
    // Email addresses are unique across doctors.
    if (await Doctor.exists({ email: values.email, _id: { $ne: req.params.id } })) {
        throw httpError(409, 'Another doctor already uses that email address, so nothing was changed.');
    }
    const { matchedCount } = await Doctor.updateOne({ _id: req.params.id }, { $set: values });
    if (!matchedCount) throw httpError(404, 'That doctor could not be found.');
    res.json({ ok: true });
});

// Removes the doctor's sessions, appointments and conversations too.
router.delete('/doctors/:id', async (req, res) => {
    if (!isId(req.params.id) || !(await deleteDoctor(req.params.id))) {
        throw httpError(404, 'That doctor could not be found.');
    }
    res.json({ ok: true });
});

// ---- Patients ------------------------------------------------------------

router.get('/patients', async (req, res) => {
    const patients = await Patient.find().sort({ name: 1 }).lean();
    const counts = await Appointment.aggregate([{ $group: { _id: '$patient', n: { $sum: 1 } } }]);
    const countBy = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json({
        patients: patients.map((p) => ({
            id: String(p._id),
            name: p.name,
            email: p.email,
            contact: p.contact,
            address: p.address,
            dob: p.dob,
            appointments: countBy.get(String(p._id)) || 0,
        })),
    });
});

// Removes the patient's appointments, heart checks and conversations too.
router.delete('/patients/:id', async (req, res) => {
    if (!isId(req.params.id) || !(await deletePatient(req.params.id))) {
        throw httpError(404, 'That patient could not be found.');
    }
    res.json({ ok: true });
});

// ---- Sessions ------------------------------------------------------------

router.get('/sessions', async (req, res) => {
    res.json({ today: today(), sessions: await sessionRows({ date: { $gte: today() } }, byDateAsc) });
});

router.get('/doctor-options', async (req, res) => {
    const doctors = await Doctor.find({}, 'name specialty').populate('specialty', 'name').sort({ name: 1 }).lean();
    res.json({ doctors: doctors.map((d) => ({ id: String(d._id), name: d.name, specialty: d.specialty?.name ?? '' })) });
});

router.post('/sessions', async (req, res) => {
    const input = { doctorId: req.body.doctorId, date: req.body.date, startTime: req.body.startTime, slots: req.body.slots };
    const errors = await validateSessionInput(input);
    if (errors.length) throw httpError(422, 'This session could not be created.', { errors });
    try {
        await createSession(input);
    } catch (err) {
        if (err.code === 11000) {
            throw httpError(422, 'This session could not be created.', { errors: [`That doctor already has a session on ${input.date}.`] });
        }
        throw err;
    }
    res.status(201).json({ ok: true });
});

// Allowed even with bookings (doctors are told to ask the admin); the
// session's appointments are cancelled with it.
router.delete('/sessions/:id', async (req, res) => {
    if (!isId(req.params.id)) throw httpError(404, 'That session could not be found.');
    const result = await deleteSchedule(req.params.id);
    if (!result.deleted) throw httpError(404, 'That session could not be found.');
    res.json(result);
});

// ---- Appointments and logs -----------------------------------------------

router.get('/appointments', async (req, res) => {
    const appointments = await Appointment.find({ date: { $gte: today() } })
        .sort({ date: 1, start: 1 }).populate('patient', 'name').populate(DOCTOR_POPULATE).lean();
    res.json({ today: today(), appointments: appointments.map(appointmentRow) });
});

router.get('/logs', async (req, res) => {
    const now = today();
    const appointments = await Appointment.find({ date: { $lt: now } })
        .sort({ date: -1, start: -1 }).populate('patient', 'name').populate(DOCTOR_POPULATE).lean();
    res.json({
        today: now,
        appointments: appointments.map(appointmentRow),
        sessions: await sessionRows({ date: { $lt: now } }, byDateDesc),
    });
});

// ---- Own password --------------------------------------------------------

router.put('/password', async (req, res) => {
    const current = typeof req.body.current === 'string' ? req.body.current : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const confirm = typeof req.body.confirm === 'string' ? req.body.confirm : '';

    if (!current || !password || !confirm) throw httpError(422, 'Please fill in all three password fields.');
    if (password !== confirm) throw httpError(422, 'The two new passwords did not match.');
    if (password.length < MIN_PASSWORD_LENGTH) throw httpError(422, `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (!(await verifyPassword(current, req.user.password))) {
        throw httpError(422, 'Your current password was not correct, so nothing was changed.');
    }
    req.user.password = await hashPassword(password);
    await req.user.save();
    res.json({ ok: true });
});

export default router;
