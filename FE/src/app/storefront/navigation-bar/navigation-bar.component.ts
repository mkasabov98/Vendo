import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { AuthService } from "../../auth/services/auth.service";
import { debounceTime, distinctUntilChanged, filter, Subject, takeUntil } from "rxjs";
import { RegisterComponent } from "../../auth/register/register.component";
import { LoginComponent } from "../../auth/login/login.component";
import { loggedUser, UserRoles } from "../../auth/models/auth.models";
import { NO_USER } from "../../shared/constants/constants";
import { Button } from "primeng/button";
import { ToastService } from "../../shared/services/toast.service";
import { NavigationEnd, Router, RouterLink } from "@angular/router";
import { BadgeModule } from "primeng/badge";
import { OverlayBadgeModule } from "primeng/overlaybadge";
import { CartService } from "../services/cart.service";
import { ToolbarModule } from "primeng/toolbar";
import { IconFieldModule } from "primeng/iconfield";
import { InputIconModule } from "primeng/inputicon";
import { InputTextModule } from "primeng/inputtext";
import { ProductsService } from "../services/products.service";
import { FormsModule } from "@angular/forms";
import { DrawerModule } from "primeng/drawer";
import { BreakpointObserver } from "@angular/cdk/layout";

@Component({
    selector: "app-navigation-bar",
    imports: [
        RegisterComponent, LoginComponent, Button, RouterLink,
        BadgeModule, OverlayBadgeModule, ToolbarModule,
        IconFieldModule, InputIconModule, InputTextModule,
        FormsModule, DrawerModule,
    ],
    templateUrl: "./navigation-bar.component.html",
    styleUrl: "./navigation-bar.component.scss",
    standalone: true,
})
export class NavigationBarComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();
    private inputSubject = new Subject<string>();

    public searchString = "";
    public UserRoles = UserRoles;
    public NO_USER = NO_USER;
    public loggedUser: loggedUser = NO_USER;
    public cartItems = 0;
    public isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    public mobileMenuOpen = false;

    @ViewChild('mobileSearchInput') mobileSearchInput?: ElementRef<HTMLInputElement>;

    private _mobileSearchOpen = false;
    get mobileSearchOpen() { return this._mobileSearchOpen; }
    set mobileSearchOpen(val: boolean) {
        this._mobileSearchOpen = val;
        document.documentElement.style.setProperty('--search-bar-offset', val ? '64px' : '0px');
        if (val) {
            setTimeout(() => this.mobileSearchInput?.nativeElement?.focus(), 150);
        }
    }

    constructor(
        private authService: AuthService,
        private toastService: ToastService,
        private cartService: CartService,
        private productsService: ProductsService,
        private breakpointObserver: BreakpointObserver,
        public router: Router,
    ) {}

    ngOnInit() {
        this.breakpointObserver
            .observe(["(max-width: 768px)"])
            .pipe(takeUntil(this.destroy$))
            .subscribe((result) => {
                this.isMobile = result.matches;
                if (!this.isMobile) {
                    this.mobileMenuOpen = false;
                    this.mobileSearchOpen = false; // also resets --search-bar-offset via setter
                }
            });

        this.authService.loggedUserSubject.pipe(takeUntil(this.destroy$)).subscribe((res) => {
            this.loggedUser = res;
        });

        this.cartService.cartItemsSubject$.pipe(takeUntil(this.destroy$)).subscribe((res) => {
            this.cartItems = res;
        });

        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.mobileSearchOpen = false;
            this.searchString = this.productsService.filtersSubject.getValue().searchString;
        });

        this.inputSubject
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
            .subscribe((searchString) => {
                this.searchString = searchString;
                this.productsService.filtersSubject.next({
                    ...this.productsService.filtersSubject.getValue(),
                    searchString,
                });
                if (searchString && this.router.url.startsWith('/e-com/product/')) {
                    this.router.navigate(['/e-com']);
                }
            });
    }

    get showSearch(): boolean {
        return this.router.url === '/e-com' || this.router.url.startsWith('/e-com/product/');
    }

    onInputChange(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.inputSubject.next(value);
    }

    goHome() {
        this.productsService.filtersSubject.next({
            categories: [],
            sortBy: undefined,
            searchString: "",
        });
        this.router.navigate(['/e-com']);
    }

    onSearchEnter() {
        if (this.router.url.startsWith('/e-com/product/')) {
            this.router.navigate(['/e-com']);
        }
    }

    fireMobileSearch() {
        this.mobileSearchInput?.nativeElement?.blur();
        this.productsService.filtersSubject.next({
            ...this.productsService.filtersSubject.getValue(),
            searchString: this.searchString,
        });
        if (this.searchString && this.router.url.startsWith('/e-com/product/')) {
            this.router.navigate(['/e-com']);
        }
        this.mobileSearchOpen = false;
    }

    clearInput() {
        if (!this.searchString) return;
        this.searchString = "";
        this.productsService.filtersSubject.next({
            ...this.productsService.filtersSubject.getValue(),
            searchString: "",
        });
    }

    logOut() {
        this.authService.loggedUserSubject.next(NO_USER);
        localStorage.removeItem("jwt");
        this.cartService.cartItemsSubject$.next(0);
        this.cartService.updateCartBadge();
        this.toastService.show("You have logged out.");
        this.mobileMenuOpen = false;
        this.router.navigate(["/"]);
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
