import { Component } from '@angular/core';
import { Topbar } from '../../shared/topbar/topbar';

@Component({
  selector: 'app-perfil',
  imports: [Topbar],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class Perfil {
  /** Datos de ejemplo hasta que exista el endpoint de perfil. */
  protected readonly perfil = {
    nombre: 'Gonzalo Errandonea',
    email: 'ejemplo@gmail.com',
  };
}
