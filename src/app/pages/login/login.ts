import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PasswordToggle } from '../../shared/password-toggle/password-toggle';

@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule, PasswordToggle],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarPassword = signal(false);

  /** Aviso que deja /reset-password al terminar de cambiar la contraseña. */
  readonly cambioOk = signal(
    inject(ActivatedRoute).snapshot.queryParamMap.get('cambio') === 'ok',
  );

  ingresar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.cambioOk.set(false);

    const { email, password } = this.form.getRawValue();
    this.auth.login({ email: email.trim(), password }).subscribe({
      next: (user) => {
        this.cargando.set(false);
        this.router.navigateByUrl(this.auth.rutaInicio(user));
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }

  invalido(campo: 'email' | 'password'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }
}

function mensajeError(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 400:
    case 401:
      return 'Email o contraseña incorrectos.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}
