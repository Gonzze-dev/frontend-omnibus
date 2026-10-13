import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PasswordToggle } from '../../shared/password-toggle/password-toggle';

/** Estado del token que llega en el enlace del correo. */
type EstadoToken = 'sin-token' | 'validando' | 'valido' | 'invalido';

@Component({
  selector: 'app-nueva-contrasena',
  imports: [RouterLink, ReactiveFormsModule, PasswordToggle],
  templateUrl: './nueva-contrasena.html',
  styleUrl: './nueva-contrasena.scss',
})
export class NuevaContrasena {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmar: ['', Validators.required],
    },
    { validators: contrasenasIguales },
  );

  readonly estado = signal<EstadoToken>('validando');
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarPassword = signal(false);
  readonly mostrarConfirmar = signal(false);

  /** Token del enlace: se lee una sola vez, no cambia mientras dura la pantalla. */
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token')?.trim() ?? '';

  constructor() {
    if (!this.token) {
      this.estado.set('sin-token');
      return;
    }

    // Se valida antes de mostrar el formulario para no hacer escribir la
    // contraseña dos veces con un enlace ya vencido.
    this.auth.validateRecoveryToken(this.token).subscribe({
      next: (res) => this.estado.set(res.valid ? 'valido' : 'invalido'),
      error: () => this.estado.set('invalido'),
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    this.auth.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => {
        this.cargando.set(false);
        // El backend invalida los refresh tokens del usuario: si habia sesion
        // abierta ya no sirve, y sin ella el login no redirige al inicio.
        this.auth.descartarSesion();
        // El login avisa que el cambio salio bien con ?cambio=ok
        this.router.navigate(['/login'], { queryParams: { cambio: 'ok' } });
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        if (err.status === 401) {
          this.estado.set('invalido');
          return;
        }
        this.error.set(mensajeError(err));
      },
    });
  }

  invalido(campo: 'password' | 'confirmar'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }

  noCoinciden(): boolean {
    return this.form.hasError('noCoinciden') && this.form.controls.confirmar.touched;
  }
}

function contrasenasIguales(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmar = group.get('confirmar')?.value;
  return confirmar && password !== confirmar ? { noCoinciden: true } : null;
}

function mensajeError(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 400:
      return 'La contraseña debe tener al menos 8 caracteres.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}
