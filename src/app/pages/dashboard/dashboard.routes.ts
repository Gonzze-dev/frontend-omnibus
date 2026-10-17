import { Routes } from '@angular/router';
import { rolesOnly } from '../../guards/role.guard';
import { Dashboard } from './dashboard';
import { Management, managementTitle } from '../management/management';
import { Cities, citiesTitle } from '../cities/cities';
import { Platforms, platformsTitle } from '../platforms/platforms';
import { Terminals, terminalsTitle } from '../terminals/terminals';
import { Permissions, permissionsTitle } from '../permissions/permissions';
import { Notices, noticesTitle } from '../notices/notices';

/** Admin panel (/dashboard/...): loaded on demand, only admins download it. */
export const DASHBOARD_ROUTES: Routes = [
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
];
