import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware";
import { getAdminCustomers, getCustomerOrders, getAdminAdmins } from "../../controllers/admin/admin-users.controller";

const router = Router();

router.get("/customers", authenticate, getAdminCustomers);
router.get("/customers/:id/orders", authenticate, getCustomerOrders);
router.get("/admins", authenticate, getAdminAdmins);

export default router;
