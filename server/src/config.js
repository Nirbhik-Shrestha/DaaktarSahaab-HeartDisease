/** Settings, read once from the environment (server/.env; see .env.example). */
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    if (isProduction) {
        throw new Error('JWT_SECRET must be set in production.');
    }
    // Development only: sign-ins last until the server restarts.
    jwtSecret = randomBytes(32).toString('hex');
    console.warn('JWT_SECRET is not set; using a random one. Everyone is signed out when the server restarts.');
}

export const config = {
    isProduction,
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/daaktarsahab',
    jwtSecret,
    // Where chat attachments are kept. Not served statically: only the chat
    // API streams a file, and only to the two people in the conversation.
    uploadDir: process.env.UPLOAD_DIR || path.resolve(here, '..', 'uploads', 'chat'),
    // The demo has no email service, so the forgot-password page shows the
    // reset link on screen, as the PHP version did. Never do that in production.
    showResetLinks: process.env.SHOW_RESET_LINKS
        ? process.env.SHOW_RESET_LINKS === 'true'
        : !isProduction,
    // Origin used to build reset links (the React app's address).
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    clientDist: path.resolve(here, '..', '..', 'client', 'dist'),
};
