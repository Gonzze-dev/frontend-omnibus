import { Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Topbar } from '../../shared/topbar/topbar';
import { StatsService } from '../../services/stats.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

type Glifo =
  | 'ciudad'
  | 'plataforma'
  | 'terminal'
  | 'sede'
  | 'ajustes'
  | 'monitor'
  | 'permisos'
  | 'roles'
  | 'avisos';

type Tono = 'azul' | 'indigo' | 'carmin' | 'tinta' | 'naranja';

interface Metrica {
  id: string;
  etiqueta: string;
  /** null mientras carga o si el endpoint fallo. */
  valor: WritableSignal<number | null>;
  icono: Glifo;
  tono: Tono;
  cargar: () => Observable<number>;
}

interface Acceso {
  id: string;
  titulo: string;
  bajada: string;
  icono: Glifo;
  /** Icono grande y casi transparente de la esquina inferior derecha. */
  marca: Glifo;
  tono: Tono;
  /** Sus endpoints viven en /api/super: solo la ve un super admin. */
  soloSuper?: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [Topbar, NgTemplateOutlet, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly stats = inject(StatsService);
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  /**
   * Los glifos se dibujan a tamaño de icono chico (escala 1) y se
   * agrandan segun donde aparecen, como en el mockup.
   */
  protected readonly escala = { metrica: 1, acceso: 4 / 3, marca: 10 / 3 };

  /** Cada metrica se pide por separado: si un conteo falla, los demas se siguen viendo. */
  protected readonly metricas: readonly Metrica[] = [
    {
      id: 'ciudades',
      etiqueta: 'Total de ciudades',
      valor: signal<number | null>(null),
      icono: 'ciudad',
      tono: 'azul',
      cargar: () => this.stats.totalCiudades(),
    },
    {
      id: 'plataformas',
      etiqueta: 'Total de plataformas',
      valor: signal<number | null>(null),
      icono: 'plataforma',
      tono: 'indigo',
      cargar: () => this.stats.totalPlataformas(),
    },
    {
      id: 'terminales',
      etiqueta: 'Total de terminales',
      valor: signal<number | null>(null),
      icono: 'terminal',
      tono: 'carmin',
      cargar: () => this.stats.totalTerminales(),
    },
  ];

  /**
   * Cada acceso resume un grupo de endpoints de administracion. El id
   * es el de la seccion en pages/gestion/gestiones.ts: la card linkea
   * a /dashboard/<id>.
   * "Gestionar notificaciones" no esta en el mockup: cubre los
   * endpoints de avisos y retrasos, que no tenian card.
   */
  protected readonly accesos: readonly Acceso[] = [
    { id: 'ciudades', titulo: 'Gestionar Ciudades', bajada: 'Mapa y sedes', icono: 'sede', marca: 'ciudad', tono: 'azul' },
    { id: 'plataformas', titulo: 'Gestionar Plataformas', bajada: 'Sistemas base', icono: 'ajustes', marca: 'plataforma', tono: 'indigo' },
    { id: 'terminales', titulo: 'Gestionar terminales', bajada: 'Sistema base', icono: 'monitor', marca: 'terminal', tono: 'carmin', soloSuper: true },
    { id: 'permisos', titulo: 'Control de Permisos', bajada: 'Roles', icono: 'permisos', marca: 'roles', tono: 'tinta' },
    { id: 'notificaciones', titulo: 'Gestionar notificaciones', bajada: 'Avisos y retrasos', icono: 'avisos', marca: 'avisos', tono: 'naranja' },
  ];

  /** Se recalcula solo cuando /users/me trae un rol distinto. */
  protected readonly accesosVisibles = computed(() =>
    this.accesos.filter((a) => !a.soloSuper || this.auth.esSuper()),
  );

  private readonly numero = new Intl.NumberFormat('es-AR');

  ngOnInit(): void {
    this.sincronizarPermisos();

    for (const m of this.metricas) {
      m.cargar().subscribe({
        next: (total) => m.valor.set(total),
        error: () => m.valor.set(null),
      });
    }
  }

  /**
   * El rol guardado puede estar viejo (lo cambio otro admin mientras la
   * sesion seguia abierta): se pide el perfil cada vez que se entra. Si ya
   * no es administrador, sale del dashboard.
   */
  private sincronizarPermisos(): void {
    this.userService.obtenerPerfil().subscribe({
      next: () => {
        if (!this.auth.tieneRol('admin', 'super_admin')) {
          this.router.navigateByUrl(this.auth.rutaInicio());
        }
      },
      error: () => {},
    });
  }

  protected formatear(valor: number | null): string {
    return valor === null ? '—' : this.numero.format(valor);
  }
}
