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

type Field = 'firstName' | 'lastName' | 'email' | 'password' | 'confirm';

@Component({
  selector: 'app-register',
  imports: [RouterLink, ReactiveFormsModule, PasswordToggle],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly showConfirm = signal(false);

  createAccount(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { firstName, lastName, email, password } = this.form.getRawValue();
    const credentials = { email: email.trim(), password };

    // Registration returns no tokens: log in with the same data
    this.auth
      .register({ first_name: firstName.trim(), last_name: lastName.trim(), ...credentials })
      .pipe(switchMap(() => this.auth.login(credentials)))
      .subscribe({
        next: (user) => {
          this.loading.set(false);
          this.router.navigateByUrl(this.auth.homeRoute(user));
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(errorMessage(err));
        },
      });
  }

  invalid(field: Field): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  mismatch(): boolean {
    return this.form.hasError('mismatch') && this.form.controls.confirm.touched;
  }
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return confirm && password !== confirm ? { mismatch: true } : null;
}

function errorMessage(err: HttpErrorResponse): string {
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
