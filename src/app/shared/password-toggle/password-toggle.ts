import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-password-toggle',
  templateUrl: './password-toggle.html',
})
export class PasswordToggle {
  @Input() visible = false;
  @Output() readonly visibleChange = new EventEmitter<boolean>();

  alternar(): void {
    this.visibleChange.emit(!this.visible);
  }
}
