import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CurrencyPipe, DatePipe } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import { debounceTime, distinctUntilChanged, Subject, take, takeUntil } from "rxjs";
import { ButtonModule } from "primeng/button";
import { TableModule, Table, TableLazyLoadEvent } from "primeng/table";
import { InputTextModule } from "primeng/inputtext";
import { IconFieldModule } from "primeng/iconfield";
import { InputIconModule } from "primeng/inputicon";
import { DialogModule } from "primeng/dialog";
import { SelectModule } from "primeng/select";
import { TooltipModule } from "primeng/tooltip";
import { SkeletonModule } from "primeng/skeleton";
import { TagModule } from "primeng/tag";
import { PasswordModule } from "primeng/password";
import { AdminUsersService } from "../services/admin-users.service";
import { AdminCustomer, AdminUser, CustomerOrder, AdminCustomersParams } from "../models/admin-users.models";
import { OrderStatus, ORDER_STATUS_LABEL, ORDER_STATUS_SEVERITY } from "../../storefront/models/order.models";
import { ToastService } from "../../shared/services/toast.service";

@Component({
    selector: "app-admin-users",
    standalone: true,
    imports: [
        FormsModule,
        CurrencyPipe,
        DatePipe,
        ButtonModule,
        TableModule,
        InputTextModule,
        IconFieldModule,
        InputIconModule,
        DialogModule,
        SelectModule,
        TooltipModule,
        SkeletonModule,
        TagModule,
        PasswordModule,
    ],
    templateUrl: "./users.component.html",
    styleUrl: "./users.component.scss",
})
export class UsersComponent implements OnInit, OnDestroy {
    @ViewChild("dt") dt!: Table;

    section: "customers" | "admins" = "customers";

    // ── Customers ─────────────────────────────────────────────────
    customers: AdminCustomer[] = [];
    totalCustomers = 0;
    loadingCustomers = true;
    pageNumber = 0;
    itemsPerPage = 20;
    searchValue = "";
    sortBy = "joined";
    sortDir: "asc" | "desc" = "desc";

    readonly sortOptions = [
        { label: "Joined", value: "joined" },
        { label: "Orders", value: "orders" },
        { label: "Total Spent", value: "spent" },
    ];

    // ── Row expansion ─────────────────────────────────────────────
    expandedRows: any = {};
    customerOrders: { [id: number]: CustomerOrder[] } = {};
    customerOrdersLoading: { [id: number]: boolean } = {};

    // ── Admins ────────────────────────────────────────────────────
    admins: AdminUser[] = [];
    loadingAdmins = true;

    // ── Create Admin dialog ───────────────────────────────────────
    showCreateAdmin = false;
    adminEmail = "";
    adminPassword = "";
    adminConfirm = "";
    creatingAdmin = false;
    createErrors: string[] = [];

    // ── Change Password dialog ────────────────────────────────────
    showChangePassword = false;
    currentPassword = "";
    newPassword = "";
    confirmPassword = "";
    changingPassword = false;
    passwordErrors: string[] = [];

    private searchSubject = new Subject<string>();
    private destroy$ = new Subject<void>();

    constructor(
        private route: ActivatedRoute,
        private usersService: AdminUsersService,
        private toastService: ToastService,
        private router: Router,
    ) {}

    ngOnInit() {
        this.section = this.route.snapshot.data["section"] ?? "customers";
        if (this.section === "customers") {
            this.searchSubject.pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());
        } else {
            this.loadAdmins();
        }
    }

    // ── Customers ─────────────────────────────────────────────────

    onLazyLoad(event: TableLazyLoadEvent) {
        this.pageNumber = Math.floor((event.first ?? 0) / (event.rows ?? this.itemsPerPage));
        this.itemsPerPage = event.rows ?? this.itemsPerPage;
        this.loadCustomers();
    }

    loadCustomers() {
        this.loadingCustomers = true;
        const params: AdminCustomersParams = {
            pageNumber: this.pageNumber,
            itemsPerPage: this.itemsPerPage,
            sortBy: this.sortBy,
            sortDir: this.sortDir,
        };
        if (this.searchValue.trim()) params.search = this.searchValue.trim();

        this.usersService
            .getCustomers(params)
            .pipe(take(1))
            .subscribe({
                next: (res) => {
                    this.customers = res.data;
                    this.totalCustomers = res.meta.totalItems;
                    this.loadingCustomers = false;
                    this.expandedRows = {};
                },
                error: () => {
                    this.loadingCustomers = false;
                    this.toastService.show("Failed to load customers", "error");
                },
            });
    }

    onSearchChange(value: string) {
        this.searchSubject.next(value);
    }

    applyFilters() {
        this.resetAndLoad();
    }

    toggleSortDir() {
        this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
        this.resetAndLoad();
    }

    clearCustomerFilters() {
        this.searchValue = "";
        this.sortBy = "joined";
        this.sortDir = "desc";
        this.resetAndLoad();
    }

    get hasCustomerFilters(): boolean {
        return !!(this.searchValue || this.sortBy !== "joined" || this.sortDir !== "desc");
    }

    // ── Row expansion ─────────────────────────────────────────────

    onRowExpand(event: { data: AdminCustomer }) {
        const id = event.data.id;
        if (!this.customerOrders[id]) {
            this.customerOrdersLoading[id] = true;
            this.usersService
                .getCustomerOrders(id)
                .pipe(take(1))
                .subscribe({
                    next: (orders) => {
                        this.customerOrders[id] = orders;
                        this.customerOrdersLoading[id] = false;
                    },
                    error: () => {
                        this.customerOrdersLoading[id] = false;
                    },
                });
        }
    }

    viewInOrders(email: string) {
        this.router.navigate(["/admin/orders"], { queryParams: { search: email } });
    }

    orderStatusLabel(status: number): string {
        return ORDER_STATUS_LABEL[status as OrderStatus] ?? "Unknown";
    }

    orderStatusSeverity(status: number): "warn" | "info" | "secondary" | "success" | "danger" {
        return ORDER_STATUS_SEVERITY[status as OrderStatus] ?? "secondary";
    }

    // ── Admins ────────────────────────────────────────────────────

    loadAdmins() {
        this.loadingAdmins = true;
        this.usersService
            .getAdmins()
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.admins = data;
                    this.loadingAdmins = false;
                },
                error: () => {
                    this.loadingAdmins = false;
                    this.toastService.show("Failed to load admin accounts", "error");
                },
            });
    }

    // ── Create Admin ──────────────────────────────────────────────

    openCreateAdmin() {
        this.adminEmail = "";
        this.adminPassword = "";
        this.adminConfirm = "";
        this.createErrors = [];
        this.showCreateAdmin = true;
    }

    private readonly passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    private readonly passwordRequirement =
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character (!@#$%^&*).";

    submitCreateAdmin() {
        this.createErrors = [];
        if (!this.adminEmail.trim()) this.createErrors.push("Email is required");
        if (!this.adminPassword) this.createErrors.push("Password is required");
        else if (!this.passwordPattern.test(this.adminPassword)) this.createErrors.push(this.passwordRequirement);
        if (this.adminPassword && this.adminPassword !== this.adminConfirm) this.createErrors.push("Passwords do not match");
        if (this.createErrors.length) return;

        this.creatingAdmin = true;
        this.usersService
            .createAdmin(this.adminEmail.trim(), this.adminPassword)
            .pipe(take(1))
            .subscribe({
                next: () => {
                    this.toastService.show("Admin account created", "success");
                    this.showCreateAdmin = false;
                    this.creatingAdmin = false;
                    this.loadAdmins();
                },
                error: (err) => {
                    this.createErrors = [err?.error?.message ?? "Failed to create admin account"];
                    this.creatingAdmin = false;
                },
            });
    }

    // ── Change Password ───────────────────────────────────────────

    openChangePassword() {
        this.currentPassword = "";
        this.newPassword = "";
        this.confirmPassword = "";
        this.passwordErrors = [];
        this.showChangePassword = true;
    }

    submitChangePassword() {
        this.passwordErrors = [];
        if (!this.currentPassword) this.passwordErrors.push("Current password is required");
        if (!this.newPassword) this.passwordErrors.push("New password is required");
        else if (!this.passwordPattern.test(this.newPassword)) this.passwordErrors.push(this.passwordRequirement);
        if (this.newPassword && this.newPassword !== this.confirmPassword) this.passwordErrors.push("Passwords do not match");
        if (this.passwordErrors.length) return;

        this.changingPassword = true;
        this.usersService
            .changePassword(this.currentPassword, this.newPassword)
            .pipe(take(1))
            .subscribe({
                next: () => {
                    this.toastService.show("Password updated successfully", "success");
                    this.showChangePassword = false;
                    this.changingPassword = false;
                    this.currentPassword = "";
                    this.newPassword = "";
                    this.confirmPassword = "";
                },
                error: (err) => {
                    this.passwordErrors = [err?.error?.message ?? "Failed to update password"];
                    this.changingPassword = false;
                },
            });
    }

    private resetAndLoad() {
        this.pageNumber = 0;
        if (this.dt) this.dt.first = 0;
        this.loadCustomers();
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
