
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],

    server: {
        host: '0.0.0.0',
        port: 5173,

        // Allow the current HTTPS development tunnel.
        allowedHosts: [
            'light-rings-clean.loca.lt',
        ],

        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
