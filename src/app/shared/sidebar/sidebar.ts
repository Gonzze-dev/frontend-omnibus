import { Component, model } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

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
  /** Two-way: el padre abre el menu y el drawer se cierra solo. */
  readonly open = model(false);

  close(): void {
    this.open.set(false);
  }
}
