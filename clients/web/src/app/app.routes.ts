import {Routes} from '@angular/router';


export const routes: Routes = [
    {
        pathMatch: 'full',
        path: '',
        loadComponent: () => import('./app.component').then(m => m.AppComponent), // FIXME own home component
    },
    {
        path: 'budget',
        loadChildren: () => import('./features/budget/budget.routes').then(m => m.BudgetRoutes),
    },
    {path: '**', redirectTo: '/budget/dashboard'},
    {path: '', redirectTo: '/budget/dashboard', pathMatch: 'full'},
];
