import { Component, Injector, inject, signal } from '@angular/core';
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
import { focusFirstInvalid } from '../../shared/a11y';

/** State of the token that arrives in the email link. */
type TokenState = 'no-token' | 'validating' | 'valid' | 'invalid';

@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, ReactiveFormsModule, PasswordToggle],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  private readonly injector = inject(Injector);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  readonly state = signal<TokenState>('validating');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly showConfirm = signal(false);

  /** Link token: it is read only once, it does not change while the screen lasts. */
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token')?.trim() ?? '';

  constructor() {
    if (!this.token) {
      this.state.set('no-token');
      return;
    }

    // It is validated before showing the form so the password is not typed
    // twice with an already expired link.
    this.auth.validateRecoveryToken(this.token).subscribe({
      next: (res) => this.state.set(res.valid ? 'valid' : 'invalid'),
      error: () => this.state.set('invalid'),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.injector);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => {
        this.loading.set(false);
        // The backend invalidates the user's refresh tokens: if there was an open
        // session it no longer works, and without it the login does not redirect home.
        this.auth.discardSession();
        // The login announces that the change went well with ?changed=ok
        this.router.navigate(['/login'], { queryParams: { changed: 'ok' } });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 401) {
          this.state.set('invalid');
          return;
        }
        this.error.set(errorMessage(err));
      },
    });
  }

  invalid(field: 'password' | 'confirm'): boolean {
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
      return 'No se pudo conectar con el servidor. Intentá más tarde.';
    case 400:
      return 'La contraseña debe tener al menos 8 caracteres.';
    default:
      return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}
