import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CurrencyPipe, DatePipe } from "@angular/common";
import { debounceTime, distinctUntilChanged, Subject, take, takeUntil } from "rxjs";
import { ButtonModule } from "primeng/button";
import { SelectModule } from "primeng/select";
import { TableModule, Table, TableLazyLoadEvent } from "primeng/table";
import { TagModule } from "primeng/tag";
import { InputTextModule } from "primeng/inputtext";
import { IconFieldModule } from "primeng/iconfield";
import { InputIconModule } from "primeng/inputicon";
import { TooltipModule } from "primeng/tooltip";
import { DialogModule } from "primeng/dialog";
import { DrawerModule } from "primeng/drawer";
import { DatePickerModule } from "primeng/datepicker";
import { SkeletonModule } from "primeng/skeleton";
import { AdminOrdersService, AdminOrdersParams } from "../services/admin-orders.service";
import { AdminOrderDetail, AdminOrderListItem, canTransitionTo, OrderStatus, ORDER_STATUS_LABEL, ORDER_STATUS_SEVERITY } from "../models/admin-orders.models";
import { ToastService } from "../../services/toast.service";

@Component({
    selector: "app-admin-orders",
    standalone: true,
    imports: [
        FormsModule,
        CurrencyPipe,
        DatePipe,
        ButtonModule,
        SelectModule,
        TableModule,
        TagModule,
        InputTextModule,
        IconFieldModule,
        InputIconModule,
        TooltipModule,
        DialogModule,
        DrawerModule,
        DatePickerModule,
        SkeletonModule,
    ],
    templateUrl: "./orders.component.html",
    styleUrl: "./orders.component.scss",
})
export class OrdersComponent implements OnInit, OnDestroy {
    @ViewChild("dt") dt!: Table;

    orders: AdminOrderListItem[] = [];
    totalRecords = 0;
    loading = true;

    pageNumber = 0;
    itemsPerPage = 20;

    searchValue = "";
    statusFilter = "all";
    dateRange: Date[] | null = null;
    sortBy = "createdAt";
    sortDir: "asc" | "desc" = "desc";

    drawerVisible = false;
    detailLoading = false;
    selectedOrder: AdminOrderDetail | null = null;

    pendingStatus: OrderStatus | null = null;
    showConfirm = false;
    statusUpdateLoading = false;

    readonly today = new Date();

    readonly statusOptions = [
        { label: "All Orders", value: "all" },
        { label: "Pending", value: "0" },
        { label: "Paid", value: "1" },
        { label: "Shipped", value: "2" },
        { label: "Delivered", value: "3" },
        { label: "Cancelled", value: "4" },
    ];

    readonly sortByOptions = [
        { label: "Date", value: "createdAt" },
        { label: "Total", value: "totalAmount" },
        { label: "Status", value: "status" },
    ];

    readonly STEPPER_STEPS = [
        { status: OrderStatus.Pending, label: "Pending" },
        { status: OrderStatus.Paid, label: "Paid" },
        { status: OrderStatus.Shipped, label: "Shipped" },
        { status: OrderStatus.Delivered, label: "Delivered" },
    ];

    readonly OrderStatus = OrderStatus;

    private searchSubject = new Subject<string>();
    private destroy$ = new Subject<void>();

    constructor(
        private ordersService: AdminOrdersService,
        private toastService: ToastService,
    ) {}

    ngOnInit() {
        this.searchSubject.pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());
    }

    onLazyLoad(event: TableLazyLoadEvent) {
        this.pageNumber = Math.floor((event.first ?? 0) / (event.rows ?? this.itemsPerPage));
        this.itemsPerPage = event.rows ?? this.itemsPerPage;
        this.loadOrders();
    }

    loadOrders() {
        this.loading = true;
        const params: AdminOrdersParams = {
            pageNumber: this.pageNumber,
            itemsPerPage: this.itemsPerPage,
            status: this.statusFilter,
            sortBy: this.sortBy,
            sortDir: this.sortDir,
        };
        if (this.searchValue.trim()) params.search = this.searchValue.trim();
        if (this.dateRange?.[0]) params.dateFrom = this.toISODate(this.dateRange[0]);
        if (this.dateRange?.[1]) params.dateTo = this.toISODate(this.dateRange[1]);

        this.ordersService
            .getOrders(params)
            .pipe(take(1))
            .subscribe({
                next: (res) => {
                    this.orders = res.data;
                    this.totalRecords = res.meta.totalItems;
                    this.loading = false;
                },
                error: () => {
                    this.loading = false;
                    this.toastService.show("Failed to load orders", "error");
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

    clearAll() {
        this.searchValue = "";
        this.statusFilter = "all";
        this.dateRange = null;
        this.sortBy = "createdAt";
        this.sortDir = "desc";
        this.resetAndLoad();
    }

    get hasActiveFilters(): boolean {
        return !!(this.searchValue || this.statusFilter !== "all" || this.dateRange?.[0] || this.sortBy !== "createdAt" || this.sortDir !== "desc");
    }

    openDrawer(order: AdminOrderListItem) {
        this.drawerVisible = true;
        this.detailLoading = true;
        this.selectedOrder = null;
        this.ordersService
            .getOrderDetail(order.id)
            .pipe(take(1))
            .subscribe({
                next: (detail) => {
                    this.selectedOrder = detail;
                    this.detailLoading = false;
                },
                error: () => {
                    this.detailLoading = false;
                    this.drawerVisible = false;
                    this.toastService.show("Failed to load order details", "error");
                },
            });
    }

    closeDrawer() {
        this.drawerVisible = false;
        this.selectedOrder = null;
        this.pendingStatus = null;
        this.showConfirm = false;
    }

    canTransitionTo(to: OrderStatus): boolean {
        if (!this.selectedOrder) return false;
        return canTransitionTo(this.selectedOrder.status, to);
    }

    requestStatusChange(status: OrderStatus) {
        this.pendingStatus = status;
        this.showConfirm = true;
    }

    cancelStatusChange() {
        this.pendingStatus = null;
        this.showConfirm = false;
    }

    confirmStatusChange() {
        if (!this.selectedOrder || this.pendingStatus === null) return;
        this.statusUpdateLoading = true;
        this.ordersService
            .updateOrderStatus(this.selectedOrder.id, this.pendingStatus)
            .pipe(take(1))
            .subscribe({
                next: ({ status }) => {
                    const row = this.orders.find((o) => o.id === this.selectedOrder!.id);
                    if (row) row.status = status;
                    this.selectedOrder!.status = status;
                    this.statusUpdateLoading = false;
                    this.showConfirm = false;
                    this.pendingStatus = null;
                    this.toastService.show(`Order #${this.selectedOrder!.id} marked as ${ORDER_STATUS_LABEL[status]}`, "success");
                },
                error: () => {
                    this.statusUpdateLoading = false;
                    this.toastService.show("Failed to update order status", "error");
                },
            });
    }

    get confirmMessage(): string {
        if (!this.selectedOrder || this.pendingStatus === null) return "";
        if (this.pendingStatus === OrderStatus.Cancelled) {
            return `Cancel order #${this.selectedOrder.id}? A cancellation email will be sent to the customer.`;
        }
        const label = ORDER_STATUS_LABEL[this.pendingStatus];
        return `Mark order #${this.selectedOrder.id} as ${label}? A notification email will be sent to the customer.`;
    }

    get confirmSeverity(): "danger" | undefined {
        return this.pendingStatus === OrderStatus.Cancelled ? "danger" : undefined;
    }

    getSubtotal(order: AdminOrderDetail): number {
        return order.items.reduce((sum, i) => sum + i.priceAtPurchase * i.quantity, 0);
    }

    statusLabel(status: number): string {
        return ORDER_STATUS_LABEL[status as OrderStatus] ?? "Unknown";
    }

    statusSeverity(status: number): "warn" | "info" | "secondary" | "success" | "danger" {
        return ORDER_STATUS_SEVERITY[status as OrderStatus] ?? "secondary";
    }

    stepClass(step: OrderStatus, current: OrderStatus): string {
        if (step < current) return "done";
        if (step === current) return "active";
        return "upcoming";
    }

    private toISODate(d: Date): string {
        return d.toISOString().split("T")[0];
    }

    private resetAndLoad() {
        this.pageNumber = 0;
        if (this.dt) this.dt.first = 0;
        this.loadOrders();
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
