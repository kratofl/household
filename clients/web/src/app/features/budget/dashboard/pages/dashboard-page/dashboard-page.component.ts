import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
    selector: 'app-dashboard-page',
    templateUrl: './dashboard-page.component.html',
    styleUrl: './dashboard-page.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [],
})
export class DashboardPageComponent {

}
