import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Toast } from '../../shared/toast/toast';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, ReactiveFormsModule, Toast],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sent = signal<string | null>(null);
  readonly showToast = signal(false);

  sendLink(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: (res) => {
        this.loading.set(false);
        // The backend answers the same whether or not the account exists: it
        // cannot be inferred from here whether the email went out.
        this.sent.set(
          res.message ||
            'Si el email esta registrado, te llegara un correo para cambiar tu contraseña.',
        );
        this.showToast.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  invalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }
}

function errorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 400:
      return 'Ingresa un email valido.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}
