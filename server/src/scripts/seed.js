/**
 * First-run data: the doctor specialties and an admin account.
 *
 *   npm run seed            (from the project root)
 *
 * Safe to re-run: specialties are added only if missing, and the admin is
 * created only when there is no admin yet. Set ADMIN_EMAIL / ADMIN_PASSWORD
 * in server/.env to choose the admin's sign-in; change the password after
 * the first sign-in (Dashboard -> Your account).
 */
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../db.js';
import { Admin, Specialty } from '../models/index.js';

const SPECIALTIES = [
    'General Physician', 'Cardiologist', 'Neurologist', 'Orthopedist', 'Dermatologist',
    'Pediatrician', 'Gynecologist', 'Psychiatrist', 'Ophthalmologist', 'ENT Specialist',
];

await connectDb();

for (const name of SPECIALTIES) {
    await Specialty.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true });
}
console.log(`Specialties: ${await Specialty.countDocuments()}`);

if (await Admin.exists({})) {
    console.log('An admin account already exists; left unchanged.');
} else {
    const email = (process.env.ADMIN_EMAIL || 'admin@doctorproject.com').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    await Admin.create({ email, password: await bcrypt.hash(password, 10) });
    console.log(`Admin created: ${email} / ${password}  (change this password after signing in)`);
}

await disconnectDb();
