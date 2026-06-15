import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { cardProduct } from "../models/products.models";
import { Button } from "primeng/button";
import { AuthService } from "../../auth/services/auth.service";
import { Subject, take, takeUntil } from "rxjs";
import { loggedUser, UserRoles } from "../../auth/models/auth.models";
import { NO_USER } from "../../shared/constants/constants";
import { CartService } from "../services/cart.service";
import { Router } from "@angular/router";

@Component({
    selector: "app-product-card",
    imports: [Button],
    templateUrl: "./product-card.component.html",
    styleUrl: "./product-card.component.scss",
    standalone: true,
})
export class ProductCardComponent implements OnInit, OnDestroy {
    @Input() product!: cardProduct;

    private destroy$ = new Subject<void>();

    public UserRoles = UserRoles;
    public loggedUser: loggedUser = NO_USER;
    public productStars: string[] = [];

    constructor(
        private authService: AuthService,
        private cartService: CartService,
        private router: Router,
    ) {}

    ngOnInit() {
        this.authService.loggedUserSubject
            .pipe(takeUntil(this.destroy$))
            .subscribe((user) => (this.loggedUser = user));

        const filled = this.product.starReview ? Math.round(this.product.starReview) : 0;
        for (let i = 1; i <= 5; i++) {
            this.productStars.push(i <= filled ? `filledStar${i}` : `emptyStar${i}`);
        }
    }

    onImageError(event: Event) {
        (event.target as HTMLImageElement).src =
            "https://placehold.co/400x300?text=No+Image";
    }

    openProduct(event$: Event) {
        this.router.navigate(["/vendo/product", this.product.id]);
    }

    addToCart(event$: Event) {
        event$.stopPropagation();
        if (this.product.stock === 0 || this.product.isActive === false) return;
        this.cartService
            .addToCart(this.product.id, 1, this.product.stock, this.loggedUser.id === NO_USER.id)
            .pipe(take(1))
            .subscribe();
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
