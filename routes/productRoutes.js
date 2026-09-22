import express from "express";
import upload from "../config/multer.js";

import {
  createProduct,
  getProducts,
  getProductById,
  deleteProduct,
  updateProduct,
  getProductByBarcode,
  addStock,
} from "../controllers/productController.js";

const router = express.Router();

router.post("/", upload.single("image"), createProduct);

router.get("/", getProducts);

router.get("/:id", getProductById);

router.get("/barcode/:barcode", getProductByBarcode);

router.put("/:id/stock", addStock);

router.delete("/:id", deleteProduct);

router.put("/:id", updateProduct);

export default router;