// app.js — Entry point
// Importa todos los módulos de la aplicación pública en orden de dependencia.
// Los módulos de autenticación usan imports ES nativos (sin window) ya que
// app.js ya era un módulo ES de Vite (usaba import Swiper from 'swiper').
//
// ORDEN IMPORTANTE:
//   1. app-logout.js debe ir ANTES que app-ui.js porque expone
//      startInactivityTracker() en window, que app-ui.js invoca al montar la UI.

import './modules/app/app-auth-utils.js'; // clearErrors, showValidationError, clearAuthStorage (shared)
import './modules/app/app-permissions.js'; // hasPermission, canUpdate, canDelete (shared)
import './modules/app/app-logout.js';     // handleLogout, startInactivityTracker (expuesta en window)
import './modules/app/app-ui.js';         // Swiper, reloj, menú móvil, control UI por sesión
import './modules/app/app-register.js';   // Formulario de registro + validaciones client-side
import './modules/app/app-login.js';      // Formulario de login + flujo OAuth (login → /me → /rol)
import './modules/app/app-forgot-password.js'; // Flujo de recuperación de contraseña en 2 pasos
import '../css/app.css';
