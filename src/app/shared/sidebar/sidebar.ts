import { Component, inject, model } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  host: {
    '(document:keydown.escape)': 'close()',
  },
})
export class Sidebar {
  private readonly auth = inject(AuthService);

  /** Two-way: el padre abre el menu y el drawer se cierra solo. */
  readonly open = model(false);

  close(): void {
    this.open.set(false);
  }

  cerrarSesion(): void {
    this.close();
    this.auth.logout();
  }
}
