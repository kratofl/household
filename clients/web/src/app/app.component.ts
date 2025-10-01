import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome';
import {ButtonModule} from 'primeng/button';
import {NavigationComponent} from "./core/navigation/navigation.component";

@Component({
  selector: 'app-root',
    imports: [RouterOutlet, FontAwesomeModule, ButtonModule, NavigationComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
}

