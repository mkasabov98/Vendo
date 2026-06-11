import { Component, OnDestroy, OnInit } from "@angular/core";
import { CartTableComponent } from "../cart-table/cart-table.component";
import { ProcessOrderComponent } from "../process-order/process-order.component";
import { AuthService } from "../../auth/services/auth.service";
import { loggedUser } from "../../auth/models/auth.models";
import { NO_USER } from "../../shared/constants/constants";
import { Subject, takeUntil } from "rxjs";
import { CartService } from "../services/cart.service";
import { ButtonModule } from "primeng/button";
import { RouterLink } from "@angular/router";

@Component({
    selector: "app-cart",
    imports: [CartTableComponent, ProcessOrderComponent, ButtonModule, RouterLink],
    templateUrl: "./cart.component.html",
    styleUrl: "./cart.component.scss",
    standalone: true,
})
export class CartComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    public NO_USER = NO_USER;
    public loggedUser: loggedUser = NO_USER;
    public cartItems = 0;
    public showStepper = false;
    public paymentComplete = false;

    constructor(private authService: AuthService, private cartService: CartService) {}

    ngOnInit(): void {
        this.authService.loggedUserSubject.pipe(takeUntil(this.destroy$)).subscribe((res) => {
            this.loggedUser = res;
        });
        this.cartService.cartItemsSubject$.subscribe((res) => {
            this.cartItems = res;
            this.showStepper = res > 0;
        });
    }

    onPaymentComplete() {
        this.paymentComplete = true;
        localStorage.removeItem("localCart");
        this.cartService.cartItemsSubject$.next(0);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
    }
}
