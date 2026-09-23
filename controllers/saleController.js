import Sale from "../models/Sale.js";
import Product from "../models/Product.js";
import PDFDocument from "pdfkit";

/**
 * Create Sale
 * POST /api/sales
 */
export const createSale = async (req, res) => {
  try {
    // Prevent crash when req.body is undefined
    const body = req.body || {};

    const { items, paymentMethod } = body;

    // Check items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Cart is empty",
      });
    }

    // Check payment method
    if (!paymentMethod) {
      return res.status(400).json({
        message: "Payment method is required",
      });
    }

    // Supported payment methods
    const allowedPaymentMethods = ["cash", "card"];

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        message: "Invalid payment method",
      });
    }

    let totalAmount = 0;
    const saleItems = [];

    // Validate products and prepare sale items
    for (const item of items) {
      if (
        !item ||
        !item.product ||
        !item.quantity ||
        Number(item.quantity) <= 0
      ) {
        return res.status(400).json({
          message: "Invalid product or quantity",
        });
      }

      const quantity = Number(item.quantity);

      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({
          message: "Product not found",
        });
      }

      // Check stock
      if (Number(product.stock) < quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name}`,
        });
      }

      const price = Number(product.price) || 0;
      const lineTotal = price * quantity;

      totalAmount += lineTotal;

      saleItems.push({
        product: product._id,
        quantity,
        price,
      });
    }

    // Generate unique receipt number
    const receiptNumber = `POS-${Date.now()}`;

    // Create sale first
    const sale = await Sale.create({
      items: saleItems,
      totalAmount,
      paymentMethod,
      receiptNumber,
    });

    // Reduce stock after successful sale creation
    for (const item of saleItems) {
      const product = await Product.findById(item.product);

      if (!product) {
        // Rollback sale if product unexpectedly disappears
        await Sale.findByIdAndDelete(sale._id);

        return res.status(404).json({
          message: "Product not found while updating stock",
        });
      }

      product.stock = Number(product.stock) - Number(item.quantity);

      await product.save();
    }

    return res.status(201).json({
      message: "Sale created successfully",
      sale,
    });
  } catch (error) {
    console.error("CREATE SALE ERROR:", error);

    return res.status(500).json({
      message: "Failed to create sale",
      error: error.message,
    });
  }
};

/**
 * Get all sales
 * GET /api/sales
 */
export const getSales = async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate("items.product")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      sales,
    });
  } catch (error) {
    console.error("GET SALES ERROR:", error);

    return res.status(500).json({
      message: "Failed to get sales",
      error: error.message,
    });
  }
};

/**
 * Delete Sale
 * DELETE /api/sales/:id
 */
export const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    // Restore stock before deleting sale
    for (const item of sale.items) {
      const product = await Product.findById(item.product);

      if (product) {
        product.stock =
          Number(product.stock) + Number(item.quantity);

        await product.save();
      }
    }

    await Sale.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Sale deleted successfully",
    });
  } catch (error) {
    console.error("DELETE SALE ERROR:", error);

    return res.status(500).json({
      message: "Failed to delete sale",
      error: error.message,
    });
  }
};

/**
 * Generate PDF receipt
 *
 * GET /api/sales/:id/receipt
 */
export const generateSaleReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findById(id).populate("items.product");

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    // Create PDF
    const doc = new PDFDocument({
      size: [226, 600],
      margins: {
        top: 20,
        bottom: 20,
        left: 15,
        right: 15,
      },
    });

    // PDF headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="receipt-${sale.receiptNumber}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // =========================
    // STORE HEADER
    // =========================

    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("GO-PHARMA", {
        align: "center",
      });

    doc
      .fontSize(9)
      .font("Helvetica")
      .text("Pharmacy POS", {
        align: "center",
      });

    doc.moveDown(0.5);

    doc
      .fontSize(9)
      .text("--------------------------------", {
        align: "center",
      });

    // =========================
    // SALE INFORMATION
    // =========================

    doc.moveDown(0.5);

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("SALE RECEIPT");

    doc.font("Helvetica");

    doc.text(`Receipt: ${sale.receiptNumber}`);

    doc.text(
      `Date: ${new Date(sale.createdAt).toLocaleString()}`
    );

    doc.text(
      `Payment: ${String(
        sale.paymentMethod || ""
      ).toUpperCase()}`
    );

    doc.moveDown(0.5);

    doc
      .fontSize(9)
      .text("--------------------------------", {
        align: "center",
      });

    // =========================
    // ITEMS
    // =========================

    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .text("ITEMS");

    doc.moveDown(0.2);

    for (const item of sale.items) {
      const product = item.product;

      const productName = product?.name || "Product";
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const lineTotal = quantity * price;

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(productName, {
          width: 190,
        });

      doc
        .font("Helvetica")
        .fontSize(8)
        .text(
          `${quantity} x Rs. ${price.toFixed(
            2
          )} = Rs. ${lineTotal.toFixed(2)}`
        );

      doc.moveDown(0.3);
    }

    doc
      .fontSize(9)
      .text("--------------------------------", {
        align: "center",
      });

    // =========================
    // TOTAL
    // =========================

    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(
        `TOTAL: Rs. ${Number(
          sale.totalAmount || 0
        ).toFixed(2)}`,
        {
          align: "right",
        }
      );

    doc.moveDown(1);

    // =========================
    // FOOTER
    // =========================

    doc
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Thank you for shopping with GO-PHARMA!",
        {
          align: "center",
        }
      );

    doc.moveDown(0.3);

    doc
      .fontSize(7)
      .text(
        "Please keep this receipt for your records.",
        {
          align: "center",
        }
      );

    // Finish PDF
    doc.end();
  } catch (error) {
    console.error("GENERATE RECEIPT ERROR:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Failed to generate receipt",
        error: error.message,
      });
    }

    res.end();
  }
};