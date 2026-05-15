import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import eslint from 'vite-plugin-eslint'


export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/js/app.js',
                'resources/js/geovisor.js',
                'resources/js/dashboard.js',
            ],
            refresh: true,
        }),
        tailwindcss(),
    ]
});
