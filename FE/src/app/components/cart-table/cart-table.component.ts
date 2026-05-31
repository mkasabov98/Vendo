import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { TableModule } from "primeng/table";
import { AuthService } from "../../services/auth.service";
import { ToastService } from "../../services/toast.service";
import { map, Subject, take, takeUntil } from "rxjs";
import { loggedUser } from "../../models/auth.models";
import { NO_USER } from "../../constants/constants";
import { CartService } from "../../services/cart.service";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { ConfirmationService } from "primeng/api";
import { ButtonModule } from "primeng/button";
import { cartProduct } from "../../models/cart.models";
import { ProductsService } from "../../services/products.service";
import { TagModule } from "primeng/tag";
import { TooltipModule } from "primeng/tooltip";
import { getInventoryStatus, getInventorySeverity } from "../../utils/stock.utils";

@Component({
    selector: "app-cart-table",
    imports: [TableModule, ConfirmDialogModule, ButtonModule, TagModule, TooltipModule],
    providers: [ConfirmationService],
    templateUrl: "./cart-table.component.html",
    styleUrl: "./cart-table.component.scss",
    standalone: true,
})
export class CartTableComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    public products: cartProduct[] = [];
    public discount: { code: string; percentage: number } | null = null;

    private loggedUser: loggedUser = NO_USER;

    get cartSubtotal(): number {
        if (!this.products || !this.products.length) return 0;
        return this.products
            .filter(p => p.isActive)
            .reduce((acc, curr) => acc + curr.quantity! * curr.price, 0);
    }

    get hasUnavailableItems(): boolean {
        return this.products.some(p => !p.isActive);
    }

    get unavailableCount(): number {
        return this.products.filter(p => !p.isActive).length;
    }

    get discountAmount(): string {
        if (!this.discount) return "0.00";
        return (this.cartSubtotal * (this.discount.percentage / 100)).toFixed(2);
    }

    get cartFinalPrice(): string {
        if (!this.discount) return this.cartSubtotal.toFixed(2);
        return (this.cartSubtotal - this.cartSubtotal * (this.discount.percentage / 100)).toFixed(2);
    }
    constructor(private authService: AuthService, private toastService: ToastService, private cartService: CartService, private confirmationService: ConfirmationService, private productsService: ProductsService, private router: Router) {}

    ngOnInit(): void {
        this.authService.loggedUserSubject.pipe(takeUntil(this.destroy$)).subscribe((res) => {
            this.loggedUser = res;
            this.fetchCartProducts();
        });

        this.cartService.cartItemsSubject$.pipe(takeUntil(this.destroy$)).subscribe((count) => {
            if (count === 0) {
                this.products = [];
                this.cartService.unavailableItems$.next(false);
            }
        });

        this.cartService.discountSubject$.pipe(takeUntil(this.destroy$)).subscribe((discount) => {
            this.discount = discount;
        });
    }

    fetchCartProducts() {
        if (this.loggedUser.id === -1) {
            const products: { productId: number; productQuantity: number }[] = JSON.parse(localStorage.getItem("localCart") || "[]");
            this.productsService
                .getSpecificProducts(products.map((x) => x.productId))
                .pipe(
                    take(1),
                    map(({ items, totalPrice }) => {
                        return {
                            items: items.map((x) => {
                                return {
                                    ...x,
                                    quantity: products.find((y) => y.productId === x.productId)?.productQuantity,
                                    inventoryStatus: getInventoryStatus(x.stock),
                                    severityStatus: getInventorySeverity(x.stock),
                                };
                            }),
                            totalPrice,
                        };
                    })
                )
                .subscribe(
                    (res) => {
                        this.products = res.items;
                        this.cartService.unavailableItems$.next(this.hasUnavailableItems);
                    },
                    (err) => {
                        this.toastService.show(err.error.message, "warn");
                    }
                );
        } else {
            this.cartService
                .getCartProducts()
                .pipe(
                    take(1),
                    map(({ items, totalPrice }) => {
                        return {
                            items: items.map((x) => {
                                return {
                                    ...x,
                                    inventoryStatus: getInventoryStatus(x.stock),
                                    severityStatus: getInventorySeverity(x.stock),
                                };
                            }),
                            totalPrice,
                        };
                    })
                )
                .subscribe(
                    (res) => {
                        this.products = res.items;
                        this.cartService.unavailableItems$.next(this.hasUnavailableItems);
                    },
                    (err) => {
                        this.toastService.show(err.error.message, "warn");
                    }
                );
        }
    }

    handleAction(productId: number, quantity: number, actionType: "increment" | "decrement") {
        if (actionType === "decrement") {
            if (quantity === 1) this.openConfirmDialog(productId, quantity);
            else this.updateProductQuantity(productId, quantity - 1);
        } else {
            const product = this.products.find((x) => x.productId === productId);
            if (product && quantity >= product.stock) {
                this.toastService.show(`Only ${product.stock} unit(s) of this item are available`, "warn");
                return;
            }
            this.updateProductQuantity(productId, quantity + 1);
        }
    }

    updateProductQuantity(productId: number, quantity: number) {
        if (this.loggedUser.id === -1) {
            this.cartService.updateLocalCart(productId, quantity);
            this.updateCart(productId, quantity);
            this.toastService.show("Temporary cart updated. Your personal cart will be updated once you log in.");
        } else {
            this.cartService
                .addProductToCart(productId, quantity)
                .pipe(take(1))
                .subscribe(
                    (res) => {
                        this.updateCart(productId, quantity);
                        this.toastService.show("Cart has been updated.", "success");
                    },
                    (error) => {
                        this.toastService.show(error.error.message, "warn");
                    }
                );
        }
    }

    updateCart(productId: number, quantity: number) {
        const productIndex = this.products.findIndex((x) => x.productId === productId);
        if (quantity === 0) {
            this.products.splice(productIndex, 1);
        } else {
            this.products[productIndex].quantity = quantity;
        }

        this.cartService.cartItemsSubject$.next(this.products.reduce((acc, curr) => acc + curr.quantity!, 0));
        this.cartService.unavailableItems$.next(this.hasUnavailableItems);
    }

    openConfirmDialog(productId: number, prevQuantity: number) {
        this.confirmationService.confirm({
            message: "Are you sure you want to remove the product from your cart?",
            header: "Remove product",
            closable: true,
            closeOnEscape: true,
            icon: "pi pi-exclamation-triangle",
            rejectButtonProps: {
                label: "don't remove",
                severity: "secondary",
                outlined: true,
            },
            acceptButtonProps: {
                label: "remove",
            },
            accept: () => {
                this.updateProductQuantity(productId, 0);
            },
            reject: () => {
                this.toastService.show("Product has not been removed from cart.");
                this.updateCart(productId, prevQuantity);
            },
        });
    }

    removeUnavailable(productId: number) {
        this.updateProductQuantity(productId, 0);
    }

    scrollToCheckout() {
        document.getElementById('checkout-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    navigateToProduct(productId: number) {
        this.router.navigate(["/e-com/product", productId]);
    }

    onImageError(event: Event) {
        (event.target as HTMLImageElement).src =
            "https://placehold.co/400x300?text=No+Image";
    }

    ngOnDestroy(): void {
        this.destroy$.next();
    }
}
