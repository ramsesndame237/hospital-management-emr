import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { configureApp } from '../testing/app-testing';
import { ROUTE_PROGRESS_DELAY_MS, RouteProgress } from './route-progress';

@Component({ selector: 'app-dummy', template: '' })
class Dummy {}

describe('RouteProgress (barre de chargement des pages)', () => {
  let fixture: ComponentFixture<RouteProgress>;
  let router: Router;
  let release: (() => void) | null = null;
  const bar = () => (fixture.nativeElement as HTMLElement).querySelector('[role=progressbar]');

  beforeEach(() => {
    vi.useFakeTimers();
    configureApp({ signedIn: false });
    router = TestBed.inject(Router);
    router.resetConfig([
      { path: '', component: Dummy },
      { path: 'fast', component: Dummy },
      // Un écran dont le téléchargement dure jusqu'à ce que le test le libère.
      { path: 'slow', loadComponent: () => new Promise<typeof Dummy>((resolve) => (release = () => resolve(Dummy))) },
      { path: 'blocked', canActivate: [() => false], component: Dummy },
    ]);
    fixture = TestBed.createComponent(RouteProgress);
    fixture.detectChanges();
  });

  afterEach(() => {
    release = null;
    vi.useRealTimers();
  });

  it('reste invisible quand rien ne se charge', () => {
    expect(bar()).toBeNull();
  });

  it("n'affiche rien pour une navigation rapide (pas de clignotement)", async () => {
    await router.navigateByUrl('/fast');
    fixture.detectChanges();
    expect(bar()).toBeNull();
  });

  it("apparaît quand le chargement d'un écran traîne, s'annonce aux lecteurs d'écran, puis disparaît à l'arrivée", async () => {
    const navigation = router.navigateByUrl('/slow');
    await vi.advanceTimersByTimeAsync(ROUTE_PROGRESS_DELAY_MS - 20);
    fixture.detectChanges();
    expect(bar()).toBeNull(); // trop tôt

    await vi.advanceTimersByTimeAsync(40);
    fixture.detectChanges();
    expect(bar()).not.toBeNull();
    expect(bar()?.getAttribute('aria-label')).toBe('Chargement de la page');
    expect(bar()?.getAttribute('aria-busy')).toBe('true');

    release!();
    await navigation;
    fixture.detectChanges();
    expect(bar()).toBeNull();
  });

  it("disparaît aussi quand la navigation est refusée par une garde", async () => {
    await router.navigateByUrl('/blocked');
    await vi.advanceTimersByTimeAsync(ROUTE_PROGRESS_DELAY_MS + 50);
    fixture.detectChanges();
    expect(bar()).toBeNull();
  });

  it("disparaît quand une nouvelle navigation remplace celle qui était en cours", async () => {
    void router.navigateByUrl('/slow');
    await vi.advanceTimersByTimeAsync(ROUTE_PROGRESS_DELAY_MS + 20);
    fixture.detectChanges();
    expect(bar()).not.toBeNull();
    await router.navigateByUrl('/fast');
    fixture.detectChanges();
    expect(bar()).toBeNull();
  });
});
