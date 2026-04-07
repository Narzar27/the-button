import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./pages/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent),
  },
  {
    path: 'perks',
    loadComponent: () => import('./pages/perks/perks.component').then(m => m.PerkStoreComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent),
  },
  {
    path: 'terms-and-conditions',
    loadComponent: () => import('./pages/terms/terms.component').then(m => m.TermsComponent),
  },
];
