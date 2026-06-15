# 🛒 E-Commerce Platform

A full-stack e-commerce application with a customer storefront and a separate admin dashboard. Customers can browse products, manage a cart, apply discount codes, and check out securely via Stripe. Admins manage products, monitor orders, and view sales analytics. The storefront is **fully responsive** and works on mobile as well as desktop, and the platform sends **transactional emails** at every key step of the order lifecycle.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20, PrimeNG 20 (standalone components) |
| Backend | Node.js, Express 5, TypeScript |
| ORM | Sequelize 6 |
| Database | MySQL |
| Payments | Stripe (payment intents + webhook) |
| Email | Nodemailer (Gmail SMTP) |
| Auth | JWT (access + refresh tokens) |

## Core Features

**Storefront (customer-facing, mobile + desktop)**
- Browse a product catalogue with category sidebar, search, and pagination
- Product detail pages with reviews
- Cart with live quantity controls, discount codes, and an inactive-item checkout guard
- Stripe checkout flow (delivery address → card stepper)
- User profile: order history, saved delivery addresses, re-order, password/security
- Responsive layout — adapts to phones, tablets, and desktop

**Admin Dashboard**
- KPI cards, order-status breakdown, and low-stock alerts
- Product management: full CRUD, bulk operations, soft-delete
- Order management with status transitions and detail view
- User management (customers + admins) with order drill-down
- Category management
- Sales analytics with 10 charts, date presets, and grouping

**Transactional Email**
- Welcome email with a personal 10%-off discount code on registration
- Order confirmation with itemized summary after successful payment
- Shipped / Delivered / Cancelled notifications driven by admin status changes

## How It Works (Key Flows)

- **Customer places an order** → pays via Stripe → receives an order-confirmation email, and the order appears in the admin Orders list as *Pending*.
- **Admin updates the order status** (e.g. Pending → Shipped → Delivered, or Cancelled) → the customer automatically receives the matching email for that status.
- **New customer registers** → instantly gets a welcome email containing a single-use 10%-off code (valid 30 days) they can apply at checkout.
- **A product sells out** → the Stripe webhook decrements stock after payment and auto-deactivates the product when it hits 0, removing it from the storefront.

## Live Demo

🔗 **Demo URL:** _<!-- TODO: add deployed URL -->_

| Role | Email | Password |
|---|---|---|
| Customer | `user@shop.com` | `User1234!` |
| Admin | `admin@shop.com` | `Admin1234!` |

> 💡 For a detailed walkthrough of every feature, see **Section 2 — Full Feature Walkthrough** below.

---

# Section 2 — Full Feature Walkthrough

## 2.1 Authentication
JWT-based auth with access + refresh tokens. Register, login, and logout flows. New users receive a welcome email with a 10%-off discount code on sign-up. Two roles — `User` and `Admin` — with the admin panel gated behind an `isAdmin` guard. Login/register screens are fully responsive on mobile.

📸 _Screenshot: login screen (desktop + mobile side by side)_

## 2.2 Home Page
Product catalogue with a category filter sidebar, search, and pagination. On mobile the sidebar collapses into a drawer/toggle and the product grid reflows to a single column.

📸 _Screenshot: catalogue with sidebar open (desktop) and collapsed (mobile)_

## 2.3 Product Detail Page
Single-product view with images, description, price, stock status, and customer reviews. Responsive layout stacks media and details vertically on small screens.

📸 _Screenshot: product detail page_

## 2.4 Cart
Cart table with live quantity controls and subtotal. Apply single-use, user-scoped discount codes. Inactive/unavailable items are flagged and the checkout Continue button is disabled until they're resolved. Mobile view condenses the cart rows for narrow screens.

📸 _Screenshot: cart with a discount applied + an inactive-item warning_

## 2.5 Checkout Flow
Stripe-powered stepper: select/enter a delivery address, then pay by card via Stripe payment intents. On a successful payment the customer receives an order-confirmation email. Works on mobile.

📸 _Screenshot: checkout stepper (address step + card step)_

## 2.6 User Profile
Tabbed profile: order history with re-order, saved delivery addresses (add/edit), and a security tab for password changes. Responsive on mobile.

📸 _Screenshot: profile order history + delivery addresses_

## 2.7 Admin Dashboard
Overview with KPI cards, an order-status breakdown, and low-stock alerts (stock > 0 and < 10).

📸 _Screenshot: admin dashboard_

## 2.8 Admin Products
Products table with search, category/status/stock filters, sorting, and pagination. Full CRUD plus bulk stock/active updates in a single SQL statement. Soft-delete only (`isActive = false`). Product form drawer handles create / edit / copy with a dirty-state guard.

📸 _Screenshot: products table + product form drawer_

## 2.9 Admin Orders
Order list with status transitions and a detail drawer showing line items and totals. Changing an order's status (Shipped, Delivered, Cancelled) automatically emails the customer the matching notification.

📸 _Screenshot: admin orders + detail drawer_

## 2.10 Admin Users
Manage customers and admins, with drill-down into each user's orders.

📸 _Screenshot: admin users list_

## 2.11 Admin Categories
Create and manage product categories.

📸 _Screenshot: admin categories_

## 2.12 Admin Analytics
Sales analytics page with 10 charts, date-range presets, and grouping options.

📸 _Screenshot: analytics charts_

## 2.13 Email Notifications
Transactional emails are sent via Nodemailer over Gmail SMTP (requires a Google App Password). The system sends:

| Email | Trigger |
|---|---|
| Welcome | New user registration (includes a 10%-off code, valid 30 days) |
| Order Confirmation | Successful Stripe payment (itemized summary + delivery address) |
| Order Shipped | Admin sets status → Shipped |
| Order Delivered | Admin sets status → Delivered |
| Order Cancelled | Admin sets status → Cancelled (notes refund timing) |

📸 _Screenshot: sample order-confirmation email_

## 2.14 Deployment Architecture
- **Frontend** → Vercel
- **Backend + MySQL** → Railway
- **Payments** → Stripe webhook pointed at the Railway backend
- **Email** → Gmail SMTP via Nodemailer

📸 _Diagram: Vercel ↔ Railway ↔ Stripe / Gmail_
