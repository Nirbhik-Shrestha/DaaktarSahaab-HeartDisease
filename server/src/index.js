import { createApp } from './app.js';
import { connectDb } from './db.js';
import { config } from './config.js';
import { loadModel } from './ml/predict.js';

await connectDb();
console.log(`MongoDB connected: ${config.mongoUri}`);

try {
    loadModel();
} catch (err) {
    console.warn(`Heart model not loaded (${err.message}). Heart checks will be saved unscored.`);
}

createApp().listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
});
