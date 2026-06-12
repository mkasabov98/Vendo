import { Component, EventEmitter, inject, OnInit, OnDestroy, Output } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { Button } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { DrawerModule } from "primeng/drawer";
import { ToastService } from "../../shared/services/toast.service";
import { AuthService } from "../services/auth.service";
import { FloatLabel } from "primeng/floatlabel";
import { InputTextModule } from "primeng/inputtext";
import { concatMap, map, of, Subject, take, takeUntil, tap } from "rxjs";
import { PasswordModule } from "primeng/password";
import { CartService } from "../../storefront/services/cart.service";
import { UserRoles } from "../models/auth.models";
import { BreakpointObserver } from "@angular/cdk/layout";

@Component({
    selector: "app-login",
    imports: [Button, DialogModule, DrawerModule, ReactiveFormsModule, FloatLabel, InputTextModule, PasswordModule],
    providers: [ToastService],
    templateUrl: "./login.component.html",
    styleUrl: "./login.component.scss",
    standalone: true,
})
export class LoginComponent implements OnInit, OnDestroy {
    private formBuilder = inject(FormBuilder);
    private destroy$ = new Subject<void>();

    @Output() loginSuccess = new EventEmitter<void>();

    public visible = false;
    public isLoading = false;
    public isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

    public loginForm: FormGroup = this.formBuilder.group({
        email: ["", Validators.required],
        password: ["", Validators.required],
    });

    constructor(
        private authService: AuthService,
        private toastService: ToastService,
        private cartService: CartService,
        private breakpointObserver: BreakpointObserver,
        private router: Router,
    ) {}

    ngOnInit() {
        this.breakpointObserver
            .observe(["(max-width: 768px)"])
            .pipe(takeUntil(this.destroy$))
            .subscribe((result) => (this.isMobile = result.matches));
    }

    onHideDialog() {
        this.loginForm.reset();
        this.isLoading = false;
    }

    onFormSubmit() {
        if (this.isLoading) return;
        this.isLoading = true;
        this.authService
            .login({
                email: this.loginForm.controls["email"].value,
                password: this.loginForm.controls["password"].value,
            })
            .pipe(
                take(1),
                tap((res) => {
                    this.visible = false;
                    this.loginSuccess.emit();
                    this.toastService.show("Successful login", "success");
                    if (res.role === UserRoles.Admin) {
                        this.router.navigate(['/admin/dashboard']);
                    }
                }),
                concatMap((res) => {
                    const isUser = res.role === UserRoles.User;
                    const localCart = localStorage.getItem("localCart");
                    if (isUser) localStorage.removeItem("localCart");

                    if (localCart && isUser) {
                        return this.cartService.updateCart(JSON.parse(localCart)).pipe(
                            map((updateCartRes) => ({ isUser, updated: true, updateCartRes }))
                        );
                    }
                    if (!localCart && isUser) return of({ isUser, updated: false, updateCartRes: null });
                    return of({ isUser: false, updated: false, updateCartRes: null });
                }),
                concatMap((res) => {
                    if (res.isUser) {
                        if (res.updated) this.toastService.show(res.updateCartRes?.message!, "info");
                        return this.cartService.getCartProducts();
                    }
                    return of(null);
                })
            )
            .subscribe(
                (res) => {
                    if (res) {
                        this.cartService.cartItemsSubject$.next(
                            res.items.reduce((acc, curr) => acc + curr.quantity!, 0)
                        );
                        this.cartService.cartSynced$.next(res);
                    }
                    this.isLoading = false;
                },
                (error) => {
                    this.toastService.show(error.error.message, error.error.typeOfToast ?? "error");
                    this.isLoading = false;
                }
            );
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
