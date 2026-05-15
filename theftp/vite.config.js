import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import eslint from 'vite-plugin-eslint'


export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.js',
                'resources/css/geovisor.css',
                'resources/js/geovisor.js',
            ],
            refresh: true,
        }),
        tailwindcss(),
    ]
});
