import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { cartProduct, getCartProductsResponse, updateCartProductResponse } from "../models/cart.models";
import { environment } from "../../../environments/environment";
import { BehaviorSubject, catchError, EMPTY, map, Observable, of, Subject, tap } from "rxjs";
import { ToastService } from "../../shared/services/toast.service";

import { loadStripe, Stripe } from "@stripe/stripe-js";

@Injectable({
    providedIn: "root",
})
export class CartService {
    public cartItemsSubject$ = new BehaviorSubject<number>(0);
    public discountSubject$ = new BehaviorSubject<{ code: string; percentage: number } | null>(null);
    public unavailableItems$ = new BehaviorSubject<boolean>(false);
    public cartSynced$ = new Subject<getCartProductsResponse>();
    private stripePromise: Promise<Stripe | null>;

    constructor(private http: HttpClient, private toastService: ToastService) {
        this.stripePromise = loadStripe(environment.STRIPE_PUBLISHABLE_KEY);
    }

    public getStripe(): Promise<Stripe | null> {
        return this.stripePromise;
    }

    public initiatePayment(addressId: number): Observable<{ clientSecret: string; orderId: number; message: string }> {
        return this.http.post<{ clientSecret: string; orderId: number; message: string }>(
            `${environment.apiUrl}/cart/create-payment-intent`,
            { addressId },
            { observe: "body" }
        );
    }

    public validateDiscountCode(code: string): Observable<{ valid: boolean; discountPercentage: number; code: string }> {
        return this.http.post<{ valid: boolean; discountPercentage: number; code: string }>(
            `${environment.apiUrl}/cart/validate-discount`,
            { code },
            { observe: "body" }
        );
    }

    public removeDiscountCode(): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${environment.apiUrl}/cart/discount`, { observe: "body" });
    }

    public updateLocalCart(productId: number, quantity: number) {
        let localCart: { productId: number; productQuantity: number }[] = JSON.parse(localStorage.getItem("localCart") || "[]");
        if (!localCart) localCart = [];

        const productIndex = localCart.findIndex((x) => x.productId === productId);

        if (quantity === 0 && productIndex !== -1) {
            localCart.splice(productIndex, 1);
        } else if (quantity !== 0 && productIndex !== -1) {
            localCart[productIndex].productQuantity = quantity;
        } else if (quantity !== 0 && productIndex === -1) {
            localCart.push({ productId: productId, productQuantity: quantity });
        }

        localStorage.setItem("localCart", JSON.stringify(localCart));
    }

    public getCartProducts(): Observable<getCartProductsResponse> {
        return this.http.get<getCartProductsResponse>(`${environment.apiUrl}/cart`, {
            observe: "body",
        });
    }

    public addProductToCart(productId: number, quantity: number, increment = false): Observable<updateCartProductResponse> {
        return this.http.patch<updateCartProductResponse>(
            `${environment.apiUrl}/cart/updateProduct`,
            { productId, quantity, increment },
            {
                observe: "body",
            }
        );
    }

    public updateCart(products: { productId: number; productQuantity: number }[]): Observable<{ message: string }> {
        return this.http.patch<{ message: string }>(`${environment.apiUrl}/cart/updateCart`, products, {
            observe: "body",
        });
    }

    public addToCart(productId: number, quantity: number, stock: number, isGuest: boolean): Observable<void> {
        if (isGuest) {
            const cart: { productId: number; productQuantity: number }[] = JSON.parse(
                localStorage.getItem("localCart") || "[]"
            );
            const idx = cart.findIndex((x) => x.productId === productId);
            if (idx === -1) {
                cart.push({ productId, productQuantity: quantity });
            } else {
                cart[idx].productQuantity = Math.min(cart[idx].productQuantity + quantity, stock);
            }
            localStorage.setItem("localCart", JSON.stringify(cart));
            this.cartItemsSubject$.next(this.cartItemsSubject$.value + quantity);
            this.toastService.show("Item added to temporary cart. Log in to save your cart.");
            return of(undefined);
        }

        return this.addProductToCart(productId, quantity, true).pipe(
            tap(() => {
                this.cartItemsSubject$.next(this.cartItemsSubject$.value + quantity);
                this.toastService.show("Item has been added to cart", "success");
            }),
            catchError((err) => {
                this.toastService.show(err.error?.message ?? "Failed to add to cart", "warn");
                return EMPTY;
            }),
            map(() => undefined),
        );
    }

    public updateCartBadge() {
        const localCart = localStorage.getItem("localCart");
        if (localCart) {
            const parsedLocalCart: { productId: number; productQuantity: number }[] = JSON.parse(localCart);
            this.cartItemsSubject$.next(
                parsedLocalCart.reduce((acc, curr) => {
                    return acc + curr.productQuantity;
                }, 0)
            );
        } else {
            this.cartItemsSubject$.next(0);
        }
    }
}
