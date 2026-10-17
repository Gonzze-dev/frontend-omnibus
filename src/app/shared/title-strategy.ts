import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { APP_CONFIG } from '../config';

const BRAND = 'Ya llegó';

/**
 * Sets the page title and the canonical URL on every navigation.
 * The title carries the brand ("Iniciar sesión · Ya llegó") so browser tabs
 * and search results show whose screen it is. The canonical always points to
 * the public site (also when prerendering, where there is no real host) and
 * drops the query string, so links with tokens or filters count as one page.
 */
@Injectable({ providedIn: 'root' })
export class BrandTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} · ${BRAND}` : BRAND);
    this.setCanonical(snapshot.url.split(/[?#]/)[0]);
  }

  private setCanonical(path: string): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      head.appendChild(link);
    }
    link.href = APP_CONFIG.siteUrl + path;
  }
}
