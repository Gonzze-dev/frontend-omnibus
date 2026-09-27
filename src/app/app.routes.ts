import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Registro } from './pages/registro/registro';
import { OlvidarContrasena } from './pages/olvidar-contrasena/olvidar-contrasena';
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
  { path: 'login', component: Login, title: 'Iniciar Sesion' },
  { path: 'registro', component: Registro, title: 'Create una cuenta' },
  { path: 'olvidar-contrasena', component: OlvidarContrasena, title: 'Olvidaste tu contraseña?' },
  { path: 'home', component: Home, title: 'Rastrea tu viaje' },
  { path: 'notificaciones', component: Notificaciones, title: 'Notificaciones' },
  { path: 'perfil', component: Perfil, title: 'Informacion sobre tu perfil' },
  { path: 'dashboard', component: Dashboard, title: 'Dashboard' },
  { path: 'dashboard/ciudades/:accion', component: Ciudades, title: tituloCiudades },
  { path: 'dashboard/plataformas/:accion', component: Plataformas, title: tituloPlataformas },
  { path: 'dashboard/terminales/:accion', component: Terminales, title: tituloTerminales },
  { path: 'dashboard/permisos/:accion', component: Permisos, title: tituloPermisos },
  { path: 'dashboard/notificaciones/:accion', component: Avisos, title: tituloAvisos },
  { path: 'dashboard/:seccion', component: Gestion, title: tituloGestion },
  { path: '**', redirectTo: 'login' },
];
