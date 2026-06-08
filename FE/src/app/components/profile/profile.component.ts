import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from "@angular/forms";
import { AccordionModule } from "primeng/accordion";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { SkeletonModule } from "primeng/skeleton";
import { TabsModule } from "primeng/tabs";
import { ButtonModule } from "primeng/button";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { FloatLabelModule } from "primeng/floatlabel";
import { PasswordModule } from "primeng/password";
import { TooltipModule } from "primeng/tooltip";
import { ConfirmationService } from "primeng/api";
import { Order, ORDER_STATUS_LABEL, ORDER_STATUS_SEVERITY, OrderStatus } from "../../models/order.models";
import { OrderService } from "../../services/order.service";
import { address } from "../../models/address.models";
import { AddressService } from "../../services/address.service";
import { AuthService } from "../../services/auth.service";
import { CartService } from "../../services/cart.service";
import { ToastService } from "../../services/toast.service";
import { CreateAddressComponent } from "../create-address/create-address.component";
import { catchError, forkJoin, of, take } from "rxjs";

@Component({
    selector: "app-profile",
    imports: [
        CommonModule,
        ReactiveFormsModule,
        AccordionModule,
        TableModule,
        TagModule,
        SkeletonModule,
        TabsModule,
        ButtonModule,
        ConfirmDialogModule,
        FloatLabelModule,
        PasswordModule,
        TooltipModule,
        CreateAddressComponent,
    ],
    providers: [ConfirmationService],
    templateUrl: "./profile.component.html",
    styleUrl: "./profile.component.scss",
    standalone: true,
})
export class ProfileComponent implements OnInit {
    public orders: Order[] = [];
    public addresses: address[] = [];
    public isLoading = true;
    public addressesLoading = true;
    public reOrderingId: number | null = null;

    public submittingPassword = false;
    public passwordForm = new FormGroup(
        {
            currentPassword: new FormControl("", [Validators.required]),
            newPassword: new FormControl("", [
                Validators.required,
                Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/),
            ]),
            confirmPassword: new FormControl("", [Validators.required]),
        },
        { validators: this.passwordsMatchValidator },
    );

    private passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
        const newPw = group.get("newPassword")?.value;
        const confirm = group.get("confirmPassword")?.value;
        return newPw && confirm && newPw !== confirm ? { passwordsMismatch: true } : null;
    }

    constructor(
        private orderService: OrderService,
        private addressService: AddressService,
        private authService: AuthService,
        private cartService: CartService,
        private toastService: ToastService,
        private confirmationService: ConfirmationService,
        private router: Router,
    ) {}

    ngOnInit(): void {
        this.orderService
            .getOrders()
            .pipe(take(1))
            .subscribe({
                next: (orders) => {
                    this.orders = orders;
                    this.isLoading = false;
                },
                error: () => {
                    this.isLoading = false;
                },
            });
        this.fetchAddresses();
    }

    fetchAddresses() {
        this.addressesLoading = true;
        this.addressService
            .getAddresses()
            .pipe(take(1))
            .subscribe({
                next: (res) => {
                    this.addresses = res;
                    this.addressesLoading = false;
                },
                error: () => {
                    this.addressesLoading = false;
                },
            });
    }

    onAddressCreated() {
        this.fetchAddresses();
    }

    confirmDeleteAddress(id: number) {
        this.confirmationService.confirm({
            message: "Are you sure you want to delete this address?",
            header: "Delete Address",
            icon: "pi pi-exclamation-triangle",
            rejectButtonProps: { label: "Cancel", severity: "secondary", outlined: true },
            acceptButtonProps: { label: "Delete", severity: "danger" },
            accept: () => this.deleteAddress(id),
        });
    }

    deleteAddress(id: number) {
        this.addressService
            .deleteAddress(id)
            .pipe(take(1))
            .subscribe({
                next: () => {
                    this.addresses = this.addresses.filter((a) => a.id !== id);
                    this.toastService.show("Address deleted.", "success");
                },
                error: (err) => this.toastService.show(err.error?.message ?? "Failed to delete address", "warn"),
            });
    }

    setDefaultAddress(id: number) {
        this.addressService
            .setDefaultAddress(id)
            .pipe(take(1))
            .subscribe({
                next: () => {
                    this.addresses = this.addresses.map((a) => ({ ...a, isDefault: a.id === id }));
                    this.toastService.show("Default address updated.", "success");
                },
                error: (err) => this.toastService.show(err.error?.message ?? "Failed to update default address", "warn"),
            });
    }

    reOrder(order: Order) {
        if (this.reOrderingId !== null) return;
        this.reOrderingId = order.id;

        const calls = order.products.map((p) => this.cartService.addProductToCart(p.productId, p.quantity, true).pipe(catchError(() => of(null))));

        forkJoin(calls)
            .pipe(take(1))
            .subscribe({
                next: (results) => {
                    const failed = results.filter((r) => r === null).length;
                    const addedQty = order.products.filter((_, i) => results[i] !== null).reduce((acc, p) => acc + p.quantity, 0);

                    this.cartService.cartItemsSubject$.next(this.cartService.cartItemsSubject$.value + addedQty);

                    if (failed === 0) {
                        this.toastService.show("All items added to cart!", "success");
                    } else {
                        this.toastService.show(`${results.length - failed} item(s) added. ${failed} item(s) are out of stock.`, "warn");
                    }
                    this.reOrderingId = null;
                },
            });
    }

    get paidOrders(): Order[] {
        return this.orders.filter((o) => o.status >= 1 && o.status <= 3);
    }

    get totalSpent(): number {
        return this.paidOrders.reduce((acc, o) => acc + Number(o.totalAmount), 0);
    }

    get averageOrderValue(): number {
        return this.paidOrders.length ? this.totalSpent / this.paidOrders.length : 0;
    }

    navigateToProduct(productId: number) {
        this.router.navigate(["/e-com/product", productId]);
    }

    reviewProduct(productId: number) {
        this.router.navigate(["/e-com/product", productId], { queryParams: { tab: "reviews" } });
    }

    onImageError(event: Event) {
        (event.target as HTMLImageElement).src = "https://placehold.co/400x300?text=No+Image";
    }

    changePassword() {
        if (this.passwordForm.invalid || this.submittingPassword) return;
        const { currentPassword, newPassword } = this.passwordForm.value;
        this.submittingPassword = true;
        this.authService
            .changePassword(currentPassword!, newPassword!)
            .pipe(take(1))
            .subscribe({
                next: () => {
                    this.toastService.show("Password updated successfully.", "success");
                    this.passwordForm.reset();
                    this.submittingPassword = false;
                },
                error: (err) => {
                    this.toastService.show(err.error?.message ?? "Failed to update password", "warn");
                    this.submittingPassword = false;
                },
            });
    }

    getStatusLabel(status: OrderStatus): string {
        return ORDER_STATUS_LABEL[status] ?? "Unknown";
    }

    getStatusSeverity(status: OrderStatus): "warn" | "info" | "secondary" | "success" | "danger" {
        return ORDER_STATUS_SEVERITY[status] ?? "secondary";
    }
}
