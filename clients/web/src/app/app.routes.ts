import {Routes} from '@angular/router';


export const routes: Routes = [
    {
        path: 'household',
        children: [
            {
                path: 'budget',
                loadChildren: () => import('./budget/budget.routes').then(m => m.BudgetRoutes),
            }
        ]
    },
    { path: '', redirectTo: '/household/budget', pathMatch: 'full' },
    { path: '**', redirectTo: '/household/budget' },
];
