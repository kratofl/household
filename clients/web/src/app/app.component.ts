import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCoffee } from '@fortawesome/free-solid-svg-icons';
import { ButtonModule } from 'primeng/button';
import {NavigationComponent} from "./core/navigation/navigation.component";

@Component({
  selector: 'app-root',
    imports: [RouterOutlet, FontAwesomeModule, ButtonModule, NavigationComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
}

