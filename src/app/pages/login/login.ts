import { Component, Injector, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PasswordToggle } from '../../shared/password-toggle/password-toggle';
import { focusFirstInvalid } from '../../shared/a11y';

@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule, PasswordToggle],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly injector = inject(Injector);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  /** Whether the brand splash plays on this visit (at most once every 24 h). */
  readonly intro = shouldPlayIntro();

  /** Notice left by /reset-password after the password is changed. */
  readonly passwordChanged = signal(
    inject(ActivatedRoute).snapshot.queryParamMap.get('changed') === 'ok',
  );

  signIn(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.injector);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.passwordChanged.set(false);

    const { email, password } = this.form.getRawValue();
    this.auth.login({ email: email.trim(), password }).subscribe({
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

  invalid(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }
}

function errorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intentá más tarde.';
    case 400:
    case 401:
      return 'Email o contraseña incorrectos.';
    default:
      return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}

/** localStorage key with the timestamp (ms) until which the splash is skipped. */
const INTRO_KEY = 'login_intro_until';
const INTRO_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * The splash plays when there is no valid timestamp or it already expired;
 * in that case the next 24 h are marked as seen. If localStorage fails
 * (private mode, blocked storage) it plays every time, as before.
 */
function shouldPlayIntro(): boolean {
  const now = Date.now();
  try {
    const until = Number(localStorage.getItem(INTRO_KEY));
    if (until > now) return false;
    localStorage.setItem(INTRO_KEY, String(now + INTRO_INTERVAL_MS));
  } catch {}
  return true;
}
