/**
 * MongoDB collections. They mirror the old MySQL tables:
 *
 *   admin -> Admin            specialties -> Specialty     doctors -> Doctor
 *   patients -> Patient       schedule + timeslot -> Schedule (slots embedded)
 *   appointment -> Appointment                patient_data -> Reading
 *   chat_conversations -> Conversation        chat_messages + chat_attachments -> Message
 *   chat_quick_replies -> QuickReply          contact_messages -> ContactMessage
 *
 * MongoDB has no foreign keys, so the old ON DELETE rules live in
 * lib/cascade.js. Unique indexes keep the rules the database used to enforce:
 * one booking per time slot, one session per doctor per day, one
 * conversation per patient-doctor pair.
 *
 * Dates without a time (session and appointment days, dates of birth) are
 * stored as "YYYY-MM-DD" strings and slot times as "HH:MM", in the clinic's
 * time zone (Asia/Kathmandu), exactly as MySQL's DATE and TIME columns held them.
 */
import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const { ObjectId } = Schema.Types;

const DATE = { type: String, match: /^\d{4}-\d{2}-\d{2}$/ };
const TIME = { type: String, match: /^\d{2}:\d{2}$/ };

// Shared by the three account types.
const accountFields = {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // bcrypt hash
    resetTokenHash: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
};

// ---- Counters, for friendly numbers like "Patient no. 12" ----------------
const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = model('Counter', counterSchema);

export async function nextSequence(name) {
    const counter = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
    return counter.seq;
}

// ---- Accounts ------------------------------------------------------------
export const Admin = model('Admin', new Schema({ ...accountFields }, { timestamps: true }));

export const Specialty = model('Specialty', new Schema({
    name: { type: String, required: true, unique: true, trim: true },
}));

export const Doctor = model('Doctor', new Schema({
    ...accountFields,
    name: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    nmc: { type: String, required: true, trim: true }, // Nepal Medical Council registration number
    specialty: { type: ObjectId, ref: 'Specialty', required: true, index: true },
}, { timestamps: true }));

export const Patient = model('Patient', new Schema({
    ...accountFields,
    number: { type: Number, unique: true }, // shown as "Patient no."
    name: { type: String, required: true, trim: true },
    contact: { type: String, required: true, unique: true, trim: true },
    address: { type: String, required: true, trim: true },
    dob: { ...DATE, required: true },
}, { timestamps: true }));

// ---- Sessions and bookings -----------------------------------------------
// A doctor's availability on one day, split into consecutive 1-hour slots.
// (Called "schedule" in the old database; "session" in the UI.)
const slotSchema = new Schema({ start: { ...TIME, required: true }, end: { ...TIME, required: true } });
const scheduleSchema = new Schema({
    doctor: { type: ObjectId, ref: 'Doctor', required: true },
    date: { ...DATE, required: true, index: true },
    slots: [slotSchema],
}, { timestamps: true });
scheduleSchema.index({ doctor: 1, date: 1 }, { unique: true });
export const Schedule = model('Schedule', scheduleSchema);

// A patient's booking of one slot. Cancelling deletes it, which frees the slot.
const appointmentSchema = new Schema({
    patient: { type: ObjectId, ref: 'Patient', required: true, index: true },
    doctor: { type: ObjectId, ref: 'Doctor', required: true, index: true },
    schedule: { type: ObjectId, ref: 'Schedule', required: true },
    slot: { type: ObjectId, required: true, unique: true }, // one booking per time slot
    date: { ...DATE, required: true, index: true },
    start: { ...TIME, required: true },
    end: { ...TIME, required: true },
    status: { type: String, enum: ['booked', 'completed', 'no_show'], default: 'booked' },
    doctorNotes: { type: String, default: null }, // shown to the patient
    notesUpdatedAt: { type: Date, default: null },
}, { timestamps: true });
// One slot per patient per session.
appointmentSchema.index({ patient: 1, schedule: 1 }, { unique: true });
export const Appointment = model('Appointment', appointmentSchema);

// ---- Heart checks --------------------------------------------------------
const readingSchema = new Schema({
    number: { type: Number, unique: true }, // "Assessment #12" on the PDF
    patient: { type: ObjectId, ref: 'Patient', required: true, index: true },
    // The appointment this reading was shared with, if any. Cancelling that
    // appointment only clears the link; the reading is kept.
    appointment: { type: ObjectId, ref: 'Appointment', default: null, index: true },
    age: Number, sex: Number, cp: Number, trestbps: Number, chol: Number, fbs: Number,
    restecg: Number, thalach: Number, exang: Number, oldpeak: Number, slope: Number,
    ca: Number, thal: Number,
    // The model's probability of heart disease (0-1); null = not scored yet.
    riskScore: { type: Number, default: null },
    takenAt: { type: Date, default: Date.now },
}, { timestamps: true });
export const Reading = model('Reading', readingSchema);

// ---- Chat ----------------------------------------------------------------
// One thread per patient-doctor pair, opened when the patient first books
// that doctor. Not linked to an appointment, so cancelling keeps the chat.
const conversationSchema = new Schema({
    patient: { type: ObjectId, ref: 'Patient', required: true },
    doctor: { type: ObjectId, ref: 'Doctor', required: true, index: true },
}, { timestamps: true });
conversationSchema.index({ patient: 1, doctor: 1 }, { unique: true });
export const Conversation = model('Conversation', conversationSchema);

const messageSchema = new Schema({
    conversation: { type: ObjectId, ref: 'Conversation', required: true },
    senderRole: { type: String, enum: ['patient', 'doctor'], required: true },
    // 'assessment' = a heart check the patient shared in the chat.
    kind: { type: String, enum: ['text', 'assessment'], default: 'text' },
    body: { type: String, default: '' },
    // Cleared when the patient deletes the reading: the card then says it is gone.
    reading: { type: ObjectId, ref: 'Reading', default: null, index: true },
    attachment: {
        type: new Schema({
            storedName: String, // random file name on disk
            originalName: String, // name shown and offered on download
            mime: String,
            size: Number,
        }, { _id: false }),
        default: null,
    },
    readAt: { type: Date, default: null }, // null until the other side opens the thread
}, { timestamps: { createdAt: true, updatedAt: false } });
messageSchema.index({ conversation: 1, _id: 1 });
messageSchema.index({ conversation: 1, senderRole: 1, readAt: 1 });
export const Message = model('Message', messageSchema);

export const QuickReply = model('QuickReply', new Schema({
    doctor: { type: ObjectId, ref: 'Doctor', required: true, index: true },
    body: { type: String, required: true },
}, { timestamps: true }));

// ---- Public contact form -------------------------------------------------
export const ContactMessage = model('ContactMessage', new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
}, { timestamps: true }));

export const ACCOUNT_MODELS = { patient: Patient, doctor: Doctor, admin: Admin };
