import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware";
import { createAddress, getAddresses, deleteAddress, updateAddress, setDefaultAddress } from "../../controllers/storefront/address.controller";

const router = Router();

router.post("/", authenticate, createAddress);
router.get("/", authenticate, getAddresses);
router.delete("/:addressId", authenticate, deleteAddress);
router.patch("/:addressId/default", authenticate, setDefaultAddress);
router.patch("/:addressId", authenticate, updateAddress);

export default router;
