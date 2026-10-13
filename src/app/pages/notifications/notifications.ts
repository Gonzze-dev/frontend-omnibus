import { Component, inject } from '@angular/core';
import { Topbar } from '../../shared/topbar/topbar';
import { NotificationsStore } from '../../shared/notifications';

@Component({
  selector: 'app-notifications',
  imports: [Topbar],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  private readonly store = inject(NotificationsStore);

  protected readonly list = this.store.list;

  clear(): void {
    this.store.clear();
  }
}
