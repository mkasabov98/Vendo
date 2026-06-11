import { Component } from '@angular/core';
import { RouterOutlet } from "@angular/router";
import { NavigationBarComponent } from "../navigation-bar/navigation-bar.component";

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, NavigationBarComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
  standalone: true
})
export class LayoutComponent {

}
