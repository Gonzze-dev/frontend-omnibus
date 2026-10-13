import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PasswordToggle } from '../../shared/password-toggle/password-toggle';

type Campo = 'nombre' | 'apellido' | 'email' | 'password' | 'confirmar';

@Component({
  selector: 'app-registro',
  imports: [RouterLink, ReactiveFormsModule, PasswordToggle],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
})
export class Registro {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmar: ['', Validators.required],
    },
    { validators: contrasenasIguales },
  );

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarPassword = signal(false);
  readonly mostrarConfirmar = signal(false);

  crearCuenta(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    const { nombre, apellido, email, password } = this.form.getRawValue();
    const credenciales = { email: email.trim(), password };

    // El registro no devuelve tokens: se inicia sesion con los mismos datos
    this.auth
      .register({ first_name: nombre.trim(), last_name: apellido.trim(), ...credenciales })
      .pipe(switchMap(() => this.auth.login(credenciales)))
      .subscribe({
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

  invalido(campo: Campo): boolean {
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
    case 409:
      return 'Ya existe una cuenta con ese email.';
    case 400:
      return 'Revisa los datos ingresados.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}
