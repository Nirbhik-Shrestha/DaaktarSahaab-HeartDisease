/** Dates on the clinic's clock (Asia/Kathmandu), whatever the server's own zone. */
import { APP_TIMEZONE } from '../../../shared/constants.js';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** "YYYY-MM-DD" for a moment (default: now) in the clinic's time zone. */
export function dayOf(date = new Date()) {
    return dayFormat.format(date);
}

export function today() {
    return dayOf(new Date());
}

/** Is "YYYY-MM-DD" a real calendar date? */
export function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Is "HH:MM" (optionally ":SS") a valid clock time? Returns minutes or null. */
export function parseTime(value) {
    const match = /^(\d{1,2}):(\d{2})(:\d{2})?$/.exec(String(value || ''));
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    return h < 24 && m < 60 ? h * 60 + m : null;
}

export function formatMinutes(total) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Whole years between a date of birth and a day, both "YYYY-MM-DD". */
export function ageOn(dob, day = today()) {
    if (!isValidDate(dob)) return null;
    const [by, bm, bd] = dob.split('-').map(Number);
    const [ty, tm, td] = day.split('-').map(Number);
    let age = ty - by;
    if (tm < bm || (tm === bm && td < bd)) age--;
    return age;
}
