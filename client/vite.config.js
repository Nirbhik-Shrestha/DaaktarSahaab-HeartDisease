import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
    plugins: [react()],
    resolve: {
        // The assessment fields and limits are shared with the API (../shared).
        alias: { '@shared': shared },
    },
    server: {
        port: 5173,
        fs: { allow: ['..'] },
        // The API runs on :5000; proxying keeps the sign-in cookie same-origin.
        proxy: { '/api': process.env.API_PROXY || 'http://localhost:5000' },
    },
});
