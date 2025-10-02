import {Routes} from '@angular/router';

export const BudgetRoutes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./budget.component').then((m) => m.BudgetComponent),
        children: [
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./dashboard/pages/dashboard-page/dashboard-page.component').then((m) => m.DashboardPageComponent),
            },
        ]
    }
];