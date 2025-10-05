import {ChangeDetectionStrategy, Component, inject} from "@angular/core";
import {MenuItem} from "primeng/api";
import {Menu} from "primeng/menu";
import {Router} from '@angular/router';


@Component({
    selector: 'app-navigation',
    templateUrl: './navigation.component.html',
    styleUrl: './navigation.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        Menu,
    ],
})
export class NavigationComponent {
    private readonly router = inject(Router);

    menuItems = this.createMenuItems();

    private createMenuItems(): MenuItem[] {
        return [
            {
                label: 'Budget',
                items: [
                    {
                        label: 'Dashboard',
                        icon: 'pi pi-chart-bar',
                        command: () => this.router.navigate(['/budget/dashboard'])
                    },
                ]
            },
        ];
    }
}
