import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { CreateAddressComponent } from "../create-address/create-address.component";
import { ButtonModule } from "primeng/button";
import { SelectModule } from "primeng/select";
import { FloatLabel } from "primeng/floatlabel";
import { MessageModule } from "primeng/message";
import { InputTextModule } from "primeng/inputtext";
import { TooltipModule } from "primeng/tooltip";
import { address } from "../../models/address.models";
import { AddressService } from "../../services/address.service";
import { firstValueFrom, Subject, take, takeUntil } from "rxjs";
import { FormsModule } from "@angular/forms";
import { CartService } from "../../services/cart.service";
import { Stripe, StripeCardElement } from "@stripe/stripe-js";

@Component({
    selector: "app-process-order",
    imports: [
        FormsModule,
        CreateAddressComponent,
        MessageModule,
        ButtonModule,
        SelectModule,
        FloatLabel,
        InputTextModule,
        TooltipModule,
    ],
    templateUrl: "./process-order.component.html",
    styleUrl: "./process-order.component.scss",
    standalone: true,
})
export class ProcessOrderComponent implements OnInit, OnDestroy {
    @Output() paymentComplete = new EventEmitter<void>();

    private stripe: Stripe | null = null;
    private cardElement: StripeCardElement | null = null;
    private destroy$ = new Subject<void>();

    public currentStep = 1;
    public hasUnavailableItems = false;
    public addresses: address[] = [];
    public selectedAddress: address | null = null;
    public isProcessing = false;
    public cardComplete = false;
    public cardError: string | null = null;

    public cartSubtotal = 0;
    public discountCodeInput = "";
    public appliedDiscount: { code: string; percentage: number } | null = null;
    public discountError: string | null = null;
    public isValidatingCode = false;

    get discountAmount(): number {
        if (!this.appliedDiscount) return 0;
        return this.cartSubtotal * (this.appliedDiscount.percentage / 100);
    }

    get cartTotal(): number {
        return this.cartSubtotal - this.discountAmount;
    }

    constructor(private addressService: AddressService, private cartService: CartService) {}

    ngOnInit(): void {
        this.cartService.getStripe().then((stripe) => {
            this.stripe = stripe;
        });
        this.cartService.unavailableItems$.pipe(takeUntil(this.destroy$)).subscribe((val) => {
            this.hasUnavailableItems = val;
        });
        this.fetchAddresses();
        this.cartService.getCartProducts().pipe(take(1)).subscribe((res) => {
            this.cartSubtotal = res.totalPrice ?? 0;
            if (res.discount) {
                this.appliedDiscount = { code: res.discount.code, percentage: res.discount.percentage };
                this.discountCodeInput = res.discount.code;
            }
            this.cartService.discountSubject$.next(res.discount ?? null);
        });
    }

    ngOnDestroy(): void {
        this.cardElement?.destroy();
        this.destroy$.next();
        this.destroy$.complete();
    }

    fetchAddresses() {
        this.addressService
            .getAddresses()
            .pipe(take(1))
            .subscribe((res) => {
                this.addresses = res;
                this.selectedAddress = res.find((a) => a.isDefault) ?? null;
            });
    }

    onAddressCreate() {
        this.fetchAddresses();
    }

    applyDiscountCode() {
        const code = this.discountCodeInput.trim().toUpperCase();
        if (!code) return;

        this.isValidatingCode = true;
        this.discountError = null;
        this.appliedDiscount = null;

        this.cartService.validateDiscountCode(code).pipe(take(1)).subscribe({
            next: (res) => {
                this.appliedDiscount = { code: res.code, percentage: res.discountPercentage };
                this.cartService.discountSubject$.next(this.appliedDiscount);
                this.isValidatingCode = false;
            },
            error: (err) => {
                this.discountError = err.error?.message ?? "Invalid discount code";
                this.isValidatingCode = false;
            },
        });
    }

    removeDiscount() {
        this.cartService.removeDiscountCode().pipe(take(1)).subscribe({
            next: () => {
                this.appliedDiscount = null;
                this.discountCodeInput = "";
                this.discountError = null;
                this.cartService.discountSubject$.next(null);
            },
            error: (err) => {
                this.discountError = err?.error?.message ?? "Failed to remove discount code. Please try again.";
            },
        });
    }

    onProceedToPayment() {
        this.currentStep = 2;
        setTimeout(() => this.mountCardElement(), 0);
    }

    goBack() {
        this.currentStep = 1;
        this.cardComplete = false;
        this.cardError = null;
        this.cardElement?.destroy();
        this.cardElement = null;
    }

    private mountCardElement() {
        if (!this.stripe || this.cardElement) return;
        const elements = this.stripe.elements();
        this.cardElement = elements.create("card", {
            style: {
                base: {
                    fontSize: "16px",
                    fontFamily: "inherit",
                    color: "#495057",
                    "::placeholder": { color: "#6c757d" },
                },
                invalid: { color: "#dc3545" },
            },
            hidePostalCode: true
        });
        this.cardElement.mount("#card-element");
        this.cardElement.on("change", (event) => {
            this.cardComplete = event.complete;
            this.cardError = event.error?.message ?? null;
        });
    }

    async handlePayment() {
        if (!this.stripe || !this.cardElement || !this.selectedAddress?.id || this.isProcessing) return;

        this.isProcessing = true;
        this.cardError = null;

        try {
            const { clientSecret } = await firstValueFrom(
                this.cartService.initiatePayment(this.selectedAddress.id)
            );

            const { error, paymentIntent } = await this.stripe.confirmCardPayment(clientSecret, {
                payment_method: { card: this.cardElement },
            });

            if (error) {
                this.cardError = error.message ?? "Payment failed";
            } else if (paymentIntent?.status === "succeeded") {
                this.paymentComplete.emit();
            }
        } catch (err: any) {
            const errors: string[] | undefined = err?.error?.errors;
            const message = errors?.length ? errors.join(" ") : (err?.error?.message ?? "An unexpected error occurred");
            if (err?.error?.message === "Your discount code has expired and has been removed.") {
                this.appliedDiscount = null;
                this.discountCodeInput = "";
                this.cartService.discountSubject$.next(null);
            }
            this.cardError = message;
        } finally {
            this.isProcessing = false;
        }
    }
}
