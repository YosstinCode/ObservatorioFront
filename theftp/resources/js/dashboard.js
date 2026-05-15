// |--------------------------------------------------------------------------
// | Lógica del Layout del Dashboard (Versión 2.0)
// |--------------------------------------------------------------------------

import '../css/dashboard.css';

// --- Funciones de Utilidad (Mantenidas de tu versión) ---
function clearAuthStorage() {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_name');
    sessionStorage.removeItem('user_role_id');
    sessionStorage.removeItem('user_role_desc');
}
function forceLogout(message) {
    alert(message);
    clearAuthStorage();
    window.location.href = '/login';
}
function redirectToHome(message) {
    alert(message);
    window.location.href = '/';
}

// --- GUARDIÁN DE SEGURIDAD (Mantenido de tu versión) ---
(function () {
    console.log("Ejecutando Guardián de Seguridad del Dashboard...");

    // Ya no existe auth_token en LocalStorage (Sanctum HttpOnly), así que solo evaluamos el rol.
    // La seguridad real está garantizada en las llamadas a la API (401 Expirado).
    const roleIdStr = sessionStorage.getItem('user_role_id');
    const roleDesc = sessionStorage.getItem('user_role_desc') || "Invitado";
    const currentPath = window.location.pathname;

    if (!roleIdStr) {
        forceLogout('Sesión no válida o expirada. Por favor, inicia sesión.');
        return;
    }
    const roleId = parseInt(roleIdStr, 10);
    if (roleId === 5) {
        redirectToHome(`Tu rol de "${roleDesc}" no tiene acceso a los paneles de control.`);
        return;
    }
    const rolePaths = {
        '/dashboard/admin': [1, 6],
        '/dashboard/secretaria': [1, 6, 2, 7],
        '/dashboard/empresa': [1, 6, 3, 8],
        '/dashboard/upc': [1, 6, 4, 9]
    };
    let isAuthorized = false;
    for (const path in rolePaths) {
        if (currentPath.startsWith(path)) {
            if (rolePaths[path].includes(roleId)) {
                isAuthorized = true;
            }
            break;
        }
    }
    if (!isAuthorized) {
        redirectToHome(`Tu rol (${roleDesc}) no tiene permisos para acceder a esta página.`);
        return;
    }

    // ¡AUTORIZADO! Muestra el layout
    console.log(`Acceso concedido para el rol: ${roleDesc}. Mostrando panel.`);
    const layoutWrapper = document.getElementById('dashboard-layout-wrapper');
    if (layoutWrapper) {
        layoutWrapper.style.visibility = 'visible';
    }
})();


// --- LÓGICA DE INTERACTIVIDAD DEL LAYOUT (¡NUEVO!) ---
(function () {

    /**
     * Lógica para el menú lateral responsive (móvil)
     */
    function initMobileMenu() {
        const menuToggleBtn = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('dashboard-sidebar');
        const overlay = document.getElementById('dashboard-overlay');

        if (!menuToggleBtn || !sidebar || !overlay) {
            console.warn("Elementos del menú móvil no encontrados.");
            return;
        }

        const toggleMenu = (isOpen) => {
            sidebar.classList.toggle('is-open', isOpen);
            overlay.classList.toggle('is-active', isOpen);
        };
        menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu(!sidebar.classList.contains('is-open'));
        });
        overlay.addEventListener('click', () => {
            toggleMenu(false);
        });
    }

    /**
     * Lógica para el menú de usuario (arriba a la derecha)
     */
    function initUserDropdown() {
        const userMenuToggle = document.getElementById('user-menu-toggle');
        const userDropdown = document.getElementById('user-dropdown');

        if (!userMenuToggle || !userDropdown) {
            console.warn("Elementos del menú de usuario no encontrados.");
            return;
        }

        userMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('is-active');
        });
        document.addEventListener('click', (e) => {
            if (!userMenuToggle.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('is-active');
            }
        });
    }

    /**
     * Carga los datos del usuario desde sessionStorage en el header
     */
    function populateUserData() {
        const userNameEl = document.getElementById('user-name-display');
        const userAvatarEl = document.getElementById('user-avatar');
        const userRoleEl = document.getElementById('user-role-display');

        const userName = sessionStorage.getItem('user_name') || 'Usuario';
        const userRole = sessionStorage.getItem('user_role_desc') || 'Invitado';

        if (userNameEl) {
            userNameEl.textContent = userName;
        }
        if (userAvatarEl) {
            userAvatarEl.textContent = userName.charAt(0).toUpperCase();
        }
        if (userRoleEl) {
            userRoleEl.innerHTML = `
                <span class="dropdown-header-name">${userName}</span>
                <span>${userRole}</span>
            `;
        }
    }

    /**
     * Lógica de navegación por Pestañas (Mantenida de tu versión)
     */
    function initTabNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const views = document.querySelectorAll('.dashboard-view');
        const headerTitle = document.getElementById('header-title');

        if (!navLinks.length || !views.length) {
            return;
        }

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const viewName = link.getAttribute('data-view');

                if (headerTitle) {
                    const span = link.querySelector('span');
                    if (span) headerTitle.textContent = span.textContent;
                }

                views.forEach(view => {
                    view.style.display = 'none';
                });

                const activeView = document.getElementById(`view-${viewName}`);
                if (activeView) {
                    activeView.style.display = 'block';
                }

                navLinks.forEach(navLink => {
                    navLink.classList.remove('is-active');
                });
                link.classList.add('is-active');

                // Cierra el menú móvil si se hace clic en un enlace
                const sidebar = document.getElementById('dashboard-sidebar');
                const overlay = document.getElementById('dashboard-overlay');
                if (sidebar && sidebar.classList.contains('is-open')) {
                    sidebar.classList.remove('is-open');
                    overlay.classList.remove('is-active');
                }

                window.location.hash = viewName;
            });
        });

        // Cargar vista desde el Hash (Mantenido de tu versión)
        if (window.location.hash) {
            const hashView = window.location.hash.substring(1);
            const linkToClick = document.querySelector(`.nav-link[data-view="${hashView}"]`);
            if (linkToClick) {
                linkToClick.click();
            }
        } else {
            const firstLink = document.querySelector('.nav-link');
            if (firstLink) {
                firstLink.click();
            }
        }
    }

    // --- Ejecutar todo cuando el DOM esté listo ---
    document.addEventListener('DOMContentLoaded', () => {
        // Lógica de layout
        initMobileMenu();
        initUserDropdown();
        populateUserData();

        // Lógica de navegación del panel
        initTabNavigation();

        // Configurar el botón "Volver al Inicio" según el rol
        const btnVolverInicio = document.getElementById('btn-volver-inicio');
        if (btnVolverInicio) {
            btnVolverInicio.addEventListener('click', (e) => {
                e.preventDefault();
                const roleId = parseInt(sessionStorage.getItem('user_role_id'), 10);

                // Mapeo de roles a sus landing pages
                const landingPages = {
                    1: '/#admin',           // Admin
                    2: '/#secretaria',      // Secretaría
                    3: '/#empresa',         // Empresa
                    4: '/#upc',             // UPC
                    5: '/',                 // Invitado (landing general)
                    6: '/#admin',           // Admin secundario
                    7: '/#secretaria',      // Secretaría secundaria
                    8: '/#empresa',         // Empresa secundaria
                    9: '/#upc'              // UPC secundaria
                };

                const targetUrl = landingPages[roleId] || '/';
                window.location.href = targetUrl;
            });
        }

        // NOTA: El botón '.btn-logout' es manejado por 'app.js'
        // que se carga en la misma plantilla.
    });

})();
