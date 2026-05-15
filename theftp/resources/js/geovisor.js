import L from 'leaflet';
import MapCore from './services/MapCore';
import 'leaflet/dist/leaflet.css';
import '../css/geovisor.css';

/**
 * Geovisor Público - Dinámico (Restaurado)
 * ─────────────────────────────────────────────────────────────────────────────
 * Consume rutas y paraderos de la API pública.
 * Implementa geolocalización y cálculo de paradero más cercano.
 */

// ─────────────────────────────────────────────────────────────────────────────
// E S T A D O
// ─────────────────────────────────────────────────────────────────────────────
let core = null;
let routesData = []; // [{ id, name, file_name, paraderos: [] }]
let userLocation = null;
let currentRouteId = null;

// Estados del planificador
let plannerMode = null; // 'origin' | 'destination' | null

// ─────────────────────────────────────────────────────────────────────────────
// U T I L I D A D E S
// ─────────────────────────────────────────────────────────────────────────────

const setLoaderVisible = (v, msg) => {
    const el = document.getElementById('geovisor-loader');
    const txt = el?.querySelector('span:last-child');
    if (el) el.style.display = v ? 'flex' : 'none';
    if (txt && msg) txt.textContent = msg;
};

// Cálculo de distancia Haversine (en metros)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Utilidad para evitar saturar APIs con llamadas consecutivas rápidas.
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// A P I
// ─────────────────────────────────────────────────────────────────────────────

async function fetchRutasPublicas() {
    try {
        const res = await fetch('/api/public/geovisor/rutas?_t=' + Date.now());
        const json = await res.json();
        if (json.status) return json.data;
        throw new Error(json.message || 'Error en respuesta');
    } catch (e) {
        console.error('[Geovisor] Fallo carga API:', e);
        return [];
    }
}

/**
 * Sincroniza los trazados reales (siguiendo calles) desde el GPS 
 * hasta los puntos de interés.
 */
async function syncGpsPaths() {
    if (!userLocation) return;

    // 1. Limpieza profunda inicial de trazados GPS previos
    core.clearExtraPath('gps-to-origin');
    core.clearExtraPath('gps-to-nearest-stop');

    // 2. Trazado GPS -> Punto A (Prioridad si existe Punto A)
    if (core.tripPoints.origin) {
        const originLatLng = core.tripPoints.origin.latlng;
        // Dibujamos linea recta informativa inicialmente
        core.upsertExtraPath('gps-to-origin', userLocation, originLatLng, {
            color: '#3b82f6',
            dashArray: '5, 8'
        });

        // Consultar rutas reales por carretera (una o más)
        const geometries = await core.fetchWalkingRoute(userLocation, originLatLng);
        if (geometries && geometries.length > 0) {
            geometries.forEach((geom, i) => {
                const pathId = i === 0 ? 'gps-to-origin' : `gps-to-origin-alt-${i}`;
                core.upsertExtraPath(pathId, userLocation, originLatLng, {
                    color: i === 0 ? '#3b82f6' : '#ec4899', // Azul para principal, Rosa para alternativa
                    geometry: geom,
                    dashArray: i === 0 ? null : '5, 8',
                    weight: i === 0 ? 3 : 3,
                    opacity: i === 0 ? 1 : 0.7
                });
            });
        }
    } else {
        // Si NO hay Punto A, limpiamos el conector GPS -> A
        core.clearExtraPath('gps-to-origin');

        // 2. Trazado GPS -> Paradero más cercano (Solo de rutas VISIBLES)
        const visibleRoutes = routesData.filter(r => r.isVisible);
        const nearest = core.findNearestStopAcrossAllRoutes(userLocation, visibleRoutes);
        if (nearest) {
            const stopLoc = L.latLng(nearest.lat, nearest.lng);
            core.upsertExtraPath('gps-to-nearest-stop', userLocation, stopLoc, {
                color: '#10b981',
                dashArray: '5, 5'
            });

            const geometries = await core.fetchWalkingRoute(userLocation, stopLoc);
            if (geometries && geometries.length > 0) {
                geometries.forEach((geom, i) => {
                    const pathId = i === 0 ? 'gps-to-nearest-stop' : `gps-to-nearest-stop-alt-${i}`;
                    core.upsertExtraPath(pathId, userLocation, stopLoc, {
                        color: i === 0 ? '#10b981' : '#ec4899', // Verde para principal, Rosa para alternativa
                        geometry: geom,
                        dashArray: i === 0 ? null : '5, 10',
                        weight: i === 0 ? 3 : 3,
                        opacity: i === 0 ? 1 : 0.7
                    });
                });
            }
        }
    }
}

/**
 * Trazado de los segmentos de caminata:
 * 1. Punto A -> Paradero de subida
 * 2. Paradero de bajada -> Punto B
 */
async function syncTripWalkingPaths(result) {
    core.clearExtraPath('origin-to-stop');
    core.clearExtraPath('stop-to-dest');

    window.lastRealDistA = null;
    window.lastRealDistB = null;

    if (!result || !result.hasResults || !result.best) return;

    const best = result.best;
    const originLatLng = core.tripPoints.origin.latlng;
    const destLatLng = core.tripPoints.destination.latlng;

    // Usamos DIRECTAMENTE los paraderos que findBestTrip (Haversine global) ya eligió.
    // OSRM se usa SOLO para dibujar la línea real por calles, NUNCA para cambiar de paraderos.
    const stopALatLng = L.latLng(best.stopA.lat, best.stopA.lng);
    const stopBLatLng = L.latLng(best.stopB.lat, best.stopB.lng);

    // 1. Dibujar líneas informativas inmediatas (cortadas = a pie)
    core.upsertExtraPath('origin-to-stop', originLatLng, stopALatLng, {
        color: '#8b5cf6', dashArray: '5, 8', weight: 2, opacity: 0.6
    });
    core.upsertExtraPath('stop-to-dest', stopBLatLng, destLatLng, {
        color: '#8b5cf6', dashArray: '5, 8', weight: 2, opacity: 0.6
    });

    // 2. Consultar OSRM para trazar el camino real por calles (NO cambia paraderos)
    try {
        const [geomsA, geomsB] = await Promise.all([
            core.fetchWalkingRoute(originLatLng, stopALatLng),
            core.fetchWalkingRoute(stopBLatLng, destLatLng)
        ]);

        // Segmento A: Punto A → Paradero de subida
        if (geomsA && geomsA.length > 0) {
            core.upsertExtraPath('origin-to-stop', originLatLng, stopALatLng, {
                color: '#8b5cf6', geometry: geomsA[0], weight: 3, dashArray: null
            });
            window.lastRealDistA = Math.round(calculatePathDistance(geomsA[0]));
        }

        // Segmento B: Paradero de bajada → Punto B
        if (geomsB && geomsB.length > 0) {
            core.upsertExtraPath('stop-to-dest', stopBLatLng, destLatLng, {
                color: '#8b5cf6', geometry: geomsB[0], weight: 3, dashArray: null
            });
            window.lastRealDistB = Math.round(calculatePathDistance(geomsB[0]));
        }

        // Actualizar textos del panel con distancias reales
        updateTripUITexts(best);
    } catch (e) {
        console.warn('[TripPlanner] Error en OSRM:', e);
    }
}

/**
 * Calcula la distancia de una geometría [ [lat, lng], ... ] en metros
 */
function calculatePathDistance(geometry) {
    let dist = 0;
    for (let i = 0; i < geometry.length - 1; i++) {
        dist += L.latLng(geometry[i]).distanceTo(L.latLng(geometry[i + 1]));
    }
    return dist;
}

// Versiones debounced para proteger los servidores de rutas (OSRM)
const debouncedSyncGpsPaths = debounce(() => syncGpsPaths(), 500);
const debouncedSyncWalkingPaths = debounce((result) => syncTripWalkingPaths(result), 500);

// ─────────────────────────────────────────────────────────────────────────────
// L Ó G I C A   D E   P L A N I F I C A D O R
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Actualiza el badge visual con el resumen del viaje.
 * Ahora analiza TODAS las rutas y recomienda la mejor automaticamente.
 */
function updateTripUI() {
    const badge = document.getElementById('trip-summary-badge');

    if (!core.tripPoints.origin || !core.tripPoints.destination) {
        badge?.classList.add('hidden');
        updateGpsToOriginBadge();
        core.clearExtraPath('origin-to-stop');
        core.clearExtraPath('stop-to-dest');
        return;
    }

    debouncedSyncGpsPaths();

    const visibleRoutes = routesData.filter(r => r.isVisible);
    const result = core.findBestTrip(visibleRoutes);

    // Esta función ahora es asíncrona e inteligente:
    syncTripWalkingPaths(result);

    if (!result || !result.hasResults) {
        showTripUIError();
        return;
    }

    updateTripUITexts(result.best);
}

function updateTripUITexts(best) {
    const badge = document.getElementById('trip-summary-badge');
    const routeNameEl = document.getElementById('trip-summary-route-name');
    const walkTimeEl = document.getElementById('trip-time-text');
    const originTextEl = document.getElementById('trip-origin-text');
    const destTextEl = document.getElementById('trip-dest-text');
    const distTextEl = document.getElementById('trip-dist-text');

    badge?.classList.remove('hidden', 'trip-summary-error');

    document.getElementById('trip-summary-walk-time')?.style.setProperty('display', 'flex', 'important');
    document.querySelector('.trip-summary-footer')?.style.setProperty('display', 'flex', 'important');

    document.querySelectorAll('#trip-summary-content .trip-step').forEach(step => {
        step.style.setProperty('display', 'flex', 'important');
        const dot = step.querySelector('.trip-dot');
        if (dot) dot.style.setProperty('display', 'block', 'important');
    });

    // Sincronización de textos con distancias REALES
    routeNameEl.textContent = best.routeName;

    // Usamos las distancias reales si están disponibles, sino las geográficas
    const dA = window.lastRealDistA || best.distToA;
    const dB = window.lastRealDistB || best.distToB;
    const totalDist = dA + dB;

    // Etiquetas de sentido (Regreso / Final de ruta)
    let statusBadge = '';
    if (best.isRegreso) {
        statusBadge = ' <span class="badge-status-regreso">(Tramo de Regreso)</span>';
    } else if (best.isFinalDeRuta) {
        // La lógica de bloqueo idx > 5 ya viene calculada desde MapCore
        statusBadge = ' <span class="badge-status-final">(Llegada a final de ruta)</span>';
    }

    const stopANameFormatted = (best.stopA.name || 'Paradero ' + (best.idxA + 1)) + statusBadge;
    const stopBNameFormatted = (best.stopB.name || 'Paradero ' + (best.idxB + 1));

    originTextEl.innerHTML = `Sube en: ${stopANameFormatted} (~${dA}m)`;
    destTextEl.innerHTML = `Baja en: ${stopBNameFormatted} (~${dB}m)`;
    distTextEl.textContent = `Caminata total: ${totalDist}m`;
    walkTimeEl.textContent = `${Math.max(1, Math.ceil(totalDist / 80))} min aprox.`;

    updateGpsToOriginBadge();
}

/** Muestra error en el UI cuando no hay rutas */
function showTripUIError() {
    const badge = document.getElementById('trip-summary-badge');
    const routeNameEl = document.getElementById('trip-summary-route-name');
    const originTextEl = document.getElementById('trip-origin-text');
    const destTextEl = document.getElementById('trip-dest-text');

    badge?.classList.remove('hidden');
    badge?.classList.add('trip-summary-error');
    routeNameEl.textContent = 'Sin rutas disponibles';

    document.getElementById('trip-dest-text').textContent = '';
    document.getElementById('trip-dist-text').textContent = '';
    document.getElementById('trip-time-text').textContent = '';

    const timeChip = document.getElementById('trip-summary-walk-time');
    if (timeChip) timeChip.style.setProperty('display', 'none', 'important');

    const summaryFooter = document.querySelector('.trip-summary-footer');
    if (summaryFooter) summaryFooter.style.setProperty('display', 'none', 'important');

    const alternativesEl = document.getElementById('trip-alternatives');
    if (alternativesEl) alternativesEl.style.setProperty('display', 'none', 'important');

    originTextEl.textContent = 'Activa al menos una ruta en el panel lateral para calcular tu viaje.';

    document.querySelectorAll('#trip-summary-content .trip-step').forEach((step, idx) => {
        if (idx > 0) step.style.setProperty('display', 'none', 'important');
        else {
            step.style.setProperty('display', 'block', 'important');
            const dot = step.querySelector('.trip-dot');
            if (dot) dot.style.setProperty('display', 'none', 'important');
        }
    });
}

/**
 * Muestra la distancia GPS -> Punto A de forma independiente.
 * Solo visible si el GPS esta activo y hay un Punto A marcado.
 */
let gpsBadgeDismissed = false;

function updateGpsToOriginBadge() {
    const el = document.getElementById('gps-to-origin-info');
    const textEl = document.getElementById('gps-to-origin-text');
    if (!el || !textEl) return;

    if (!userLocation || !core.tripPoints.origin || gpsBadgeDismissed) {
        el.classList.add('hidden');
        return;
    }

    const info = core.getGpsToOriginInfo(userLocation);
    if (!info) {
        el.classList.add('hidden');
        return;
    }

    el.classList.remove('hidden');
    textEl.textContent = `A ${info.distance}m del punto A (~${info.time} min)`;

    // Configurar boton de cerrar
    const btnClose = document.getElementById('btn-close-gps-badge');
    if (btnClose && !btnClose.dataset.ready) {
        btnClose.dataset.ready = 'true';
        btnClose.addEventListener('click', (e) => {
            e.stopPropagation();
            el.classList.add('hidden');
            gpsBadgeDismissed = true;
        });
    }
}


function findAndZoomToNearestStop(routeId) {
    // Si estamos en modo planificación A->B, no hacemos el autozoom simple al GPS
    if (core.tripPoints.origin && core.tripPoints.destination) {
        updateTripUI();
        return;
    }

    const route = routesData.find(r => r.id == routeId);
    if (!route || !route.paraderos || route.paraderos.length === 0 || !userLocation) {
        document.getElementById('nearest-stop-badge')?.classList.add('hidden');
        return;
    }

    let nearest = null;
    let minDistance = Infinity;

    route.paraderos.forEach(p => {
        const d = getDistance(userLocation.lat, userLocation.lng, parseFloat(p.lat), parseFloat(p.lng));
        if (d < minDistance) {
            minDistance = d;
            nearest = p;
        }
    });

    if (nearest) {
        const badge = document.getElementById('nearest-stop-badge');
        const text = document.getElementById('nearest-stop-text');

        if (badge && text) {
            badge.classList.remove('hidden');
            const distKm = (minDistance / 1000).toFixed(1);
            text.textContent = `Paradero más cercano: ${nearest.name} (${distKm} km)`;
        }

        // Auto-zoom al paradero sugerido
        core.map.setView([nearest.lat, nearest.lng], 16, { animate: true });

        // Efecto visual: popup temporal o resaltar
        L.popup()
            .setLatLng([nearest.lat, nearest.lng])
            .setContent(`<b>¡Paradero más cercano!</b><br>${nearest.name}<br>Distancia: ${minDistance.toFixed(0)}m`)
            .openOn(core.map);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// U I - R E N D E R
// ─────────────────────────────────────────────────────────────────────────────

function buildRoutesList(rutas) {
    const section = document.getElementById('layers-overlay-section');
    if (!section) return;

    if (rutas.length === 0) {
        section.innerHTML = '<p class="p-4 text-center text-gray-500 text-xs italic">No se encontraron rutas activas.</p>';
        return;
    }

    section.innerHTML = '';

    // Nueva clase para lista vertical
    section.className = 'routes-stack';

    rutas.forEach((r, idx) => {
        const card = document.createElement('div');
        card.className = 'route-card';
        card.dataset.routeId = r.id;

        // Colores compartidos con MapCore logic
        const colors = ['#6366f1', '#f43f5e', '#0284c7', '#d946ef', '#8b5cf6'];
        const color = colors[idx % colors.length];

        card.innerHTML = `
            <div class="route-card-main">
                <div class="route-card-info">
                    <span class="route-card-dot" style="background:${color}"></span>
                    <div class="route-card-text">
                        <span class="route-card-name">${r.name}</span>
                        <span class="route-card-meta">${r.paraderos.length} paraderos oficiales</span>
                    </div>
                </div>
                <label class="route-card-switch">
                    <input type="checkbox" class="layer-check" data-rid="${r.id}">
                    <span class="route-card-slider"></span>
                </label>
            </div>
        `;

        const checkEl = card.querySelector('input');
        checkEl.addEventListener('change', async () => {
            const isChecked = checkEl.checked;
            card.classList.toggle('active', isChecked);
            await toggleRoute(r, idx, isChecked);
        });

        section.appendChild(card);
    });
}

/**
 * Función centralizada para mostrar/ocultar una ruta y sus paraderos.
 */
async function toggleRoute(route, index, isVisible) {
    route.isVisible = isVisible; // Rastrear visibilidad para cálculos de GPS
    if (isVisible) {
        currentRouteId = route.id;
        // Solo mostrar loader si no es la carga inicial masiva (manejado en init)
        const isBulk = document.body.dataset.loadingBulk === 'true';
        if (!isBulk) setLoaderVisible(true, `Trazando ${route.name}...`);

        try {
            // Cargar KMZ dinámicamente si no está en cache de MapCore
            if (!route.file_name || route.file_name.trim() === "") {
                console.warn(`[Geovisor] La ruta "${route.name}" no tiene archivo de trazado (.kmz) asignado.`);
                if (window.showNotification) {
                    window.showNotification('warning', 'Trazado no disponible', `La ruta "${route.name}" no cuenta con archivo KMZ en base de datos.`);
                }
            } else if (!core.overlayGroups[route.name]) {
                await core.loadKmz(route.file_name, route.name, index, {}, { onlyLines: true });
            } else {
                core.overlayGroups[route.name].addTo(core.map);
            }

            // Dibujar paraderos asociados
            drawParaderos(route.paraderos, route.name);

            // Auto-zoom si hay GPS y es acción manual del usuario
            if (userLocation && !isBulk) {
                findAndZoomToNearestStop(route.id);
            }
        } catch (e) {
            console.error('Error al trazar ruta:', e);
        } finally {
            if (!isBulk) setLoaderVisible(false);
        }
    } else {
        // Ocultar ruta
        if (core.overlayGroups[route.name]) core.map.removeLayer(core.overlayGroups[route.name]);
        if (core.overlayGroups[`Paraderos: ${route.name}`]) core.map.removeLayer(core.overlayGroups[`Paraderos: ${route.name}`]);

        if (currentRouteId == route.id) {
            currentRouteId = null;
            document.getElementById('nearest-stop-badge')?.classList.add('hidden');
        }
    }

    // Sincronizar automáticamente el trazado GPS y el planificador
    if (userLocation) {
        debouncedSyncGpsPaths();
    }
    updateTripUI();
}

function drawParaderos(paraderos, routeName) {
    const label = `Paraderos: ${routeName}`;
    if (core.overlayGroups[label]) {
        core.overlayGroups[label].addTo(core.map);
        return;
    }

    const group = L.featureGroup();
    paraderos.forEach(p => {
        // Icono de paradero (tipo MapCore - Bus icon)
        const marker = L.marker([p.lat, p.lng], {
            icon: L.divIcon({
                className: 'geovisor-paradero-icon',
                html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                    <circle cx="12" cy="12" r="10" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
                    <path d="M7 8h10M7 11h10M8 15h2v2H8zm6 0h2v2h-2zM6 7a2 2 0 012-2h8a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2V7z" 
                          stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`,
                iconSize: [24, 24], iconAnchor: [12, 12]
            })
        }).bindTooltip(p.name);

        // Se comenta el evento de clic por solicitud del usuario (sin nombres/descripciones de momento)
        /*
        marker.on('click', () => {
            document.getElementById('geovisor-info-title').textContent = p.name;
            document.getElementById('geovisor-info-body').innerHTML = `
                <div class="p-2">
                    <p class="text-sm text-gray-600 mb-2">${p.description || 'Sin descripción adicional.'}</p>
                    <span class="geovisor-info-source">Infraestructura Oficial</span>
                </div>
            `;
            document.getElementById('geovisor-info-panel').classList.remove('geovisor-info-panel--hidden');
        });
        */

        group.addLayer(marker);
    });

    group.addTo(core.map);
    core.overlayGroups[label] = group;
}

// ─────────────────────────────────────────────────────────────────────────────
// E V E N T O S   Y   G P S
// ─────────────────────────────────────────────────────────────────────────────

function setupLayerPanelToggle() {
    const btn = document.getElementById('btn-toggle-layers');
    const panel = document.getElementById('geovisor-layers-panel');
    const overlay = document.getElementById('geovisor-panel-overlay');

    if (!btn || !panel) return;

    const toggle = () => {
        const isHidden = panel.classList.toggle('geovisor-layers-panel--hidden');
        btn.setAttribute('aria-expanded', !isHidden);

        // Sincronizar clase con el body (para ocultar badges en movil)
        document.body.classList.toggle('sidebar-open', !isHidden);

        if (overlay) {
            overlay.classList.toggle('visible', !isHidden);
        }

        // Forzar a Leaflet a recalcular el tamaño tras la transición CSS (0.28s)
        core.invalidateSize();
    };

    btn.addEventListener('click', toggle);

    // Cerrar al tocar el overlay (móvil)
    overlay?.addEventListener('click', toggle);
}

function setupGps() {
    const backdrop = document.getElementById('gps-permission-backdrop');
    const btnConfirm = document.getElementById('btn-gps-confirm');
    const btnCancel = document.getElementById('btn-gps-cancel');

    const hideModal = () => backdrop?.classList.add('hidden');
    const showModal = () => backdrop?.classList.remove('hidden');

    const startGpsSearch = () => {
        hideModal();
        setLoaderVisible(true, 'Obteniendo ubicación GPS...');
        core.map.locate({ setView: true, maxZoom: 15 });
    };

    // Al pulsar cualquier boton de GPS: mostrar modal en lugar de actuar directo
    document.getElementById('btn-gps')?.addEventListener('click', showModal);
    document.getElementById('fab-gps')?.addEventListener('click', showModal);

    // Acciones del modal
    btnConfirm?.addEventListener('click', startGpsSearch);
    btnCancel?.addEventListener('click', hideModal);

    // Cerrar al tocar el backdrop
    backdrop?.addEventListener('click', (e) => {
        if (e.target === backdrop) hideModal();
    });

    core.map.on('locationfound', (e) => {
        userLocation = e.latlng;
        setLoaderVisible(false);

        // Crear marcador de usuario si no existe
        if (!window.userMarker) {
            window.userMarker = L.circleMarker(e.latlng, {
                radius: 8,
                fillColor: '#3b82f6',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(core.map).bindTooltip('Tu estás aquí');
        } else {
            window.userMarker.setLatLng(e.latlng);
        }

        // Trazado GPS -> Destinos (Debounced)
        debouncedSyncGpsPaths();

        // Actualizar distancia GPS -> Punto A (si existe)
        updateGpsToOriginBadge();

        // Mostrar boton "Usar mi ubicacion" si existe
        const btnGpsOrigin = document.getElementById('btn-gps-as-origin');
        if (btnGpsOrigin) btnGpsOrigin.style.display = 'flex';

        // Si hay una ruta seleccionada, recalculamos paradero cercano
        if (currentRouteId) {
            findAndZoomToNearestStop(currentRouteId);
        }

        if (window.showNotification) {
            window.showNotification('success', 'Ubicación', 'Ubicación encontrada correctamente.', 2000);
        }
    });

    core.map.on('locationerror', (e) => {
        setLoaderVisible(false);
        if (window.showNotification) {
            window.showNotification('warning', 'GPS', 'No pudimos acceder a tu ubicación.', 3000);
        }
    });
}

/**
 * NUEVO: Inicializa el selector visual de mapas base
 */
function setupBaseMapSelector() {
    const container = document.getElementById('layers-base-section');
    if (!container) return;

    const baseMaps = [
        {
            id: 'Mapa claro',
            name: 'Claro (Carto)',
            thumb: 'https://carto.com/help/images/basemaps/positron_full.png'
        },
        {
            id: 'OpenStreetMap',
            name: 'Estándar (OSM)',
            thumb: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Openstreetmap_logo.svg'
        }
    ];

    container.innerHTML = '';
    container.className = 'base-maps-grid';

    baseMaps.forEach(map => {
        const card = document.createElement('div');
        card.className = 'base-map-card' + (map.id === 'Mapa claro' ? ' active' : '');
        card.innerHTML = `
            <div class="base-map-thumb" style="background-image: url('${map.thumb}')"></div>
            <div class="base-map-label">
                <span>${map.name}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            // UI
            document.querySelectorAll('.base-map-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            // Map Logic
            core.switchBaseLayer(map.id);
        });

        container.appendChild(card);
    });
}

function setupSearch() {
    const input = document.getElementById('route-search');
    if (!input) return;

    input.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('#layers-overlay-section .route-card');
        cards.forEach(card => {
            const label = card.querySelector('.route-card-name').textContent.toLowerCase();
            card.style.display = label.includes(q) ? 'block' : 'none';
        });
    });
}

function setupTripPlanner() {
    const btnOrigin = document.getElementById('btn-set-origin');
    const btnDest = document.getElementById('btn-set-dest');
    const btnClear = document.getElementById('btn-clear-planner');
    const btnGpsOrigin = document.getElementById('btn-gps-as-origin');

    if (!btnOrigin || !btnDest) return;

    /**
     * Actualiza los estados visuales de los botones del planificador.
     */
    const updateButtonStates = () => {
        // Estado del boton Punto A
        const hasA = !!core.tripPoints.origin;
        const hasB = !!core.tripPoints.destination;

        btnOrigin.className = 'btn-planner';
        if (plannerMode === 'origin') {
            btnOrigin.classList.add('active-origin');
        } else if (hasA) {
            btnOrigin.classList.add('set', 'origin');
        }

        btnDest.className = 'btn-planner';
        if (plannerMode === 'destination') {
            btnDest.classList.add('active-dest');
        } else if (hasB) {
            btnDest.classList.add('set', 'dest');
        }

        // Mostrar/ocultar boton de GPS como origen
        if (btnGpsOrigin) {
            btnGpsOrigin.style.display = userLocation ? 'flex' : 'none';
        }
    };

    /**
     * FLUJO: Click en "Punto A"
     * - Si ya hay A marcado -> limpia A (y el resultado) -> entra en modo "colocando A"
     * - Si no hay A -> entra en modo "colocando A"
     * - Si ya estabas en modo "colocando A" -> cancela el modo
     */
    btnOrigin.addEventListener('click', () => {
        if (plannerMode === 'origin') {
            // Cancelar modo
            plannerMode = null;
        } else {
            // Si ya habia un punto A, limpiarlo
            if (core.tripPoints.origin) {
                core.clearSingleTripPoint('origin');
            }
            plannerMode = 'origin';
        }
        updateButtonStates();
    });

    /**
     * FLUJO: Click en "Punto B"
     * - Si ya hay B marcado -> limpia B (y el resultado) -> entra en modo "colocando B"
     * - Si no hay B -> entra en modo "colocando B"
     * - Si ya estabas en modo "colocando B" -> cancela el modo
     */
    btnDest.addEventListener('click', () => {
        if (plannerMode === 'destination') {
            plannerMode = null;
        } else {
            if (core.tripPoints.destination) {
                core.clearSingleTripPoint('destination');
            }
            plannerMode = 'destination';
        }
        updateButtonStates();
    });

    /**
     * FLUJO: Limpiar todo
     */
    btnClear.addEventListener('click', () => {
        core.clearTripPoints();
        plannerMode = null;
        updateButtonStates();
        updateTripUI();
    });

    /**
     * FLUJO: Usar GPS como Punto A
     * - Si ya habia un punto A, lo reemplaza
     */
    if (btnGpsOrigin) {
        btnGpsOrigin.addEventListener('click', () => {
            if (!userLocation) return;
            // Limpiar punto A anterior si existe
            if (core.tripPoints.origin) {
                core.clearSingleTripPoint('origin');
            }
            core.setTripPoint('origin', userLocation);
            plannerMode = null;
            updateButtonStates();
        });
    }

    /**
     * FLUJO: Click en el mapa (solo si estamos en modo "colocando")
     * - Coloca el punto correspondiente
     * - Sale del modo
     * - Si ambos puntos estan listos, el evento 'trip:updated' dispara updateTripUI
     */
    core.map.on('click', (e) => {
        if (!plannerMode) return;

        core.setTripPoint(plannerMode, e.latlng);
        plannerMode = null;
        updateButtonStates();
    });

    /**
     * FLUJO: Cuando se actualiza un punto (set o clear)
     * - Recalcular el viaje si ambos puntos existen
     * - Limpiar el resultado si falta alguno
     */
    core.map.on('trip:updated', () => {
        updateTripUI();
        updateButtonStates();
    });

    // Estado inicial
    updateButtonStates();
}

/**
 * Maneja el colapso/expansión del panel de resumen de viaje.
 */
function setupTripSummaryToggle() {
    const btn = document.getElementById('btn-toggle-trip-summary');
    const badge = document.getElementById('trip-summary-badge');

    if (!btn || !badge) return;

    btn.addEventListener('click', (e) => {
        // Detener propagación para no activar clics en el mapa si los hay debajo
        e.stopPropagation();
        badge.classList.toggle('minimized');
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// I N I T
// ─────────────────────────────────────────────────────────────────────────────

async function initPublicGeovisor() {
    const configEl = document.getElementById('geovisor-config');
    const config = JSON.parse(configEl?.textContent || '{}');

    // Inicializar Core
    core = new MapCore('geovisor-map', {
        center: config.mapCenter || { lat: 4.3042, lng: -74.8014, zoom: 14 }
    });

    // Configurar paneles UI
    setupLayerPanelToggle();
    setupGps();
    setupSearch();
    setupBaseMapSelector();  // Nueva funcionalidad
    setupTripPlanner();
    setupTripSummaryToggle();

    // Cargar Datos
    setLoaderVisible(true, 'Cargando red de transporte...');
    routesData = await fetchRutasPublicas();
    buildRoutesList(routesData);

    // NUEVO: Cargar automáticamente todas las rutas y paraderos al inicio sans-flicker
    const allChecks = document.querySelectorAll('#layers-overlay-section .layer-check');
    if (allChecks.length > 0) {
        document.body.dataset.loadingBulk = 'true'; // Bandera para evitar múltiples loaders
        for (const check of allChecks) {
            check.click(); // Esto disparará toggleRoute programáticamente
        }
        delete document.body.dataset.loadingBulk;

        // Ajustar el mapa para ver todas las rutas cargadas
        setTimeout(() => core.fitAllOverlays(), 1000);
    }

    setLoaderVisible(false);

    // Cerrar paneles iniciales en móvil
    if (window.innerWidth <= 900) {
        document.getElementById('geovisor-layers-panel')?.classList.add('geovisor-layers-panel--hidden');
    }

    console.info('[Geovisor] Público Dinámico Listo (Restaurado).');
}

// Geovisor Mobile Ready Check
console.log('[Geovisor] Script cargado, readyState:', document.readyState);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPublicGeovisor);
} else {
    initPublicGeovisor();
}