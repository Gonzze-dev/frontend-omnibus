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
 * Modal that opens the device camera (webcam on PC, rear camera
 * on phones) and decodes QR codes live with jsQR.
 *
 * It notifies the result through (codeRead);
 * (close) fires when cancelling or after reading a code.
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

  @Output() readonly codeRead = new EventEmitter<string>();
  @Output() readonly close = new EventEmitter<void>();

  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  /** Front camera (PC or selfie): it is mirrored so it looks like a mirror. */
  protected readonly mirror = signal(false);
  /** The QR was detected: the check is shown for a moment before closing, so the camera is not cut abruptly. */
  protected readonly read = signal(false);

  private stream: MediaStream | null = null;
  private frameId = 0;
  private closeTimer?: ReturnType<typeof setTimeout>;

  /** Time the confirmation is shown before closing the modal. */
  private static readonly READ_PAUSE_MS = 600;

  async ngAfterViewInit(): Promise<void> {
    await this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('Este dispositivo o navegador no permite acceder a la camara.');
      this.loading.set(false);
      return;
    }

    try {
      // "environment" prefers the rear camera on phones; on a PC
      // without a rear camera the browser simply uses the only one available.
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch {
      try {
        // Some desktop browsers reject facingMode: retry without constraints.
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch {
        this.error.set('No se pudo acceder a la camara. Revisa los permisos del navegador.');
        this.loading.set(false);
        return;
      }
    }

    const video = this.videoRef?.nativeElement;
    if (!video) return;

    // A phone's rear camera is not mirrored: it would show the world
    // backwards. The front one (or a PC webcam, which does not report facingMode) is,
    // so the user sees themselves as in a mirror.
    const facingMode = this.stream.getVideoTracks()[0]?.getSettings().facingMode;
    this.mirror.set(facingMode !== 'environment');

    video.srcObject = this.stream;
    await video.play();
    this.loading.set(false);
    this.frameId = requestAnimationFrame(() => this.readFrame());
  }

  private readFrame(): void {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      this.frameId = requestAnimationFrame(() => this.readFrame());
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(image.data, image.width, image.height);

    if (code?.data) {
      // Frames stop being read but the camera stays on for a moment:
      // the check confirms the read before the modal closes.
      this.read.set(true);
      this.closeTimer = setTimeout(() => {
        this.codeRead.emit(code.data);
        this.closeModal();
      }, QrScanner.READ_PAUSE_MS);
      return;
    }

    this.frameId = requestAnimationFrame(() => this.readFrame());
  }

  private stopCamera(): void {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.closeTimer);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  protected closeModal(): void {
    this.stopCamera();
    this.close.emit();
  }
}
