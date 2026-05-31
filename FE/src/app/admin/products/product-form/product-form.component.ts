import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { CurrencyPipe } from "@angular/common";
import { Subscription, take } from "rxjs";
import { ButtonModule } from "primeng/button";
import { DrawerModule } from "primeng/drawer";
import { SelectModule } from "primeng/select";
import { InputTextModule } from "primeng/inputtext";
import { InputNumberModule } from "primeng/inputnumber";
import { TextareaModule } from "primeng/textarea";
import { ToggleSwitchModule } from "primeng/toggleswitch";
import { DialogModule } from "primeng/dialog";
import { AdminProduct } from "../../models/admin-products.models";
import { AdminProductsService } from "../../services/admin-products.service";
import { ProductsService } from "../../../services/products.service";
import { ToastService } from "../../../services/toast.service";
import { productCategory } from "../../../models/products.models";

export type ProductFormMode = "create" | "edit" | "copy";

@Component({
    selector: "app-product-form",
    standalone: true,
    imports: [
        ReactiveFormsModule,
        CurrencyPipe,
        ButtonModule,
        DrawerModule,
        SelectModule,
        InputTextModule,
        InputNumberModule,
        TextareaModule,
        ToggleSwitchModule,
        DialogModule,
    ],
    templateUrl: "./product-form.component.html",
    styleUrl: "./product-form.component.scss",
})
export class ProductFormComponent implements OnDestroy {
    @Output() saved = new EventEmitter<AdminProduct>();

    visible = false;
    showDiscardConfirm = false;
    showStockZeroWarning = false;
    stockZeroCartCount = 0;
    stockZeroLoading = false;
    saving = false;
    mode: ProductFormMode = "create";
    categoryOptions: { label: string; value: number }[] = [];

    form!: FormGroup;
    private editingId: number | null = null;
    private originalStock: number | null = null;
    private pendingSavePayload: Record<string, unknown> | null = null;
    private skipDirtyCheck = false;
    private stockSub?: Subscription;

    get drawerTitle(): string {
        return { create: "New Product", edit: "Edit Product", copy: "Copy Product" }[this.mode];
    }

    get finalPricePreview(): number {
        const sp = this.form?.get("supplyPrice")?.value ?? 0;
        const m = this.form?.get("margin")?.value ?? 0;
        return +(sp * (1 + m / 100)).toFixed(2);
    }

    constructor(
        private fb: FormBuilder,
        private adminProductsService: AdminProductsService,
        private productsService: ProductsService,
        private toastService: ToastService,
    ) {
        this.buildForm();
    }

    open(mode: ProductFormMode, product?: AdminProduct) {
        this.mode = mode;
        this.editingId = mode === "edit" ? (product?.id ?? null) : null;
        this.originalStock = product?.stock ?? null;
        this.buildForm(product);
        this.visible = true;

        if (!this.categoryOptions.length) {
            this.productsService
                .getCategories()
                .pipe(take(1))
                .subscribe((cats: productCategory[]) => {
                    this.categoryOptions = cats.map((c) => ({ label: c.categoryName, value: c.id }));
                });
        }
    }

    onDrawerHide() {
        if (this.skipDirtyCheck) return;
        if (this.form?.dirty) {
            setTimeout(() => {
                this.visible = true;
                this.showDiscardConfirm = true;
            }, 0);
        }
    }

    requestClose() {
        if (this.form?.dirty) {
            this.showDiscardConfirm = true;
        } else {
            this.doClose();
        }
    }

    confirmDiscard() {
        this.showDiscardConfirm = false;
        this.doClose();
    }

    cancelDiscard() {
        this.showDiscardConfirm = false;
    }

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const payload = { ...this.form.getRawValue() };

        const settingStockToZero =
            this.mode === "edit" && this.editingId !== null && payload["stock"] === 0 && this.originalStock !== null && this.originalStock > 0;

        if (settingStockToZero) {
            this.pendingSavePayload = payload;
            this.stockZeroCartCount = 0;
            this.stockZeroLoading = true;
            this.showStockZeroWarning = true;
            this.adminProductsService
                .getCartCount(this.editingId!)
                .pipe(take(1))
                .subscribe({
                    next: (res) => {
                        this.stockZeroCartCount = res.cartCount;
                        this.stockZeroLoading = false;
                    },
                    error: () => {
                        this.stockZeroLoading = false;
                        this.showStockZeroWarning = false;
                        this.toastService.show("Failed to fetch cart info", "error");
                    },
                });
            return;
        }

        this.executeSave(payload);
    }

    confirmStockZeroSave() {
        this.showStockZeroWarning = false;
        if (this.pendingSavePayload) {
            this.executeSave(this.pendingSavePayload);
            this.pendingSavePayload = null;
        }
    }

    cancelStockZeroSave() {
        this.showStockZeroWarning = false;
        this.pendingSavePayload = null;
    }

    private executeSave(payload: Record<string, unknown>) {
        this.saving = true;

        const call =
            this.mode === "edit" && this.editingId !== null
                ? this.adminProductsService.updateProduct(this.editingId, payload)
                : this.adminProductsService.createProduct(payload);

        call.pipe(take(1)).subscribe({
            next: (product) => {
                this.saving = false;
                this.toastService.show(this.mode === "edit" ? "Product updated" : "Product created", "success");
                this.form.markAsPristine();
                this.doClose();
                this.saved.emit(product);
            },
            error: () => {
                this.saving = false;
                this.toastService.show("Failed to save product", "error");
            },
        });
    }

    onImageError(event: Event) {
        (event.target as HTMLImageElement).src = "https://s13emagst.akamaized.net/products/92844/92843211/images/res_dbe5508e65ad2167a08d5b3d0dc6b4fd.jpg";
    }

    private buildForm(product?: AdminProduct) {
        this.stockSub?.unsubscribe();

        const initialStock = product?.stock ?? null;
        const forceInactive = initialStock === 0;

        this.form = this.fb.group({
            name: [product ? (this.mode === "copy" ? product.name + " (Copy)" : product.name) : "", Validators.required],
            description: [product?.description ?? "", Validators.required],
            productCategoryId: [product?.productCategoryId ?? null, Validators.required],
            supplyPrice: [product?.supplyPrice ?? null, [Validators.required, Validators.min(0.01)]],
            margin: [product?.margin ?? 0, [Validators.required, Validators.min(0)]],
            stock: [initialStock, [Validators.required, Validators.min(0)]],
            imageUrl: [product?.imageUrl ?? ""],
            isActive: [{ value: forceInactive ? false : (product?.isActive ?? true), disabled: forceInactive }],
        });

        this.stockSub = this.form.get("stock")?.valueChanges.subscribe((stock: number | null) => {
            const isActiveCtrl = this.form.get("isActive");
            if (stock === 0) {
                isActiveCtrl?.setValue(false, { emitEvent: false });
                isActiveCtrl?.disable({ emitEvent: false });
            } else if (isActiveCtrl?.disabled) {
                isActiveCtrl?.enable({ emitEvent: false });
            }
        });
    }

    private doClose() {
        this.skipDirtyCheck = true;
        this.visible = false;
        setTimeout(() => {
            this.skipDirtyCheck = false;
        }, 100);
    }

    ngOnDestroy() {
        this.stockSub?.unsubscribe();
    }
}
