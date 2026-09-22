import express from "express";

import {
  createSale,
  getSales,
  deleteSale,
  generateSaleReceipt,
} from "../controllers/saleController.js";

const router = express.Router();

router.post("/", createSale);

router.get("/", getSales);

// PDF receipt
router.get("/:id/receipt", generateSaleReceipt);

router.delete("/:id", deleteSale);

export default router;

