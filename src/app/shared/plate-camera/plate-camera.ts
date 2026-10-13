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
import { LicensePlateService } from '../../services/license-plate.service';

type Step = 'camera' | 'reading' | 'error';

/** Longest side of the photo sent to the OCR: enough to read the plate and it weighs little. */
const MAX_SIDE = 1600;

/**
 * Camera-shaped button that opens a modal to take a photo of a license plate
 * and read it with the OCR. It uses the rear camera on phones and the webcam
 * on PCs; if the browser does not allow using the live camera (for example a
 * phone browsing over http), it falls back to the native camera with a file input.
 *
 * It emits the license plate read through (plateRead).
 */
@Component({
  selector: 'app-plate-camera',
  templateUrl: './plate-camera.html',
  styleUrl: './plate-camera.scss',
})
export class PlateCamera implements OnDestroy {
  private readonly licensePlateService = inject(LicensePlateService);

  /** The video appears only when the modal is drawn: that is when the camera is connected to it. */
  @ViewChild('video') private set videoRef(ref: ElementRef<HTMLVideoElement> | undefined) {
    this.video = ref?.nativeElement;
    void this.connectVideo();
  }
  @ViewChild('file') private readonly fileRef?: ElementRef<HTMLInputElement>;
  @ViewChild('nativeCamera') private readonly nativeCameraRef?: ElementRef<HTMLInputElement>;

  @Output() readonly plateRead = new EventEmitter<string>();

  protected readonly open = signal(false);
  protected readonly step = signal<Step>('camera');
  protected readonly starting = signal(false);
  /** There is no live camera: the device's native camera is offered. */
  protected readonly noLiveCamera = signal(false);
  /** Photo taken, shown frozen while it is read. */
  protected readonly preview = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Webcams and front cameras are shown mirrored, like a mirror; the rear one is not. */
  protected readonly mirrored = signal(false);

  private video?: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private reading?: Subscription;

  ngOnDestroy(): void {
    this.close();
  }

  protected async openModal(): Promise<void> {
    this.open.set(true);
    this.reset();
    await this.startCamera();
  }

  protected close(): void {
    this.reading?.unsubscribe();
    this.stopCamera();
    this.clearPreview();
    this.open.set(false);
  }

  /** Goes back to the live camera to take another photo. */
  protected retry(): void {
    this.reset();
    if (!this.stream && !this.noLiveCamera()) void this.startCamera();
  }

  /** White button: takes the photo, goes back to the camera after an error or opens the native camera. */
  protected shoot(): void {
    if (this.step() === 'error') {
      this.retry();
    } else if (this.noLiveCamera()) {
      this.nativeCameraRef?.nativeElement.click();
    } else {
      this.takePhoto();
    }
  }

  protected takePhoto(): void {
    const video = this.video;
    if (!video || !video.videoWidth) return;
    void this.process(video, video.videoWidth, video.videoHeight);
  }

  protected chooseFile(): void {
    this.fileRef?.nativeElement.click();
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const bitmap = await createImageBitmap(file);
      await this.process(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
    } catch {
      this.showError('No se pudo abrir la foto. Proba con otra.');
    }
  }

  private reset(): void {
    this.clearPreview();
    this.error.set(null);
    this.step.set('camera');
  }

  private async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.noLiveCamera.set(true);
      return;
    }

    this.starting.set(true);
    try {
      // "environment" prefers the rear camera on phones; on a PC
      // the browser uses whatever single camera there is.
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
        this.starting.set(false);
        this.noLiveCamera.set(true);
        return;
      }
    }

    // The modal was closed while the browser was asking for permission.
    if (!this.open()) {
      this.stopCamera();
      return;
    }

    await this.connectVideo();
  }

  private async connectVideo(): Promise<void> {
    const video = this.video;
    if (!video || !this.stream || video.srcObject === this.stream) return;

    const { facingMode } = this.stream.getVideoTracks()[0]?.getSettings() ?? {};
    this.mirrored.set(facingMode !== 'environment');
    video.srcObject = this.stream;
    try {
      await video.play();
    } catch {
      // play() is interrupted if the modal closes halfway; there is nothing to do.
    }
    this.starting.set(false);
  }

  /** Shrinks the image, shows it frozen and sends it to be read. */
  private async process(source: CanvasImageSource, width: number, height: number): Promise<void> {
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // The photo goes to the OCR unmirrored, even if the live preview is mirrored.
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const image = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!image) {
      this.showError('No se pudo sacar la foto. Proba de nuevo.');
      return;
    }

    this.clearPreview();
    this.error.set(null);
    this.preview.set(URL.createObjectURL(image));
    this.step.set('reading');

    this.reading = this.licensePlateService.read(image).subscribe({
      next: ({ license_plate }) => {
        this.plateRead.emit(license_plate);
        this.close();
      },
      error: (err: HttpErrorResponse) => this.showError(errorMessage(err)),
    });
  }

  private showError(message: string): void {
    this.error.set(message);
    this.step.set('error');
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.starting.set(false);
  }

  private clearPreview(): void {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
    this.preview.set(null);
  }
}

function errorMessage(err: HttpErrorResponse): string {
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
