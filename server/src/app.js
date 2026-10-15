import express from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { requireSameSite } from './middleware/auth.js';
import { HttpError } from './lib/http.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import patientRoutes from './routes/patient.js';
import doctorRoutes from './routes/doctor.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';

export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use((req, res, next) => {
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'same-origin',
        });
        next();
    });

    const api = express.Router();
    api.use(express.json({ limit: '100kb' }));
    api.use(cookieParser());
    api.use(requireSameSite);
    api.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });

    api.get('/health', (req, res) => res.json({ ok: true }));
    api.use('/auth', authRoutes);
    api.use('/public', publicRoutes);
    api.use('/patient', patientRoutes);
    api.use('/doctor', doctorRoutes);
    api.use('/admin', adminRoutes);
    api.use('/chat', chatRoutes);
    api.use((req, res) => res.status(404).json({ error: 'Not found.' }));
    app.use('/api', api);

    // Production: the built React app, with every other path going to it.
    if (existsSync(config.clientDist)) {
        app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
        app.get('/{*path}', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
    }

    // Errors: the ones we raise carry their own status and message.
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err instanceof HttpError) {
            return res.status(err.status).json({ error: err.message, ...err.extra });
        }
        if (err.type === 'entity.parse.failed') {
            return res.status(400).json({ error: 'The request could not be read.' });
        }
        if (err.type === 'entity.too.large') {
            return res.status(413).json({ error: 'That request is too large.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    });

    return app;
}
