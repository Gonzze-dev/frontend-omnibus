import {
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { PatenteService } from '../../services/patente.service';

type Paso = 'camara' | 'leyendo' | 'error';

/** Lado mayor de la foto que se manda al OCR: alcanza para leer la patente y pesa poco. */
const LADO_MAXIMO = 1600;

/**
 * Boton con forma de camara que abre un modal para sacarle una foto a una
 * patente y leerla con el OCR. Usa la camara trasera en celulares y la webcam
 * en PC; si el navegador no deja usar la camara en vivo (por ejemplo un
 * celular entrando por http), cae a la camara nativa con un input de archivo.
 *
 * Avisa la patente leida por (patenteLeida).
 */
@Component({
  selector: 'app-patente-camara',
  templateUrl: './patente-camara.html',
  styleUrl: './patente-camara.scss',
})
export class PatenteCamara implements OnDestroy {
  private readonly patenteService = inject(PatenteService);

  /** El video aparece recien cuando se dibuja el modal: ahi se le conecta la camara. */
  @ViewChild('video') private set videoRef(ref: ElementRef<HTMLVideoElement> | undefined) {
    this.video = ref?.nativeElement;
    void this.conectarVideo();
  }
  @ViewChild('archivo') private readonly archivoRef?: ElementRef<HTMLInputElement>;

  @Output() readonly patenteLeida = new EventEmitter<string>();

  protected readonly abierto = signal(false);
  protected readonly paso = signal<Paso>('camara');
  protected readonly iniciando = signal(false);
  /** No hay camara en vivo: se ofrece la camara nativa del dispositivo. */
  protected readonly sinCamaraEnVivo = signal(false);
  /** Foto sacada, se muestra congelada mientras se lee. */
  protected readonly vistaPrevia = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  private video?: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private lectura?: Subscription;

  ngOnDestroy(): void {
    this.cerrar();
  }

  protected async abrir(): Promise<void> {
    this.abierto.set(true);
    this.reiniciar();
    await this.iniciarCamara();
  }

  protected cerrar(): void {
    this.lectura?.unsubscribe();
    this.detenerCamara();
    this.limpiarVistaPrevia();
    this.abierto.set(false);
  }

  /** Vuelve a la camara en vivo para sacar otra foto. */
  protected reintentar(): void {
    this.reiniciar();
    if (!this.stream && !this.sinCamaraEnVivo()) void this.iniciarCamara();
  }

  protected sacarFoto(): void {
    const video = this.video;
    if (!video || !video.videoWidth) return;
    void this.procesar(video, video.videoWidth, video.videoHeight);
  }

  protected elegirArchivo(): void {
    this.archivoRef?.nativeElement.click();
  }

  protected async onArchivo(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;

    try {
      const bitmap = await createImageBitmap(archivo);
      await this.procesar(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
    } catch {
      this.mostrarError('No se pudo abrir la foto. Proba con otra.');
    }
  }

  private reiniciar(): void {
    this.limpiarVistaPrevia();
    this.error.set(null);
    this.paso.set('camara');
  }

  private async iniciarCamara(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.sinCamaraEnVivo.set(true);
      return;
    }

    this.iniciando.set(true);
    try {
      // "environment" prioriza la camara trasera en celulares; en una PC
      // el navegador usa la unica camara que haya.
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    } catch {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch {
        this.iniciando.set(false);
        this.sinCamaraEnVivo.set(true);
        return;
      }
    }

    // Se cerro el modal mientras el navegador pedia el permiso.
    if (!this.abierto()) {
      this.detenerCamara();
      return;
    }

    await this.conectarVideo();
  }

  private async conectarVideo(): Promise<void> {
    const video = this.video;
    if (!video || !this.stream || video.srcObject === this.stream) return;

    video.srcObject = this.stream;
    try {
      await video.play();
    } catch {
      // play() se corta si el modal se cierra en el medio; no hay nada que hacer.
    }
    this.iniciando.set(false);
  }

  /** Achica la imagen, la muestra congelada y la manda a leer. */
  private async procesar(fuente: CanvasImageSource, ancho: number, alto: number): Promise<void> {
    const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(ancho * escala);
    canvas.height = Math.round(alto * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // La foto va al OCR sin espejar, aunque la vista previa en vivo lo este.
    ctx.drawImage(fuente, 0, 0, canvas.width, canvas.height);

    const imagen = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!imagen) {
      this.mostrarError('No se pudo sacar la foto. Proba de nuevo.');
      return;
    }

    this.limpiarVistaPrevia();
    this.vistaPrevia.set(URL.createObjectURL(imagen));
    this.paso.set('leyendo');

    this.lectura = this.patenteService.leer(imagen).subscribe({
      next: ({ license_plate }) => {
        this.patenteLeida.emit(license_plate);
        this.cerrar();
      },
      error: (err: HttpErrorResponse) => this.mostrarError(mensajeError(err)),
    });
  }

  private mostrarError(mensaje: string): void {
    this.error.set(mensaje);
    this.paso.set('error');
  }

  private detenerCamara(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.iniciando.set(false);
  }

  private limpiarVistaPrevia(): void {
    const url = this.vistaPrevia();
    if (url) URL.revokeObjectURL(url);
    this.vistaPrevia.set(null);
  }
}

function mensajeError(err: HttpErrorResponse): string {
  switch (err.status) {
    case 422:
      return 'No se encontro una patente en la foto. Acercate y sacala de frente.';
    case 400:
    case 413:
      return 'La foto no es valida. Proba sacar otra.';
    case 0:
    case 502:
    case 503:
    case 504:
      return 'El lector de patentes no esta disponible. Cargala a mano.';
    default:
      return 'No se pudo leer la patente. Proba de nuevo o cargala a mano.';
  }
}
