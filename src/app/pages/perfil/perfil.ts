import { Component, signal } from '@angular/core';
import { Topbar } from '../../shared/topbar/topbar';
import { PasswordToggle } from '../../shared/password-toggle/password-toggle';

@Component({
  selector: 'app-perfil',
  imports: [Topbar, PasswordToggle],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class Perfil {
  /** Datos de ejemplo hasta que exista el endpoint de perfil. */
  protected readonly perfil = {
    nombre: 'Gonzalo Errandonea',
    email: 'ejemplo@gmail.com',
  };

  protected readonly mostrarPassword = signal(false);
  protected readonly mostrarConfirmar = signal(false);
}
