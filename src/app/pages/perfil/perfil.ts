import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Topbar } from '../../shared/topbar/topbar';
import { PasswordToggle } from '../../shared/password-toggle/password-toggle';
import { Toast } from '../../shared/toast/toast';
import { UserService } from '../../services/user.service';
import { UpdateProfileRequest, User } from '../../models/auth.model';

type Campo = 'nombre' | 'apellido' | 'email' | 'password' | 'confirmar';

@Component({
  selector: 'app-perfil',
  imports: [Topbar, PasswordToggle, Toast, ReactiveFormsModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class Perfil implements OnInit {
  private readonly userService = inject(UserService);

  /** La contraseña es opcional: vacia significa "no cambiarla". */
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.minLength(8)],
      confirmar: [''],
    },
    { validators: contrasenasIguales },
  );

  /** Ultimos datos confirmados por el backend, para mandar solo lo que cambio. */
  private perfil: User | null = null;

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarExito = signal(false);

  protected readonly confirmandoBaja = signal(false);
  protected readonly eliminando = signal(false);
  protected readonly errorEliminar = signal<string | null>(null);

  protected readonly mostrarPassword = signal(false);
  protected readonly mostrarConfirmar = signal(false);

  ngOnInit(): void {
    this.cargarPerfil();
  }

  protected cargarPerfil(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);

    this.userService.obtenerPerfil().subscribe({
      next: (user) => {
        this.cargarFormulario(user);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.errorCarga.set(
          err.status === 0
            ? 'No se pudo conectar con el servidor. Intenta mas tarde.'
            : 'No se pudo cargar tu perfil. Intenta de nuevo.',
        );
      },
    });
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const cambios = this.cambios();
    if (!Object.keys(cambios).length) {
      this.error.set('No hay cambios para guardar.');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    this.userService.actualizarPerfil(cambios).subscribe({
      next: (user) => {
        this.guardando.set(false);
        this.cargarFormulario(user);
        this.mostrarExito.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }

  protected eliminarCuenta(): void {
    this.eliminando.set(true);
    this.errorEliminar.set(null);

    // Si sale bien el servicio limpia la sesion y manda al login
    this.userService.eliminarCuenta().subscribe({
      error: (err: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.errorEliminar.set(
          err.status === 0
            ? 'No se pudo conectar con el servidor. Intenta mas tarde.'
            : 'No se pudo eliminar la cuenta. Intenta de nuevo.',
        );
      },
    });
  }

  protected cancelarBaja(): void {
    this.confirmandoBaja.set(false);
    this.errorEliminar.set(null);
  }

  protected invalido(campo: Campo): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }

  protected noCoinciden(): boolean {
    return this.form.hasError('noCoinciden') && this.form.controls.confirmar.touched;
  }

  private cargarFormulario(user: User): void {
    this.perfil = user;
    this.form.reset({
      nombre: user.first_name,
      apellido: user.last_name,
      email: user.email,
      password: '',
      confirmar: '',
    });
  }

  /** Arma el patch con los campos que difieren de lo guardado. */
  private cambios(): UpdateProfileRequest {
    const { nombre, apellido, email, password } = this.form.getRawValue();
    const cambios: UpdateProfileRequest = {};

    if (nombre.trim() !== this.perfil?.first_name) cambios.first_name = nombre.trim();
    if (apellido.trim() !== this.perfil?.last_name) cambios.last_name = apellido.trim();
    if (email.trim() !== this.perfil?.email) cambios.email = email.trim();
    if (password) cambios.password = password;

    return cambios;
  }
}

function contrasenasIguales(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmar = group.get('confirmar')?.value;
  return (password || confirmar) && password !== confirmar ? { noCoinciden: true } : null;
}

function mensajeError(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 409:
      return 'Ya existe una cuenta con ese email.';
    case 400:
      return 'Revisa los datos ingresados.';
    case 404:
      return 'Tu cuenta ya no existe.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}
