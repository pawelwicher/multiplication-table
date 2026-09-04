import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'game' },
  {
    path: 'game',
    title: 'Arcade — tabliczka mnożenia',
    loadComponent: () => import('./game/game-screen').then((m) => m.GameScreen),
  },
  {
    path: 'map',
    title: 'Mapa opanowania',
    loadComponent: () => import('./ui/map-screen').then((m) => m.MapScreen),
  },
  { path: '**', redirectTo: 'game' },
];
