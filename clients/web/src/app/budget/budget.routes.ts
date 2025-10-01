import {Routes} from '@angular/router';
import {BudgetComponent} from "./budget.component";
import {DashboardComponent} from "./dashboard/dashboard.component";


export const BudgetRoutes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./budget.component').then((m) => m.BudgetComponent),
        children: [
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
            },
        ]
    }
];