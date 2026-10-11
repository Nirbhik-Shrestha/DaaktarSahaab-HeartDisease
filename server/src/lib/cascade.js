/**
 * What the old MySQL foreign keys did on delete, done by hand.
 *
 *   appointment gone  -> readings shared with it are kept, only unlinked (SET NULL)
 *   reading gone      -> chat cards pointing at it say "no longer available" (SET NULL)
 *   schedule gone     -> its appointments go too (CASCADE)
 *   doctor gone       -> sessions, appointments, chats and quick replies go (CASCADE)
 *   patient gone      -> appointments, readings and chats go (CASCADE)
 *   conversation gone -> its messages and their attachment files go (CASCADE)
 */
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import {
    Appointment, Reading, Schedule, Doctor, Patient, Conversation, Message, QuickReply,
} from '../models/index.js';
import { config } from '../config.js';

export async function deleteAppointments(filter) {
    const ids = await Appointment.find(filter).distinct('_id');
    if (!ids.length) return 0;
    await Reading.updateMany({ appointment: { $in: ids } }, { $set: { appointment: null } });
    const { deletedCount } = await Appointment.deleteMany({ _id: { $in: ids } });
    return deletedCount;
}

export async function removeAttachmentFile(storedName) {
    if (!storedName) return;
    try {
        await unlink(path.join(config.uploadDir, path.basename(storedName)));
    } catch {
        // Already gone; nothing else to do.
    }
}

export async function deleteConversations(filter) {
    const ids = await Conversation.find(filter).distinct('_id');
    if (!ids.length) return;
    const withFiles = await Message.find({ conversation: { $in: ids }, attachment: { $ne: null } }, 'attachment').lean();
    await Message.deleteMany({ conversation: { $in: ids } });
    await Conversation.deleteMany({ _id: { $in: ids } });
    await Promise.all(withFiles.map((m) => removeAttachmentFile(m.attachment.storedName)));
}

export async function deleteSchedule(scheduleId) {
    const booked = await deleteAppointments({ schedule: scheduleId });
    const { deletedCount } = await Schedule.deleteOne({ _id: scheduleId });
    return { deleted: deletedCount === 1, cancelledAppointments: booked };
}

export async function deleteReading(readingId) {
    await Message.updateMany({ reading: readingId }, { $set: { reading: null } });
    const { deletedCount } = await Reading.deleteOne({ _id: readingId });
    return deletedCount === 1;
}

export async function deleteDoctor(doctorId) {
    if (!(await Doctor.exists({ _id: doctorId }))) return false;
    await deleteAppointments({ doctor: doctorId });
    await Schedule.deleteMany({ doctor: doctorId });
    await deleteConversations({ doctor: doctorId });
    await QuickReply.deleteMany({ doctor: doctorId });
    const { deletedCount } = await Doctor.deleteOne({ _id: doctorId });
    return deletedCount === 1;
}

export async function deletePatient(patientId) {
    if (!(await Patient.exists({ _id: patientId }))) return false;
    await deleteConversations({ patient: patientId });
    await Appointment.deleteMany({ patient: patientId });
    await Reading.deleteMany({ patient: patientId });
    const { deletedCount } = await Patient.deleteOne({ _id: patientId });
    return deletedCount === 1;
}
