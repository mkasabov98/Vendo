# 🛒 Vendo - E-Commerce Platform

A full-stack e-commerce application with a customer storefront and a separate admin dashboard. Customers can browse products, manage a cart, apply discount codes, and check out securely via Stripe(Test Mode). Admins manage products, monitor orders, and view sales analytics. The storefront is **fully responsive** and works on mobile as well as desktop, and the platform sends **transactional emails** at every key step of the order lifecycle.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20, PrimeNG 20 (standalone components) |
| Backend | Node.js, Express 5, TypeScript |
| ORM | Sequelize 6 |
| Database | MySQL |
| Payments | Stripe (payment intents + webhook) |
| Email | Brevo (HTTP API) |
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

🔗 **https://vendo-one-green.vercel.app/**

| Role | Email | Password |
|---|---|---|
| Customer | `user@shop.com` | `User1234!` |
| Admin | `admin@shop.com` | `Admin1234!` |

> 💡 For a detailed walkthrough of every feature, see **Section 2 — Full Feature Walkthrough** below.

---

Full Feature Walkthrough

## 2.1 Authentication
JWT-based auth with access + refresh tokens. Register, login, and logout flows. New users receive a welcome email with a 10%-off discount code on sign-up. Two roles — `User` and `Admin` — with the admin panel gated behind an `isAdmin` guard. Login/register screens are fully responsive on mobile.

<img width="1917" height="910" alt="image" src="https://github.com/user-attachments/assets/e61f158a-7323-4055-81cf-fd9932a60bf5" />
<img width="349" height="698" alt="image" src="https://github.com/user-attachments/assets/8f52a883-1396-4d37-8f40-f8cdf3a2bc44" />



## 2.2 Home Page
Product catalogue with a category filter sidebar, search, and pagination. On mobile the sidebar collapses into a drawer/toggle and the product grid reflows to a single column.

<img width="1915" height="908" alt="image" src="https://github.com/user-attachments/assets/4ec2ed19-1726-4727-bed0-05c3a40a0286" />
<img width="350" height="700" alt="image" src="https://github.com/user-attachments/assets/e5993936-4d70-41b8-867e-c71bc9ecbb26" />



## 2.3 Product Detail Page
Single-product view with images, description, price, stock status, and customer reviews. Responsive layout stacks media and details vertically on small screens.

<img width="1916" height="910" alt="image" src="https://github.com/user-attachments/assets/e8c7ec9f-a934-4412-87d8-37a705da48fc" />
<img width="350" height="700" alt="image" src="https://github.com/user-attachments/assets/8ee84aa0-b12d-442a-a556-3194917960f1" />



## 2.4 Cart
Cart table with live quantity controls and subtotal. Apply single-use, user-scoped discount codes. Inactive/unavailable items are flagged and the checkout Continue button is disabled until they're resolved. Mobile view condenses the cart rows for narrow screens.

<img width="1913" height="907" alt="image" src="https://github.com/user-attachments/assets/7b573419-0b49-4963-8b09-d4263054439e" />
<img width="349" height="697" alt="image" src="https://github.com/user-attachments/assets/6a92f8a6-c7c2-42a5-bb02-40cd2f01cf3c" />



## 2.5 Checkout Flow
Stripe-powered stepper: select/enter a delivery address, then pay by card via Stripe payment intents. On a successful payment the customer receives an order-confirmation email. Works on mobile.

<img width="1916" height="907" alt="image" src="https://github.com/user-attachments/assets/5c524e4d-aa99-4b6a-8914-00ae63b26bf5" />


## 2.6 User Profile
Tabbed profile: order history with re-order, saved delivery addresses (add/edit), and a security tab for password changes. Responsive on mobile.

<img width="1915" height="905" alt="image" src="https://github.com/user-attachments/assets/78cb557b-15cf-48b5-aa81-61b8bc71b2d0" />
<img width="352" height="697" alt="image" src="https://github.com/user-attachments/assets/f1c3eb5a-1e05-4bf5-8ce2-e7c4c6789f07" />



## 2.7 Admin Dashboard
Overview with KPI cards, an order-status breakdown, and low-stock alerts (stock > 0 and < 10).

<img width="1917" height="907" alt="image" src="https://github.com/user-attachments/assets/b5f7a523-b0de-4541-adb9-7e643936cca5" />


## 2.8 Admin Products
Products table with search, category/status/stock filters, sorting, and pagination. Full CRUD plus bulk stock/active updates in a single SQL statement. Soft-delete only (`isActive = false`). Product form drawer handles create / edit / copy with a dirty-state guard.

<img width="1919" height="906" alt="image" src="https://github.com/user-attachments/assets/da3bc908-24c0-4c99-b588-1ac6501e5cf9" />
<img width="1919" height="907" alt="image" src="https://github.com/user-attachments/assets/144f0da1-f257-4e6b-ae0a-ccccf0440305" />



## 2.9 Admin Orders
Order list with status transitions and a detail drawer showing line items and totals. Changing an order's status (Shipped, Delivered, Cancelled) automatically emails the customer the matching notification.

<img width="1917" height="905" alt="image" src="https://github.com/user-attachments/assets/8c5d35bb-51a5-4780-a4ea-a03d0db9a164" />
<img width="1918" height="907" alt="image" src="https://github.com/user-attachments/assets/f5c1c947-13c8-49f4-88e9-9a53f87da54b" />



## 2.10 Admin Users
Manage customers and admins, with drill-down into each user's orders.

<img width="1919" height="909" alt="image" src="https://github.com/user-attachments/assets/2dd2b245-dc7c-4cb4-898d-13b38384665e" />
<img width="1918" height="906" alt="image" src="https://github.com/user-attachments/assets/497fb81b-3219-4fd6-bd9e-5aa09141799d" />



## 2.11 Admin Categories
Create and manage product categories.

<img width="1918" height="909" alt="image" src="https://github.com/user-attachments/assets/498f086e-e148-40fd-bec4-d1e37fefd902" />
<img width="1917" height="909" alt="image" src="https://github.com/user-attachments/assets/5ee598a0-283d-4430-aec7-abd2c46df0df" />



## 2.12 Admin Analytics
Sales analytics page with 10 charts, date-range presets, and grouping options.

<img width="1918" height="912" alt="image" src="https://github.com/user-attachments/assets/bcc552ac-b286-4270-92f1-541b3835e6a7" />
<img width="1914" height="910" alt="image" src="https://github.com/user-attachments/assets/92664d37-d024-4d20-8bb1-6d0ba2282ab9" />
<img width="1917" height="903" alt="image" src="https://github.com/user-attachments/assets/f73031dd-c919-4fd4-9f4c-14361e1fce41" />



## 2.13 Email Notifications
Transactional emails are sent via the Brevo HTTP API (requires a Brevo API key and a verified sender). The system sends:

| Email | Trigger |
|---|---|
| Welcome | New user registration (includes a 10%-off code, valid 30 days) |
| Order Confirmation | Successful Stripe payment (itemized summary + delivery address) |
| Order Shipped | Admin sets status → Shipped |
| Order Delivered | Admin sets status → Delivered |
| Order Cancelled | Admin sets status → Cancelled (notes refund timing) |

<img width="1595" height="757" alt="image" src="https://github.com/user-attachments/assets/03bf93aa-5d1c-4eee-b063-4b1693a4f7ac" />


## 2.14 Deployment Architecture
- **Frontend** → Vercel
- **Backend + MySQL** → Railway
- **Payments** → Stripe webhook pointed at the Railway backend
- **Email** → Email → Brevo HTTP API

