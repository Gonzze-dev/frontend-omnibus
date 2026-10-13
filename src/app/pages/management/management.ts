import { Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { Counter } from '../../shared/counter/counter';
import { findSection } from './sections';

/**
 * Options menu of a dashboard card. The five management sections
 * share this screen: the only thing that changes is the catalog
 * section it gets according to the route.
 */
@Component({
  selector: 'app-management',
  imports: [Topbar, RouterLink, NgTemplateOutlet, Counter],
  templateUrl: './management.html',
  styleUrl: './management.scss',
})
export class Management {
  private readonly route = inject(ActivatedRoute);

  /** It is read from the parameter so the link between sections works. */
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly section = computed(() => findSection(this.params().get('section')));
}

/** Tab title: the section's, or the generic one if it does not exist. */
export const managementTitle: ResolveFn<string> = (route) =>
  findSection(route.paramMap.get('section'))?.title ?? 'Dashboard';
