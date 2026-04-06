import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { TermsComponent } from './pages/terms/terms.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'terms-and-conditions', component: TermsComponent },
];
