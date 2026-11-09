// Vercel serverless entry-point – boots the Express app and exports it as the
// default handler so Vercel can invoke it for every /api/* request.
import { createApp } from '../server/src/app.js';
import { connectDb } from '../server/src/db.js';
import { loadModel } from '../server/src/ml/predict.js';

// connectDb() is idempotent: Mongoose caches the connection between hot
// invocations so we only open one real connection per container.
await connectDb();

try {
    loadModel();
} catch {
    // Model file is optional; heart checks are saved unscored when missing.
}

export default createApp();

