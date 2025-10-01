import {Component, inject, OnInit} from "@angular/core";
import {MenuItem} from "primeng/api";
import {Menu} from "primeng/menu";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {faHouse} from "@fortawesome/free-solid-svg-icons";
import { Router } from '@angular/router';


@Component({
    selector: 'app-navigation',
    templateUrl: './navigation.component.html',
    styleUrl: './navigation.component.css',
    imports: [
        Menu,
        FaIconComponent,
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
                        command: () => this.router.navigate(['/household/budget/dashboard'])
                    },
                ]
            },
        ];
    }

    protected readonly faHouse = faHouse;
}
