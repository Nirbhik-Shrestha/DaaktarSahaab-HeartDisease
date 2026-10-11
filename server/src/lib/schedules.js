/**
 * Shared session (schedule) rules.
 *
 * Admins and doctors both create sessions, so the validation and the
 * slot-building live here rather than being duplicated and drifting apart.
 */
import { Doctor, Schedule, Appointment } from '../models/index.js';
import { MAX_SLOTS_PER_SESSION } from '../../../shared/constants.js';
import { isId } from './http.js';
import { today, isValidDate, parseTime, formatMinutes } from './dates.js';

/** @returns {Promise<string[]>} Human-readable errors; empty when the input is good. */
export async function validateSessionInput({ doctorId, date, startTime, slots }) {
    const errors = [];
    const now = today();

    let doctorOk = false;
    if (!isId(doctorId)) {
        errors.push('Please choose a doctor.');
    } else if (!(await Doctor.exists({ _id: doctorId }))) {
        errors.push('That doctor no longer exists.');
    } else {
        doctorOk = true;
    }

    const dateOk = isValidDate(date);
    if (!dateOk) {
        errors.push('Please enter a valid session date.');
    } else if (date < now) {
        // A session in the past can never be booked, so reject it outright.
        errors.push(`The session date is in the past. Please choose ${now} or later.`);
    }

    const start = parseTime(startTime);
    if (start === null) {
        errors.push('Please enter a valid start time.');
    }

    const count = Number(slots);
    if (String(slots ?? '').trim() === '' || !Number.isInteger(count)) {
        errors.push('Number of patients must be a whole number.');
    } else if (count < 1) {
        errors.push('A session needs at least 1 slot.');
    } else if (count > MAX_SLOTS_PER_SESSION) {
        errors.push(`A session can hold at most ${MAX_SLOTS_PER_SESSION} slots.`);
    }

    // The session must finish within the same day.
    if (start !== null && !errors.length && start + count * 60 > 24 * 60) {
        errors.push('That start time and slot count run past midnight. Start earlier or use fewer slots.');
    }

    // One session per doctor per day.
    if (doctorOk && dateOk && await Schedule.exists({ doctor: doctorId, date })) {
        errors.push(`That doctor already has a session on ${date}. Edit or remove it first.`);
    }

    return errors;
}

/** Create a session and its consecutive 1-hour slots (input already validated). */
export async function createSession({ doctorId, date, startTime, slots }) {
    const start = parseTime(startTime);
    const list = [];
    for (let i = 0; i < Number(slots); i++) {
        list.push({ start: formatMinutes(start + i * 60), end: formatMinutes(start + (i + 1) * 60) });
    }
    return Schedule.create({ doctor: doctorId, date, slots: list });
}

/**
 * For each schedule: total slots, booked slots, first start and last end.
 *
 * @param {object[]} schedules lean Schedule documents
 * @returns {Promise<Map<string, {total, booked, start, end}>>}
 */
export async function scheduleCapacity(schedules) {
    const ids = schedules.map((s) => s._id);
    const booked = await Appointment.aggregate([
        { $match: { schedule: { $in: ids } } },
        { $group: { _id: '$schedule', n: { $sum: 1 } } },
    ]);
    const bookedBy = new Map(booked.map((b) => [String(b._id), b.n]));
    const result = new Map();
    for (const s of schedules) {
        const slots = s.slots || [];
        result.set(String(s._id), {
            total: slots.length,
            booked: bookedBy.get(String(s._id)) || 0,
            start: slots.length ? slots.reduce((m, x) => (x.start < m ? x.start : m), slots[0].start) : null,
            end: slots.length ? slots.reduce((m, x) => (x.end > m ? x.end : m), slots[0].end) : null,
        });
    }
    return result;
}

/** A session row as the pages receive it. */
export function sessionSummary(schedule, capacity, doctor) {
    const cap = capacity.get(String(schedule._id));
    return {
        id: String(schedule._id),
        date: schedule.date,
        doctorName: doctor ? doctor.name : undefined,
        specialty: doctor && doctor.specialty ? doctor.specialty.name : undefined,
        totalSlots: cap.total,
        bookedSlots: cap.booked,
        start: cap.start,
        end: cap.end,
    };
}
