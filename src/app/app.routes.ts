import { Routes } from '@angular/router';
import { soloAutenticados, soloInvitados } from './guards/auth.guard';
import { soloRoles } from './guards/rol.guard';
import { Login } from './pages/login/login';
import { Registro } from './pages/registro/registro';
import { OlvidarContrasena } from './pages/olvidar-contrasena/olvidar-contrasena';
import { NuevaContrasena } from './pages/nueva-contrasena/nueva-contrasena';
import { Home } from './pages/home/home';
import { Notificaciones } from './pages/notificaciones/notificaciones';
import { Perfil } from './pages/perfil/perfil';
import { Dashboard } from './pages/dashboard/dashboard';
import { Gestion, tituloGestion } from './pages/gestion/gestion';
import { Ciudades, tituloCiudades } from './pages/ciudades/ciudades';
import { Plataformas, tituloPlataformas } from './pages/plataformas/plataformas';
import { Terminales, tituloTerminales } from './pages/terminales/terminales';
import { Permisos, tituloPermisos } from './pages/permisos/permisos';
import { Avisos, tituloAvisos } from './pages/avisos/avisos';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: Login, title: 'Iniciar Sesion', canMatch: [soloInvitados] },
  { path: 'registro', component: Registro, title: 'Create una cuenta', canMatch: [soloInvitados] },
  { path: 'olvidar-contrasena', component: OlvidarContrasena, title: 'Olvidaste tu contraseña?' },
  // La ruta la arma el backend en el mail (FRONT_END_BASE_LINK + /reset-password?token=...)
  { path: 'reset-password', component: NuevaContrasena, title: 'Nueva contraseña' },
  { path: 'home', component: Home, title: 'Rastrea tu viaje', canMatch: [soloAutenticados] },
  {
    path: 'notificaciones',
    component: Notificaciones,
    title: 'Notificaciones',
    canMatch: [soloAutenticados],
  },
  {
    path: 'perfil',
    component: Perfil,
    title: 'Informacion sobre tu perfil',
    canMatch: [soloAutenticados],
  },
  {
    path: 'dashboard',
    canMatch: [soloAutenticados, soloRoles('admin', 'super_admin')],
    children: [
      { path: '', component: Dashboard, title: 'Dashboard' },
      // El ABM de ciudades es solo de super_admin: un admin no ve la card ni puede entrar por URL.
      {
        path: 'ciudades',
        canMatch: [soloRoles('super_admin')],
        children: [
          { path: '', pathMatch: 'full', component: Ciudades, title: tituloCiudades },
          { path: 'listar', redirectTo: '' },
          { path: ':accion/:codigo', component: Ciudades, title: tituloCiudades },
          { path: ':accion', component: Ciudades, title: tituloCiudades },
        ],
      },
      { path: 'plataformas', component: Plataformas, title: tituloPlataformas },
      { path: 'plataformas/listar', redirectTo: 'plataformas' },
      { path: 'plataformas/:accion/:codigo', component: Plataformas, title: tituloPlataformas },
      { path: 'plataformas/:accion', component: Plataformas, title: tituloPlataformas },
      // Los endpoints viven en /api/super: un admin no ve la card ni puede entrar por URL.
      {
        path: 'terminales',
        canMatch: [soloRoles('super_admin')],
        children: [
          { path: '', pathMatch: 'full', component: Terminales, title: tituloTerminales },
          { path: 'listar', redirectTo: '' },
          { path: ':accion/:codigo', component: Terminales, title: tituloTerminales },
          { path: ':accion', component: Terminales, title: tituloTerminales },
        ],
      },
      { path: 'permisos', component: Permisos, title: tituloPermisos },
      { path: 'permisos/:accion', redirectTo: 'permisos' },
      { path: 'notificaciones/retraso', redirectTo: 'notificaciones/aviso' },
      { path: 'notificaciones', component: Avisos, title: tituloAvisos },
      { path: 'notificaciones/listar', redirectTo: 'notificaciones' },
      { path: 'notificaciones/:accion/:codigo', component: Avisos, title: tituloAvisos },
      { path: 'notificaciones/:accion', component: Avisos, title: tituloAvisos },
      { path: ':seccion', component: Gestion, title: tituloGestion },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
