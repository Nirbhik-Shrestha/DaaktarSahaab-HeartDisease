/**
 * Dates and times as the PHP pages showed them, always on the clinic's
 * clock (Asia/Kathmandu), whatever the viewer's own time zone.
 *
 * Day-only values ("2026-09-26") are calendar dates, not moments, so they are
 * formatted in UTC to avoid any shift; timestamps (heart checks, messages)
 * are formatted in Asia/Kathmandu.
 */
import { APP_TIMEZONE } from '@shared/constants.js';

const partsFormat = (timeZone) => new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
});
const zoned = partsFormat(APP_TIMEZONE);
const utc = partsFormat('UTC');

function parts(date, format) {
    const out = {};
    for (const p of format.formatToParts(date)) out[p.type] = p.value;
    return {
        weekdayLong: out.weekday,
        weekday: out.weekday.slice(0, 3),
        day: out.day,
        monthLong: out.month,
        month: out.month.slice(0, 3),
        year: out.year,
        time: `${out.hour}:${out.minute} ${out.dayPeriod}`,
    };
}

/** Parts of a "YYYY-MM-DD" calendar date. */
function dayParts(day) {
    const [y, m, d] = String(day).split('-').map(Number);
    return parts(new Date(Date.UTC(y, m - 1, d)), utc);
}

/** Parts of a timestamp on the clinic's clock. */
const stampParts = (value) => parts(new Date(value), zoned);

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "YYYY-MM-DD" today, or of a timestamp, on the clinic's clock. */
export const dayOf = (value = new Date()) => DAY_FORMAT.format(new Date(value));
export const today = () => dayOf(new Date());

export function addDays(day, n) {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// ---- Calendar dates ("YYYY-MM-DD") ----

/** "Sat 26 Sep 2026" */
export function dayLong(day) {
    const p = dayParts(day);
    return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** "Sat 26 Sep" */
export function dayShort(day) {
    const p = dayParts(day);
    return `${p.weekday} ${p.day} ${p.month}`;
}

/** "Saturday 26 September 2026" */
export function dayFull(day) {
    const p = dayParts(day);
    return `${p.weekdayLong} ${p.day} ${p.monthLong} ${p.year}`;
}

/** "26 Sep 2026" */
export function dayMedium(day) {
    const p = dayParts(day);
    return `${p.day} ${p.month} ${p.year}`;
}

/** "26 Sep" */
export function dayMonth(day) {
    const p = dayParts(day);
    return `${p.day} ${p.month}`;
}

/** "Today", "Tomorrow", "Yesterday" or "Mon 3 Oct 2026". */
export function friendlyDay(day, now = today()) {
    if (day === now) return 'Today';
    if (day === addDays(now, 1)) return 'Tomorrow';
    if (day === addDays(now, -1)) return 'Yesterday';
    return dayLong(day);
}

/** "Today", "Tomorrow" or "In 5 days" for an upcoming date. */
export function daysAway(day, now = today()) {
    const utcMs = (s) => {
        const [y, m, d] = s.split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    };
    const days = Math.round((utcMs(day) - utcMs(now)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
}

// ---- Clock times ("HH:MM") ----

/** "9:00 AM" */
export function clock(time) {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "9:00 AM - 10:00 AM" */
export const timeRange = (start, end) => `${clock(start)} - ${clock(end)}`;

// ---- Timestamps ----

/** "26 Sep 2026" */
export function stampDate(value) {
    const p = stampParts(value);
    return `${p.day} ${p.month} ${p.year}`;
}

/** "26 September 2026" */
export function stampDateLong(value) {
    const p = stampParts(value);
    return `${p.day} ${p.monthLong} ${p.year}`;
}

/** "3:04 PM" */
export const stampTime = (value) => stampParts(value).time;

/** "26 Sep 2026, 3:04 PM" */
export const stampDateTime = (value) => `${stampDate(value)}, ${stampTime(value)}`;

/** "26 September 2026, 3:04 PM" */
export const stampDateTimeLong = (value) => `${stampDateLong(value)}, ${stampTime(value)}`;

// ---- Chat labels ----

/** "Today", "Yesterday", "21 Sep" this year, "21 Sep 2025" before that. */
export function chatDayLabel(value) {
    const day = dayOf(value);
    const now = today();
    if (day === now) return 'Today';
    if (day === addDays(now, -1)) return 'Yesterday';
    const p = stampParts(value);
    return day.slice(0, 4) === now.slice(0, 4) ? `${p.day} ${p.month}` : `${p.day} ${p.month} ${p.year}`;
}

/** "3:04 PM" today, otherwise the day label; withTime adds the clock to older days. */
export function chatTimeLabel(value, withTime) {
    if (!value) return '';
    const clockTime = stampTime(value);
    if (dayOf(value) === today()) return clockTime;
    const label = chatDayLabel(value);
    return withTime ? `${label}, ${clockTime}` : label;
}

/** An appointment as "Sat 26 Sep, 10:00 AM" (with the year if not this year). */
export function visitLabel(day, time) {
    const label = day.slice(0, 4) === today().slice(0, 4) ? dayShort(day) : dayLong(day);
    return `${label}, ${clock(time)}`;
}

/** "1 doctor" / "3 doctors"; pass `many` for irregular plurals. */
export function plural(n, one, many) {
    return `${n} ${n === 1 ? one : (many ?? `${one}s`)}`;
}
