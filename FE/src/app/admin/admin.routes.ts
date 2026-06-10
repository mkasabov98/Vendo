import { Routes } from "@angular/router";
import { AdminLayoutComponent } from "./admin-layout/admin-layout.component";
import { DashboardComponent } from "./dashboard/dashboard.component";
import { AnalyticsComponent } from "./analytics/analytics.component";
import { AdminProductsComponent } from "./products/products.component";
import { CategoriesComponent } from "./categories/categories.component";
import { OrdersComponent } from "./orders/orders.component";
import { UsersComponent } from "./users/users.component";

export const adminRoutes: Routes = [
    {
        path: "",
        component: AdminLayoutComponent,
        children: [
            { path: "dashboard", component: DashboardComponent },
            { path: "analytics", component: AnalyticsComponent },
            { path: "products", component: AdminProductsComponent },
            { path: "categories", component: CategoriesComponent },
            { path: "orders", component: OrdersComponent },
            {
                path: "users",
                children: [
                    { path: "", redirectTo: "customers", pathMatch: "full" },
                    { path: "customers", component: UsersComponent, data: { section: "customers" } },
                    { path: "admins", component: UsersComponent, data: { section: "admins" } },
                ],
            },
            { path: "", redirectTo: "dashboard", pathMatch: "full" },
        ],
    },
];
