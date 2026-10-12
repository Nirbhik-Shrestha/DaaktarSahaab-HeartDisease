/**
 * Pages anyone can open.
 *
 *   GET  /api/public/stats     numbers for the homepage "Doctors" card
 *   POST /api/public/contact   {name, email, subject, message}
 */
import { Router } from 'express';
import { Doctor, Specialty, Schedule, ContactMessage } from '../models/index.js';
import { httpError, str } from '../lib/http.js';
import { today } from '../lib/dates.js';
import { EMAIL_PATTERN, MAX_CONTACT_MESSAGE_LENGTH } from '../../../shared/constants.js';

const router = Router();

router.get('/stats', async (req, res) => {
    const cardiology = await Specialty.find({ name: /Cardiologist/i }).distinct('_id');
    const [doctors, specialties, cardiologists, sessions] = await Promise.all([
        Doctor.countDocuments(),
        Doctor.distinct('specialty'),
        Doctor.countDocuments({ specialty: { $in: cardiology } }),
        Schedule.countDocuments({ date: { $gte: today() } }),
    ]);
    res.json({ doctors, specialties: specialties.length, cardiologists, sessions });
});

router.post('/contact', async (req, res) => {
    const name = str(req.body.name);
    const email = str(req.body.email);
    const subject = str(req.body.subject);
    const message = str(req.body.message);

    const errors = [];
    if (!name) errors.push('Please enter your name.');
    if (!EMAIL_PATTERN.test(email)) errors.push('Please enter a valid email address so we can reply.');
    if (!subject) errors.push('Please add a subject.');
    if (!message) errors.push('Please write your message.');
    else if (message.length > MAX_CONTACT_MESSAGE_LENGTH) errors.push(`Your message can be at most ${MAX_CONTACT_MESSAGE_LENGTH} characters.`);
    if (errors.length) throw httpError(422, 'Your message was not sent.', { errors });

    await ContactMessage.create({
        name: name.slice(0, 100), email: email.slice(0, 100), subject: subject.slice(0, 150), message,
    });
    res.status(201).json({ ok: true });
});

export default router;
