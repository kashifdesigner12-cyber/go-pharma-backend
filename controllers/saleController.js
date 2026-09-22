import Sale from "../models/Sale.js";
import Product from "../models/Product.js";
import PDFDocument from "pdfkit";

export const createSale = async (req, res) => {
  try {
    const { items, paymentMethod } = req.body;

    // Check items
    if (!items || !Array.isArray(items) || items.length === 0) {
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

    // Only backend-supported payment methods
    if (!["cash", "card"].includes(paymentMethod)) {
      return res.status(400).json({
        message: "Invalid payment method",
      });
    }

    let totalAmount = 0;
    const saleItems = [];

    // Check every product and prepare sale items
    for (const item of items) {
      if (!item.product || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          message: "Invalid product or quantity",
        });
      }

      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({
          message: "Product not found",
        });
      }

      // Check stock
      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name}`,
        });
      }

      // Calculate total
      totalAmount += product.price * item.quantity;

      saleItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
      });
    }

    // Create unique receipt number
    const receiptNumber = `POS-${Date.now()}`;

    // Create sale FIRST
    // This prevents stock from being reduced
    // if sale creation fails.
    const sale = await Sale.create({
      items: saleItems,
      totalAmount,
      paymentMethod,
      receiptNumber,
    });

    // Reduce stock only after sale is successfully created
    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        // Safety rollback if product unexpectedly disappears
        await Sale.findByIdAndDelete(sale._id);

        return res.status(404).json({
          message: "Product not found while updating stock",
        });
      }

      product.stock = product.stock - item.quantity;

      await product.save();
    }

    res.status(201).json({
      message: "Sale created successfully",
      sale,
    });
  } catch (error) {
    console.log("CREATE SALE ERROR:", error);

    res.status(500).json({
      message: "Failed to create sale",
      error: error.message,
    });
  }
};

export const getSales = async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate("items.product")
      .sort({ createdAt: -1 });

    res.status(200).json({
      sales,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to get sales",
      error: error.message,
    });
  }
};

export const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    // Restore stock before deleting the sale
    for (const item of sale.items) {
      const product = await Product.findById(item.product);

      if (product) {
        product.stock = product.stock + item.quantity;
        await product.save();
      }
    }

    await Sale.findByIdAndDelete(id);

    res.status(200).json({
      message: "Sale deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete sale",
      error: error.message,
    });
  }
};

/**
 * Generate PDF receipt for a sale
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

    // PDF response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="receipt-${sale.receiptNumber}.pdf"`
    );

    // Send PDF directly to browser
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

    doc.fontSize(9).font("Helvetica-Bold").text("SALE RECEIPT");

    doc.font("Helvetica");

    doc.text(`Receipt: ${sale.receiptNumber}`);

    doc.text(
      `Date: ${new Date(sale.createdAt).toLocaleString()}`
    );

    doc.text(
      `Payment: ${String(sale.paymentMethod || "").toUpperCase()}`
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

    doc.font("Helvetica-Bold").text("ITEMS");

    doc.moveDown(0.2);

    doc.font("Helvetica");

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
          `${quantity} x Rs. ${price.toFixed(2)} = Rs. ${lineTotal.toFixed(
            2
          )}`
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
      .text(`TOTAL: Rs. ${Number(sale.totalAmount).toFixed(2)}`, {
        align: "right",
      });

    doc.moveDown(1);

    // =========================
    // FOOTER
    // =========================

    doc
      .font("Helvetica")
      .fontSize(8)
      .text("Thank you for shopping with GO-PHARMA!", {
        align: "center",
      });

    doc.moveDown(0.3);

    doc
      .fontSize(7)
      .text("Please keep this receipt for your records.", {
        align: "center",
      });

    // Finish PDF
    doc.end();
  } catch (error) {
    console.log("GENERATE RECEIPT ERROR:", error);

    // If PDF response has not started yet
    if (!res.headersSent) {
      return res.status(500).json({
        message: "Failed to generate receipt",
        error: error.message,
      });
    }

    res.end();
  }
};
