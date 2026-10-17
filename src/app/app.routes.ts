import { Routes } from '@angular/router';
import { authenticatedOnly, guestsOnly } from './guards/auth.guard';
import { rolesOnly } from './guards/role.guard';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { ForgotPassword } from './pages/forgot-password/forgot-password';

/**
 * Only the guest screens (prerendered, see app.routes.server.ts) go in the
 * initial bundle. The rest is loaded on demand: a visitor on /login does not
 * download the admin panel, the map (Leaflet) or SignalR.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: Login, title: 'Iniciar sesión', canMatch: [guestsOnly] },
  { path: 'register', component: Register, title: 'Creá una cuenta', canMatch: [guestsOnly] },
  {
    path: 'forgot-password',
    component: ForgotPassword,
    title: '¿Olvidaste tu contraseña?',
    canMatch: [guestsOnly],
  },
  // The backend builds this route in the email (FRONT_END_BASE_LINK + /reset-password?token=...)
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
    title: 'Nueva contraseña',
  },
  {
    path: 'home',
    // Leaflet touches `document` as soon as it is imported: it must stay out of
    // the prerendered bundle.
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    title: 'Rastreá tu viaje',
    canMatch: [authenticatedOnly],
  },
  {
    path: 'notifications',
    loadComponent: () => import('./pages/notifications/notifications').then((m) => m.Notifications),
    title: 'Notificaciones',
    canMatch: [authenticatedOnly],
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
    title: 'Información sobre tu perfil',
    canMatch: [authenticatedOnly],
  },
  {
    path: 'dashboard',
    canMatch: [authenticatedOnly, rolesOnly('admin', 'super_admin')],
    loadChildren: () => import('./pages/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  { path: '**', redirectTo: 'login' },
];
