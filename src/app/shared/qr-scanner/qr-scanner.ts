import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  signal,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import jsQR from 'jsqr';

/**
 * Modal que abre la camara del dispositivo (webcam en PC, camara trasera
 * en celulares) y decodifica codigos QR en vivo con jsQR.
 *
 * Se abre con [abierto]="true" y notifica el resultado por (codigoLeido);
 * (cerrar) se dispara al cancelar o al leer un codigo.
 */
@Component({
  selector: 'app-qr-scanner',
  imports: [],
  templateUrl: './qr-scanner.html',
  styleUrl: './qr-scanner.scss',
})
export class QrScanner implements AfterViewInit, OnDestroy {
  @ViewChild('video') private readonly videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') private readonly canvasRef?: ElementRef<HTMLCanvasElement>;

  @Output() readonly codigoLeido = new EventEmitter<string>();
  @Output() readonly cerrar = new EventEmitter<void>();

  protected readonly error = signal<string | null>(null);
  protected readonly cargando = signal(true);
  /** Camara frontal (PC o selfie): se espeja para que se vea como un espejo. */
  protected readonly espejo = signal(false);

  private stream: MediaStream | null = null;
  private frameId = 0;

  async ngAfterViewInit(): Promise<void> {
    await this.iniciarCamara();
  }

  ngOnDestroy(): void {
    this.detenerCamara();
  }

  private async iniciarCamara(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('Este dispositivo o navegador no permite acceder a la camara.');
      this.cargando.set(false);
      return;
    }

    try {
      // "environment" prioriza la camara trasera en celulares; en una PC
      // sin camara trasera el navegador simplemente usa la unica disponible.
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch {
      try {
        // Algunos navegadores de escritorio rechazan el facingMode: reintento sin restricciones.
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch {
        this.error.set('No se pudo acceder a la camara. Revisa los permisos del navegador.');
        this.cargando.set(false);
        return;
      }
    }

    const video = this.videoRef?.nativeElement;
    if (!video) return;

    // La camara trasera de un celular no se espeja: mostraria el mundo al
    // reves. La frontal (o una webcam de PC, que no informa facingMode) si,
    // para que el usuario se vea como en un espejo.
    const facingMode = this.stream.getVideoTracks()[0]?.getSettings().facingMode;
    this.espejo.set(facingMode !== 'environment');

    video.srcObject = this.stream;
    await video.play();
    this.cargando.set(false);
    this.frameId = requestAnimationFrame(() => this.leerFrame());
  }

  private leerFrame(): void {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      this.frameId = requestAnimationFrame(() => this.leerFrame());
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const codigo = jsQR(imagen.data, imagen.width, imagen.height);

    if (codigo?.data) {
      this.codigoLeido.emit(codigo.data);
      this.cerrarModal();
      return;
    }

    this.frameId = requestAnimationFrame(() => this.leerFrame());
  }

  private detenerCamara(): void {
    cancelAnimationFrame(this.frameId);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  protected cerrarModal(): void {
    this.detenerCamara();
    this.cerrar.emit();
  }
}
