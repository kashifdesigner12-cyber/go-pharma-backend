import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import connectDB from "./config/db.js";

import productRoutes from "./routes/productRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import importExportRoutes from "./routes/importExportRoutes.js";

dotenv.config();

const app = express();

// =========================
// MIDDLEWARE
// =========================

app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// =========================
// STATIC FILES
// =========================

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);

// =========================
// DATABASE
// =========================

connectDB();

// =========================
// API ROUTES
// =========================

app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/import-export", importExportRoutes);

// =========================
// ROOT ROUTE
// =========================

app.get("/", (req, res) => {
  res.status(200).json({
    message: "POS Backend is running",
  });
});

// =========================
// SERVER
// =========================

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});