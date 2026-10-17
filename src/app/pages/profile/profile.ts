import { Component, effect, ElementRef, Injector, inject, OnInit, signal, viewChild } from '@angular/core';
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
import { focusFirstInvalid } from '../../shared/a11y';

type Field = 'firstName' | 'lastName' | 'email' | 'password' | 'confirm';

@Component({
  selector: 'app-profile',
  imports: [Topbar, PasswordToggle, Toast, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private readonly injector = inject(Injector);
  private readonly userService = inject(UserService);

  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');

  /** The password is optional: empty means "do not change it". */
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.minLength(8)],
      confirm: [''],
    },
    { validators: passwordsMatch },
  );

  /** Latest data confirmed by the backend, to send only what changed. */
  private profile: User | null = null;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showSuccess = signal(false);

  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly showPassword = signal(false);
  protected readonly showConfirm = signal(false);

  constructor() {
    // The native <dialog> is opened with showModal() to get a backdrop, trapped
    // focus and closing with Escape without writing them by hand.
    effect(() => {
      const dialog = this.deleteDialog()?.nativeElement;
      if (!dialog) return;
      if (this.confirmingDelete() && !dialog.open) dialog.showModal();
      if (!this.confirmingDelete() && dialog.open) dialog.close();
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  protected loadProfile(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.userService.getProfile().subscribe({
      next: (user) => {
        this.fillForm(user);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(
          err.status === 0
            ? 'No se pudo conectar con el servidor. Intentá más tarde.'
            : 'No se pudo cargar tu perfil. Intentá de nuevo.',
        );
      },
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.injector);
      return;
    }

    const changes = this.changes();
    if (!Object.keys(changes).length) {
      this.error.set('No hay cambios para guardar.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.userService.updateProfile(changes).subscribe({
      next: (user) => {
        this.saving.set(false);
        this.fillForm(user);
        this.showSuccess.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  protected deleteAccount(): void {
    this.deleting.set(true);
    this.deleteError.set(null);

    // If it goes well the service clears the session and goes to login
    this.userService.deleteAccount().subscribe({
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteError.set(
          err.status === 0
            ? 'No se pudo conectar con el servidor. Intentá más tarde.'
            : 'No se pudo eliminar la cuenta. Intentá de nuevo.',
        );
      },
    });
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.confirmingDelete.set(false);
    this.deleteError.set(null);
  }

  /** A click on the backdrop (outside the content) closes the popup. */
  protected onPopupClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancelDelete();
  }

  protected invalid(field: Field): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  protected mismatch(): boolean {
    return this.form.hasError('mismatch') && this.form.controls.confirm.touched;
  }

  private fillForm(user: User): void {
    this.profile = user;
    this.form.reset({
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      password: '',
      confirm: '',
    });
  }

  /** Builds the patch with the fields that differ from what is stored. */
  private changes(): UpdateProfileRequest {
    const { firstName, lastName, email, password } = this.form.getRawValue();
    const changes: UpdateProfileRequest = {};

    if (firstName.trim() !== this.profile?.first_name) changes.first_name = firstName.trim();
    if (lastName.trim() !== this.profile?.last_name) changes.last_name = lastName.trim();
    if (email.trim() !== this.profile?.email) changes.email = email.trim();
    if (password) changes.password = password;

    return changes;
  }
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return (password || confirm) && password !== confirm ? { mismatch: true } : null;
}

function errorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intentá más tarde.';
    case 409:
      return 'Ya existe una cuenta con ese email.';
    case 400:
      return 'Revisá los datos ingresados.';
    case 404:
      return 'Tu cuenta ya no existe.';
    default:
      return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}
