import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Toast } from '../../shared/toast/toast';

@Component({
  selector: 'app-olvidar-contrasena',
  imports: [RouterLink, ReactiveFormsModule, Toast],
  templateUrl: './olvidar-contrasena.html',
  styleUrl: './olvidar-contrasena.scss',
})
export class OlvidarContrasena {
  private readonly auth = inject(AuthService);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly enviado = signal<string | null>(null);
  readonly mostrarToast = signal(false);

  enviarEnlace(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: (res) => {
        this.cargando.set(false);
        // El backend contesta lo mismo exista o no la cuenta: no se puede
        // deducir desde aca si el mail salio.
        this.enviado.set(
          res.message ||
            'Si el email esta registrado, te llegara un correo para cambiar tu contraseña.',
        );
        this.mostrarToast.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }

  invalido(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }
}

function mensajeError(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 400:
      return 'Ingresa un email valido.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}
