import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome';
import {ButtonModule} from 'primeng/button';

import {NavigationComponent} from "./core/components/navigation/navigation.component";

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    imports: [RouterOutlet, FontAwesomeModule, ButtonModule, NavigationComponent],
})
export class AppComponent {
}

