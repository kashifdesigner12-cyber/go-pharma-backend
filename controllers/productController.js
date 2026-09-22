import Product from "../models/Product.js";

export const createProduct = async (req, res) => {
  try {
    const { barcode, sku } = req.body;

    // Validate barcode
    if (!barcode || !String(barcode).trim()) {
      return res.status(400).json({
        message: "Barcode is required",
      });
    }

    const cleanBarcode = String(barcode).trim();
    const cleanSku =
      sku && String(sku).trim() ? String(sku).trim() : undefined;

    // Check if barcode already exists
    const existingBarcode = await Product.findOne({
      barcode: cleanBarcode,
    });

    if (existingBarcode) {
      return res.status(409).json({
        message: "Product with this barcode already exists",
        product: existingBarcode,
      });
    }

    // Check SKU only when SKU is provided
    if (cleanSku) {
      const existingSku = await Product.findOne({
        sku: cleanSku,
      });

      if (existingSku) {
        return res.status(409).json({
          message: "Product with this SKU already exists",
          product: existingSku,
        });
      }
    }

    const productData = {
      ...req.body,
      barcode: cleanBarcode,
      image: req.file ? `/uploads/${req.file.filename}` : "",
    };

    // Do not save empty/null SKU
    if (cleanSku) {
      productData.sku = cleanSku;
    } else {
      delete productData.sku;
    }

    const product = await Product.create(productData);

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Product create error:", error);

    // MongoDB duplicate key error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      if (duplicateField === "sku") {
        return res.status(409).json({
          message: "Product with this SKU already exists",
        });
      }

      if (duplicateField === "barcode") {
        return res.status(409).json({
          message: "Product with this barcode already exists",
        });
      }

      return res.status(409).json({
        message: "Duplicate product data",
      });
    }

    res.status(500).json({
      message: "Failed to create product",
      error: error.message,
    });
  }
};

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find();

    res.status(200).json({
      products,
    });
  } catch (error) {
    console.error("Get products error:", error);

    res.status(500).json({
      message: "Failed to get products",
      error: error.message,
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.status(200).json({
      product,
    });
  } catch (error) {
    console.error("Get product by ID error:", error);

    res.status(500).json({
      message: "Failed to get product",
      error: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.status(200).json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    res.status(500).json({
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      if (duplicateField === "sku") {
        return res.status(409).json({
          message: "Product with this SKU already exists",
        });
      }

      if (duplicateField === "barcode") {
        return res.status(409).json({
          message: "Product with this barcode already exists",
        });
      }

      return res.status(409).json({
        message: "Duplicate product data",
      });
    }

    res.status(500).json({
      message: "Failed to update product",
      error: error.message,
    });
  }
};

export const getProductByBarcode = async (req, res) => {
  try {
    const product = await Product.findOne({
      barcode: req.params.barcode,
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.status(200).json({
      product,
    });
  } catch (error) {
    console.error("Find product by barcode error:", error);

    res.status(500).json({
      message: "Failed to find product",
      error: error.message,
    });
  }
};

export const addStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({
        message: "Valid stock quantity is required",
      });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      {
        $inc: {
          stock: Number(quantity),
        },
      },
      {
        new: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.status(200).json({
      message: "Stock added successfully",
      product,
    });
  } catch (error) {
    console.error("Add stock error:", error);

    res.status(500).json({
      message: "Failed to add stock",
      error: error.message,
    });
  }
};

