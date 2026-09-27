import { Component, signal } from '@angular/core';
import { Topbar } from '../../shared/topbar/topbar';
import { EsperaViaje } from '../espera-viaje/espera-viaje';
import { QrScanner } from '../../shared/qr-scanner/qr-scanner';
import { Toast } from '../../shared/toast/toast';
import { PARSERS_BOLETO, QrBoletoError, parsearBoleto } from '../../shared/qr-scanner/boleto-parser';

@Component({
  selector: 'app-home',
  imports: [Topbar, EsperaViaje, QrScanner, Toast],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  /**
   * "Espera del viaje" no es una ruta: es el mismo home con el cuerpo
   * reemplazado. Volver a false lo deja como estaba.
   */
  protected readonly esperando = signal(false);

  protected readonly escaneando = signal(false);
  protected readonly ticket = signal('');
  protected readonly errorEscaneo = signal<string | null>(null);
  protected readonly mostrarExito = signal(false);

  protected onCodigoLeido(codigo: string): void {
    try {
      this.ticket.set(parsearBoleto(PARSERS_BOLETO, codigo));
      this.errorEscaneo.set(null);
      this.mostrarExito.set(true);
    } catch (error) {
      this.errorEscaneo.set(
        error instanceof QrBoletoError ? error.message : 'No se pudo escanear el QR correctamente.',
      );
    }
    this.escaneando.set(false);
  }
}
