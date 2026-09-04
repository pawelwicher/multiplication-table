import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Tabliczka mnożenia',
    loadComponent: () => import('./ui/home-screen').then((m) => m.HomeScreen),
  },
  {
    path: 'calm',
    title: 'Spokojnie — tabliczka mnożenia',
    loadComponent: () => import('./game/calm-screen').then((m) => m.CalmScreen),
  },
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
  { path: '**', redirectTo: '' },
];
