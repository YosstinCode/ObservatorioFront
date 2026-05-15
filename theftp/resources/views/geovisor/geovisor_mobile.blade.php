{{-- resources/views/geovisor/geovisor_mobile.blade.php --}}
{{-- Vista exclusiva para la app móvil: SOLO el mapa, sin navbar, header ni footer --}}
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Geovisor Móvil</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
    <script>
        // Intercept console to debug in WebView
        window.addEventListener('error', function (e) {
            alert('Error: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
        });
        window.addEventListener('unhandledrejection', function (e) {
            alert('Unhandled Rejection: ' + e.reason);
        });
    </script>
    {{-- Assets: @vite() maneja automáticamente dev (hot reload) y producción (manifest.json) --}}
    @vite(['resources/js/geovisor.js'])
    <style>
        /* ── Overrides específicos para la vista móvil ── */
        * {
            box-sizing: border-box;
        }

        html,
        body {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: hidden;
            background: #fff;
        }

        /* Ocultar el header del geovisor web — la app nativa tiene su propio header */
        .geovisor-header,
        .geovisor-mobile-menu,
        .geovisor-hamburger {
            display: none !important;
        }

        /* El workspace ocupa toda la pantalla */
        #geovisor-root {
            display: flex;
            flex-direction: column;
            height: 100vh;
            height: 100dvh;
            /* dynamic viewport height para móviles */
        }

        .geovisor-workspace {
            flex: 1;
            height: 100% !important;
            max-height: 100% !important;
        }

        /* El mapa ocupa todo el espacio disponible */
        #geovisor-map {
            height: 100% !important;
        }

        /* Panel de rutas: más compacto en móvil */
        .geovisor-layers-panel {
            font-size: 13px !important;
        }

        /* Aceleración por Hardware en WebView para Paneo y Zoom sumamente fluidos */
        .leaflet-pane {
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            perspective: 1000;
            will-change: transform;
        }

        .leaflet-tile-container {
            will-change: transform;
        }

        .leaflet-map-pane canvas {
            will-change: transform;
        }

        /* Scrollbar más delgado */
        ::-webkit-scrollbar {
            width: 4px;
        }

        ::-webkit-scrollbar-thumb {
            background: #ccc;
            border-radius: 4px;
        }
    </style>
</head>

<body>
    <div id="geovisor-root">

        {{-- SIN HEADER — lo pone la app nativa --}}

        {{-- ── ÁREA PRINCIPAL ────────────────────────────────────────────────── --}}
        <div class="geovisor-workspace">

            <div id="geovisor-panel-overlay" aria-hidden="true"></div>

            {{-- PANEL DE RUTAS --}}
            <aside id="geovisor-layers-panel" class="geovisor-layers-panel" role="complementary"
                aria-label="Panel de rutas del mapa">

                <div class="layers-section">
                    <h3 class="layers-section-title">Mi Ubicación</h3>
                    <button id="btn-gps" class="geovisor-gps-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                            stroke="currentColor" width="16" height="16">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span>Activar ubicación actual</span>
                    </button>
                </div>

                <div class="layers-divider"></div>

                {{-- PLANIFICADOR DE VIAJE --}}
                <div class="layers-section">
                    <h3 class="layers-section-title">Planificador de Viaje</h3>
                    <div class="trip-planner-section">
                        <div class="btn-group-planner">
                            <button id="btn-set-origin" class="btn-planner" title="Marcar punto de inicio en el mapa">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                                    stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round"
                                        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path stroke-linecap="round" stroke-linejoin="round"
                                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                </svg>
                                <span>Punto A</span>
                            </button>
                            <button id="btn-set-dest" class="btn-planner" title="Marcar punto de destino en el mapa">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                                    stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round"
                                        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path stroke-linecap="round" stroke-linejoin="round"
                                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                </svg>
                                <span>Punto B</span>
                            </button>
                        </div>
                        <button id="btn-gps-as-origin" class="btn-planner-gps" style="display:none"
                            title="Usar tu ubicacion GPS como punto de inicio">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                                stroke="currentColor" width="14" height="14">
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            Usar mi ubicacion como origen
                        </button>
                        <button id="btn-clear-planner" class="btn-planner-clear">
                            Limpiar planificador
                        </button>
                    </div>
                </div>

                <div class="layers-divider"></div>

                <div class="layers-section">
                    <h3 class="layers-section-title">Mapa base</h3>
                    <div id="layers-base-section" class="layers-list"></div>
                </div>

                <div class="layers-divider"></div>

                <div class="layers-section">
                    <h3 class="layers-section-title">Rutas de Transporte</h3>
                    <div class="search-container mb-3">
                        <input type="text" id="route-search" placeholder="Buscar ruta..." class="geovisor-search-input">
                    </div>
                    <div id="layers-overlay-section" class="layers-list">
                        <div class="p-4 text-center text-gray-400 text-xs">Cargando rutas...</div>
                    </div>
                </div>
            </aside>

            {{-- MAPA --}}
            <main class="geovisor-main" role="main">
                <div id="geovisor-map" aria-label="Mapa interactivo de rutas y paraderos" tabindex="0">
                </div>

                {{-- Botón GPS Flotante --}}
                <button id="fab-gps" class="geovisor-fab-gps" title="Mi ubicación">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5"
                        stroke="currentColor" width="20" height="20">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                </button>

                {{-- Resumen de Viaje --}}
                <div id="trip-summary-badge" class="trip-summary-badge hidden">
                    <div class="trip-summary-header">
                        <div id="trip-summary-route-name" class="trip-summary-route">Calculando viaje...</div>
                        <div class="flex items-center gap-2">
                            <div id="trip-summary-walk-time" class="walk-info">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                                    stroke="currentColor" width="14" height="14">
                                    <path stroke-linecap="round" stroke-linejoin="round"
                                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span id="trip-time-text">0 min</span>
                            </div>
                            <button id="btn-toggle-trip-summary" class="btn-trip-toggle" title="Minimizar/Expandir">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3"
                                    stroke="currentColor" width="16" height="16">
                                    <path stroke-linecap="round" stroke-linejoin="round"
                                        d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div id="trip-summary-content" class="trip-summary-body">
                        <div class="trip-step">
                            <span class="trip-dot" style="background:#3b82f6"></span>
                            <span id="trip-origin-text">Sube en: ...</span>
                        </div>
                        <div class="trip-step">
                            <span class="trip-dot" style="background:#ef4444"></span>
                            <span id="trip-dest-text">Baja en: ...</span>
                        </div>
                    </div>
                    <div id="trip-alternatives" class="trip-alternatives hidden"></div>
                    <div class="trip-summary-footer">
                        <span id="trip-dist-text">Caminata: 0m</span>
                        <span style="font-size:0.68rem; font-style:italic; opacity:0.7">Aprox.</span>
                    </div>
                </div>

                {{-- Badge GPS → Punto A --}}
                <div id="gps-to-origin-info" class="gps-to-origin-badge hidden">
                    <span id="gps-to-origin-text"></span>
                    <button id="btn-close-gps-badge" class="btn-close-gps" title="Cerrar">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5"
                            stroke="currentColor" width="12" height="12">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </main>

            {{-- PANEL DE INFORMACIÓN --}}
            <aside id="geovisor-info-panel" class="geovisor-info-panel geovisor-info-panel--hidden" role="complementary"
                aria-label="Información del elemento seleccionado">
                <div class="geovisor-info-header">
                    <h2 id="geovisor-info-title" class="geovisor-info-title">—</h2>
                    <button id="geovisor-info-close" class="geovisor-info-close"
                        aria-label="Cerrar panel de información">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5"
                            stroke="currentColor" width="14" height="14">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div id="geovisor-info-body" class="geovisor-info-body">
                    <p class="geovisor-info-placeholder">
                        Selecciona una ruta o paradero en el mapa para ver su información.
                    </p>
                </div>
            </aside>

        </div>{{-- /.geovisor-workspace --}}

        {{-- MODAL GPS --}}
        <div id="gps-permission-backdrop" class="gps-modal-backdrop hidden">
            <div id="gps-permission-modal" class="gps-modal-card">
                <div class="gps-modal-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                </div>
                <h3 class="gps-modal-title">¿Activar ubicación actual?</h3>
                <p class="gps-modal-text">
                    Para brindarte una mejor experiencia, necesitamos acceder a tu ubicación.
                    Esto nos permitirá mostrarte los <strong>paraderos más cercanos</strong> y calcular tus viajes con
                    mayor precisión.
                </p>
                <div class="gps-modal-actions">
                    <button id="btn-gps-confirm" class="btn-gps-primary">Activar ubicación actual</button>
                    <button id="btn-gps-cancel" class="btn-gps-secondary">Ahora no</button>
                </div>
            </div>
        </div>

    </div>{{-- /#geovisor-root --}}

    {{-- Data bridge Blade → JS --}}
    <script id="geovisor-config" type="application/json">
{
    "mapCenter": {
        "lat":  {{ $mapCenter['lat'] }},
        "lng":  {{ $mapCenter['lng'] }},
        "zoom": {{ $mapCenter['zoom'] }}
    },
    "isMobileApp": true
}
</script>

    {{-- Botón hamburguesa mobile → delega al panel de rutas (btn-toggle-layers) --}}
    <script>
        (function () {
            // En la vista mobile no existe el header web, pero el geovisor.js
            // puede necesitar el btn-toggle-layers. Lo creamos invisible para que funcione.
            const fakeBtn = document.createElement('button');
            fakeBtn.id = 'btn-toggle-layers';
            fakeBtn.style.display = 'none';
            document.body.appendChild(fakeBtn);

            // Interceptar clics del header nativo de React Native via postMessage
            // La app nativa puede enviar { type: 'TOGGLE_PANEL' } para abrir/cerrar el panel
            document.addEventListener('message', function (e) {
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'TOGGLE_PANEL') {
                        fakeBtn.click();
                    }
                } catch (_) { }
            });
            window.addEventListener('message', function (e) {
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'TOGGLE_PANEL') {
                        fakeBtn.click();
                    }
                } catch (_) { }
            });
        })();
    </script>

</body>

</html>