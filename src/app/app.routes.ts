import { Routes } from '@angular/router';
import { authenticatedOnly, guestsOnly } from './guards/auth.guard';
import { rolesOnly } from './guards/role.guard';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { ResetPassword } from './pages/reset-password/reset-password';
import { Home } from './pages/home/home';
import { Notifications } from './pages/notifications/notifications';
import { Profile } from './pages/profile/profile';
import { Dashboard } from './pages/dashboard/dashboard';
import { Management, managementTitle } from './pages/management/management';
import { Cities, citiesTitle } from './pages/cities/cities';
import { Platforms, platformsTitle } from './pages/platforms/platforms';
import { Terminals, terminalsTitle } from './pages/terminals/terminals';
import { Permissions, permissionsTitle } from './pages/permissions/permissions';
import { Notices, noticesTitle } from './pages/notices/notices';

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
  { path: 'reset-password', component: ResetPassword, title: 'Nueva contraseña' },
  { path: 'home', component: Home, title: 'Rastreá tu viaje', canMatch: [authenticatedOnly] },
  {
    path: 'notifications',
    component: Notifications,
    title: 'Notificaciones',
    canMatch: [authenticatedOnly],
  },
  {
    path: 'profile',
    component: Profile,
    title: 'Información sobre tu perfil',
    canMatch: [authenticatedOnly],
  },
  {
    path: 'dashboard',
    canMatch: [authenticatedOnly, rolesOnly('admin', 'super_admin')],
    children: [
      { path: '', component: Dashboard, title: 'Dashboard' },
      // Cities CRUD is super_admin only: an admin does not see the card nor can enter by URL.
      {
        path: 'cities',
        canMatch: [rolesOnly('super_admin')],
        children: [
          { path: '', pathMatch: 'full', component: Cities, title: citiesTitle },
          { path: 'list', redirectTo: '' },
          { path: ':action/:code', component: Cities, title: citiesTitle },
          { path: ':action', component: Cities, title: citiesTitle },
        ],
      },
      { path: 'platforms', component: Platforms, title: platformsTitle },
      { path: 'platforms/list', redirectTo: 'platforms' },
      { path: 'platforms/:action/:code', component: Platforms, title: platformsTitle },
      { path: 'platforms/:action', component: Platforms, title: platformsTitle },
      // The endpoints live in /api/super: an admin does not see the card nor can enter by URL.
      {
        path: 'terminals',
        canMatch: [rolesOnly('super_admin')],
        children: [
          { path: '', pathMatch: 'full', component: Terminals, title: terminalsTitle },
          { path: 'list', redirectTo: '' },
          { path: ':action/:code', component: Terminals, title: terminalsTitle },
          { path: ':action', component: Terminals, title: terminalsTitle },
        ],
      },
      { path: 'permissions', component: Permissions, title: permissionsTitle },
      { path: 'permissions/:action', redirectTo: 'permissions' },
      { path: 'notifications/delay', redirectTo: 'notifications/send' },
      { path: 'notifications', component: Notices, title: noticesTitle },
      { path: 'notifications/list', redirectTo: 'notifications' },
      { path: 'notifications/:action/:code', component: Notices, title: noticesTitle },
      { path: 'notifications/:action', component: Notices, title: noticesTitle },
      { path: ':section', component: Management, title: managementTitle },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
