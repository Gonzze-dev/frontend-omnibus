import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable, map } from 'rxjs';
import { Topbar } from '../../shared/topbar/topbar';
import { Toast } from '../../shared/toast/toast';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TerminalService } from '../../services/terminal.service';
import { UsuarioService } from '../../services/usuario.service';
import { TerminalAsignada, UsuarioListado } from '../../models/usuario.model';

/** Filas que entran en una pagina del listado de usuarios. */
const POR_PAGINA = 10;

/**
 * Control de permisos: listado paginado de usuarios desde donde se
 * busca una cuenta y se le sube o baja el rol (admin o super admin).
 */
@Component({
  selector: 'app-permisos',
  imports: [Topbar, RouterLink, Toast],
  templateUrl: './permisos.html',
  styleUrl: './permisos.scss',
})
export class Permisos {
  // --- Listado de usuarios ---
  // A diferencia de ciudades, el paginado y la busqueda los hace el
  // backend: cada cambio de pagina o busqueda es un pedido nuevo.
  private readonly usuarioService = inject(UsuarioService);

  /** Lo que esta escrito en el buscador, todavia sin aplicar. */
  protected readonly textoBusqueda = signal('');
  /** Busqueda aplicada con el boton: la que se manda al backend. */
  private readonly busqueda = signal('');

  protected readonly pagina = signal(1);
  /** Se incrementa para volver a pedir la pagina actual (despues de un cambio de rol). */
  private readonly recarga = signal(0);
  protected readonly totalElementos = signal(0);
  protected readonly usuarios = signal<UsuarioListado[]>([]);
  protected readonly cargandoListado = signal(false);
  protected readonly errorListado = signal<string | null>(null);

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.totalElementos() / POR_PAGINA)),
  );

  protected readonly paginas = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => i + 1),
  );

  /** Filas en blanco que completan la pagina, para que la tabla no cambie de alto. */
  protected readonly relleno = computed(() =>
    Array.from({ length: Math.max(0, POR_PAGINA - (this.usuarios().length || 1)) }),
  );

  constructor() {
    effect(() => {
      this.recarga();
      this.cargarUsuarios(this.pagina(), this.busqueda());
    });

    // El - del detalle depende de las terminales propias del admin: se
    // refresca el perfil porque la sesion guardada puede estar vieja.
    if (this.auth.user()?.rol === 'admin') {
      this.userService.obtenerPerfil().subscribe({ error: () => {} });
    }

    // El <dialog> nativo se abre con showModal() para tener fondo, foco
    // atrapado y cierre con Escape sin escribirlos a mano.
    effect(() => {
      const dialogo = this.dialogo()?.nativeElement;
      if (!dialogo) return;
      if (this.objetivo() && !dialogo.open) dialogo.showModal();
      if (!this.objetivo() && dialogo.open) dialogo.close();
    });
  }

  private cargarUsuarios(pagina: number, busqueda: string): void {
    this.cargandoListado.set(true);
    this.errorListado.set(null);
    this.abierto.set(null);

    this.usuarioService
      .listar({ page: pagina, limit: POR_PAGINA, order: 'ASC', search: busqueda })
      .subscribe({
        next: (res) => {
          this.usuarios.set(res.users);
          this.totalElementos.set(res.total_elements);
          this.cargandoListado.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.usuarios.set([]);
          this.totalElementos.set(0);
          this.cargandoListado.set(false);
          this.errorListado.set(mensajeErrorListado(err));
        },
      });
  }

  protected buscar(): void {
    this.busqueda.set(this.textoBusqueda().trim());
    this.pagina.set(1);
  }

  protected irA(pagina: number): void {
    this.pagina.set(Math.min(Math.max(pagina, 1), this.totalPaginas()));
  }

  /** Usuario con el detalle de terminales abierto. Uno a la vez. */
  protected readonly abierto = signal<string | null>(null);

  protected esAdmin(u: UsuarioListado): boolean {
    return u.rol === 'admin';
  }

  /** Volver a tocar el usuario abierto lo cierra. */
  protected desplegar(uuid: string): void {
    this.abierto.update((actual) => (actual === uuid ? null : uuid));
  }

  // --- Popup de promocion ---
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly terminalService = inject(TerminalService);

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');

  protected readonly soySuper = computed(() => this.auth.user()?.rol === 'super_admin');

  /** Usuario al que se le esta cambiando el rol. null = popup cerrado. */
  protected readonly objetivo = signal<UsuarioListado | null>(null);
  /**
   * El mismo popup sirve para subir el rol (+), bajar a un super admin (-)
   * o sacarle una terminal a un admin (- en el detalle).
   */
  protected readonly modo = signal<'promover' | 'degradar' | 'quitar-terminal'>('promover');
  /** Terminal que se le saca al admin en el modo 'quitar-terminal'. */
  protected readonly terminalAQuitar = signal<TerminalAsignada | null>(null);
  /** El super admin primero elige el rol; el admin va directo a la terminal. */
  protected readonly paso = signal<'rol' | 'terminal'>('terminal');

  /** Terminales que quien esta logueado puede dar: todas si es super, las propias si es admin. */
  private readonly terminalesDisponibles = signal<TerminalAsignada[]>([]);
  protected readonly cargandoTerminales = signal(false);
  protected readonly terminalElegida = signal<string | null>(null);

  /** No se ofrecen las terminales que el usuario ya tiene a cargo. */
  protected readonly terminalesOfrecidas = computed(() => {
    const yaTiene = new Set(this.objetivo()?.terminals.map((t) => t.uuid) ?? []);
    return this.terminalesDisponibles().filter((t) => !yaTiene.has(t.uuid));
  });

  // --- Selector de terminal con busqueda ---
  /** Lo escrito en el selector. Al elegir una terminal pasa a ser su nombre. */
  protected readonly textoTerminal = signal('');
  protected readonly listaTerminalesAbierta = signal(false);
  /** Opcion resaltada con las flechas del teclado. */
  protected readonly resaltada = signal(0);

  protected readonly terminalesFiltradas = computed(() => {
    const texto = normalizar(this.textoTerminal());
    const elegida = this.terminalElegida();
    const ofrecidas = this.terminalesOfrecidas();
    // Con una ya elegida se muestran todas, para poder cambiarla sin borrar el texto.
    if (!texto || elegida) return ofrecidas;
    return ofrecidas.filter((t) => normalizar(t.name).includes(texto));
  });

  protected escribirTerminal(texto: string): void {
    this.textoTerminal.set(texto);
    this.terminalElegida.set(null);
    this.resaltada.set(0);
    this.listaTerminalesAbierta.set(true);
  }

  protected elegirTerminal(t: TerminalAsignada): void {
    this.terminalElegida.set(t.uuid);
    this.textoTerminal.set(t.name);
    this.listaTerminalesAbierta.set(false);
  }

  protected teclaTerminal(event: KeyboardEvent): void {
    const opciones = this.terminalesFiltradas();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.listaTerminalesAbierta()) return this.listaTerminalesAbierta.set(true);
        this.resaltada.update((i) => Math.min(i + 1, opciones.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.resaltada.update((i) => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        const t = opciones[this.resaltada()];
        if (this.listaTerminalesAbierta() && t) {
          event.preventDefault();
          this.elegirTerminal(t);
        }
        break;
      }
      case 'Escape':
        // Con la lista abierta, Escape cierra la lista y no el popup.
        if (this.listaTerminalesAbierta()) {
          event.preventDefault();
          event.stopPropagation();
          this.listaTerminalesAbierta.set(false);
        }
        break;
    }
  }

  protected readonly promoviendo = signal(false);
  protected readonly errorPromocion = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  /**
   * El + aparece en las cuentas a las que se les puede subir el rol:
   * nunca en la propia ni en un super admin, que ya es el rol mas alto.
   */
  protected puedePromover(u: UsuarioListado): boolean {
    return u.rol !== 'super_admin' && u.uuid !== this.auth.user()?.uuid;
  }

  /** El - solo lo ve un super admin, sobre otro super admin (nunca sobre si mismo). */
  protected puedeDegradar(u: UsuarioListado): boolean {
    return this.soySuper() && u.rol === 'super_admin' && u.uuid !== this.auth.user()?.uuid;
  }

  protected abrirDegradacion(u: UsuarioListado): void {
    this.objetivo.set(u);
    this.modo.set('degradar');
    this.errorPromocion.set(null);
  }

  protected degradarSuper(): void {
    const u = this.objetivo();
    if (!u) return;
    this.ejecutarPromocion(
      this.usuarioService.degradarSuper(u.email),
      `${u.first_name} ${u.last_name} ahora es usuario`,
    );
  }

  /**
   * El - del detalle: un super admin lo ve en cualquier terminal; un admin,
   * solo en las que el tambien tiene a cargo. Nunca sobre la propia cuenta.
   */
  protected puedeQuitarTerminal(u: UsuarioListado, t: TerminalAsignada): boolean {
    if (u.uuid === this.auth.user()?.uuid) return false;
    if (this.soySuper()) return true;
    return this.auth.user()?.terminals?.some((propia) => propia.uuid === t.uuid) ?? false;
  }

  protected abrirQuitarTerminal(u: UsuarioListado, t: TerminalAsignada): void {
    this.objetivo.set(u);
    this.terminalAQuitar.set(t);
    this.modo.set('quitar-terminal');
    this.errorPromocion.set(null);
  }

  protected quitarTerminal(): void {
    const u = this.objetivo();
    const t = this.terminalAQuitar();
    if (!u || !t) return;
    const ultima = u.terminals.length <= 1;
    this.ejecutarPromocion(
      this.usuarioService.degradarAdmin(u.email, t.uuid),
      ultima
        ? `${u.first_name} ${u.last_name} ahora es usuario`
        : `${u.first_name} ${u.last_name} ya no esta a cargo de ${t.name}`,
    );
  }

  protected abrirPromocion(u: UsuarioListado): void {
    this.objetivo.set(u);
    this.modo.set('promover');
    this.paso.set(this.soySuper() ? 'rol' : 'terminal');
    this.terminalElegida.set(null);
    this.errorPromocion.set(null);
    if (!this.soySuper()) this.cargarTerminales();
  }

  protected cerrarPromocion(): void {
    if (this.promoviendo()) return;
    this.objetivo.set(null);
  }

  /**
   * Un click en el fondo (el propio <dialog>, fuera del contenido) lo cierra.
   * No devuelve nada a proposito: si el handler devolviera false, Angular
   * haria preventDefault y los radios de adentro no se podrian marcar.
   */
  protected clickEnPopup(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cerrarPromocion();
  }

  /** Paso del super admin: admin lleva a elegir la terminal. */
  protected elegirAdmin(): void {
    this.paso.set('terminal');
    this.errorPromocion.set(null);
    this.cargarTerminales();
  }

  protected volverARol(): void {
    this.paso.set('rol');
    this.errorPromocion.set(null);
  }

  private cargarTerminales(): void {
    this.cargandoTerminales.set(true);
    this.terminalElegida.set(null);
    this.textoTerminal.set('');
    this.listaTerminalesAbierta.set(false);

    // El admin solo puede dar sus terminales: las trae del perfil, que es
    // la fuente actualizada (la sesion guardada puede estar vieja).
    const terminales$: Observable<TerminalAsignada[]> = this.soySuper()
      ? this.terminalService.listarPublicas().pipe(map((ts) => ts.map((t) => ({ uuid: t.uuid, name: t.name }))))
      : this.userService.obtenerPerfil().pipe(map((u) => u.terminals ?? []));

    terminales$.subscribe({
      next: (terminales) => {
        this.terminalesDisponibles.set(terminales);
        this.cargandoTerminales.set(false);
        // Con una sola opcion no hace falta hacerla elegir.
        const ofrecidas = this.terminalesOfrecidas();
        if (ofrecidas.length === 1) this.elegirTerminal(ofrecidas[0]);
      },
      error: (err: HttpErrorResponse) => {
        this.terminalesDisponibles.set([]);
        this.cargandoTerminales.set(false);
        this.errorPromocion.set(mensajeErrorPromocion(err));
      },
    });
  }

  protected promoverSuper(): void {
    const u = this.objetivo();
    if (!u) return;
    this.ejecutarPromocion(
      this.usuarioService.promoverSuper(u.email),
      `${u.first_name} ${u.last_name} ahora es super admin`,
    );
  }

  protected promoverAdmin(): void {
    const u = this.objetivo();
    const terminal = this.terminalElegida();
    if (!u || !terminal) return;
    this.ejecutarPromocion(
      this.usuarioService.promoverAdmin(u.email, terminal),
      `${u.first_name} ${u.last_name} ahora es admin`,
    );
  }

  private ejecutarPromocion(pedido: Observable<unknown>, mensajeExito: string): void {
    this.promoviendo.set(true);
    this.errorPromocion.set(null);

    pedido.subscribe({
      next: () => {
        this.promoviendo.set(false);
        this.objetivo.set(null);
        this.exito.set(mensajeExito);
        this.recarga.update((n) => n + 1);
      },
      error: (err: HttpErrorResponse) => {
        this.promoviendo.set(false);
        this.errorPromocion.set(mensajeErrorPromocion(err));
      },
    });
  }
}

/** Para buscar sin importar mayusculas ni tildes ("gualeguaychu" encuentra "Gualeguaychú"). */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function mensajeErrorListado(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 401:
    case 403:
      return 'No tenes permisos para ver el listado de usuarios.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}

function mensajeErrorPromocion(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 403:
      return 'No tenes permisos sobre esa terminal.';
    case 404:
      return 'No se encontro el usuario o la terminal.';
    case 409:
      return 'La cuenta ya tiene ese rol.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}

export const tituloPermisos = 'Control de Permisos';
