import { Component, OnInit } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { ToastModule } from "primeng/toast";
import { ToastService } from "./shared/services/toast.service";
import { AuthService } from "./auth/services/auth.service";
import { CartService } from "./storefront/services/cart.service";
import { concatMap, of, take } from "rxjs";
import { UserRoles } from "./auth/models/auth.models";
// import { NavigationBarComponent } from "./components/navigation-bar/navigation-bar.component";

@Component({
    selector: "app-root",
    imports: [RouterOutlet, ToastModule],
    providers: [ToastService],
    templateUrl: "./app.component.html",
    styleUrl: "./app.component.scss",
    standalone: true,
})
export class AppComponent implements OnInit {
    title = "FE";

    constructor(private authService: AuthService, private toastService: ToastService, private cartService: CartService) {}
    ngOnInit(): void {
        const checkJWT = this.authService.checkJWT();
        // toastService not working from app component
        if (checkJWT[0] && !checkJWT[1]) {
            this.authService.loggedUserSubject
                .pipe(
                    take(1),
                    concatMap((res) => {
                        if (res.role !== UserRoles.Admin) {
                            return this.cartService.getCartProducts();
                        }
                        return of({ items: [], totalPrice: 0 });
                    })
                )
                .pipe(take(1))
                .subscribe((res) => {
                    this.cartService.cartItemsSubject$.next(
                        res.items.reduce((acc, curr) => {
                            return acc + curr.quantity!;
                        }, 0)
                    );
                });
        } else {
            this.cartService.updateCartBadge();
        }
    }
}
