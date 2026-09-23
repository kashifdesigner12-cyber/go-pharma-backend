import Product from "../models/Product.js";
import * as XLSX from "xlsx";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const cleanText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

const getValue = (row, keys) => {
  for (const key of keys) {
    if (
      row &&
      Object.prototype.hasOwnProperty.call(row, key)
    ) {
      const value = row[key];

      if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }
  }

  return "";
};

const parseNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return NaN;
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();

  if (!cleaned) {
    return NaN;
  }

  return Number(cleaned);
};

const normalizeBarcode = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }

    return String(Math.trunc(value));
  }

  let barcode = String(value).trim();

  if (!barcode) {
    return "";
  }

  /*
   * Handle scientific notation from Excel.
   *
   * Example:
   * 2.90918E+11
   * becomes:
   * 290918000000
   */
  if (/^[+-]?\d*\.?\d+e[+-]?\d+$/i.test(barcode)) {
    const numericValue = Number(barcode);

    if (Number.isFinite(numericValue)) {
      barcode = String(Math.trunc(numericValue));
    }
  }

  /*
   * Remove accidental ".0"
   *
   * Example:
   * 1234567890123.0
   * becomes:
   * 1234567890123
   */
  barcode = barcode.replace(/\.0+$/, "");

  /*
   * Remove spaces often added by Excel.
   */
  barcode = barcode.replace(/\s+/g, "");

  return barcode;
};

const normalizeSku = (value) => {
  return cleanText(value);
};

/* -------------------------------------------------------------------------- */
/* IMPORT PRODUCTS                                                            */
/* -------------------------------------------------------------------------- */

export const importProducts = async (req, res) => {
  try {
    /* ---------------------------------------------------------------------- */
    /* Validate uploaded file                                                 */
    /* ---------------------------------------------------------------------- */

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Import file is required",
      });
    }

    if (!req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Unable to read uploaded file",
      });
    }

    console.log("\n========================================");
    console.log("PRODUCT IMPORT STARTED");
    console.log("========================================");

    console.log("PRODUCT IMPORT FILE:", {
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

    /* ---------------------------------------------------------------------- */
    /* Read workbook                                                          */
    /* ---------------------------------------------------------------------- */

    let workbook;

    try {
      workbook = XLSX.read(req.file.buffer, {
        type: "buffer",
        cellDates: true,
        raw: true,
      });
    } catch (fileError) {
      console.error(
        "Spreadsheet read error:",
        fileError
      );

      return res.status(400).json({
        success: false,
        message:
          "Unable to read spreadsheet. Please upload a valid spreadsheet file.",
        error: fileError?.message,
      });
    }

    if (
      !workbook ||
      !Array.isArray(workbook.SheetNames) ||
      workbook.SheetNames.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "No sheet found in uploaded file",
      });
    }

    /* ---------------------------------------------------------------------- */
    /* Read first sheet                                                       */
    /* ---------------------------------------------------------------------- */

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: "Unable to read first sheet",
      });
    }

    console.log(
      "PRODUCT IMPORT SHEET:",
      sheetName
    );

    /* ---------------------------------------------------------------------- */
    /* Convert sheet to JSON                                                  */
    /* ---------------------------------------------------------------------- */

    const rows = XLSX.utils.sheet_to_json(
      worksheet,
      {
        defval: "",
        raw: true,
        blankrows: false,
      }
    );

    if (
      !Array.isArray(rows) ||
      rows.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "The uploaded sheet is empty",
      });
    }

    console.log(
      "PRODUCT IMPORT TOTAL ROWS:",
      rows.length
    );

    /* ---------------------------------------------------------------------- */
    /* Import result arrays                                                   */
    /* ---------------------------------------------------------------------- */

    const imported = [];
    const skipped = [];

    /* ---------------------------------------------------------------------- */
    /* Duplicate tracking inside uploaded sheet                               */
    /* ---------------------------------------------------------------------- */

    const sheetBarcodes = new Set();
    const sheetSkus = new Set();

    /* ---------------------------------------------------------------------- */
    /* Loop rows                                                              */
    /* ---------------------------------------------------------------------- */

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row = rows[index];
      const rowNumber = index + 2;

      try {
        /* ------------------------------------------------------------------ */
        /* Product Name                                                        */
        /* ------------------------------------------------------------------ */

        const name = cleanText(
          getValue(row, [
            "Product Name",
            "product name",
            "PRODUCT NAME",
            "Name",
            "name",
            "Product",
            "product",
          ])
        );

        /* ------------------------------------------------------------------ */
        /* SKU                                                                 */
        /* ------------------------------------------------------------------ */

        const sku = normalizeSku(
          getValue(row, [
            "SKU",
            "sku",
            "Sku",
            "Product SKU",
            "product sku",
            "ProductSku",
          ])
        );

        /* ------------------------------------------------------------------ */
        /* Barcode                                                             */
        /* ------------------------------------------------------------------ */

        const barcode = normalizeBarcode(
          getValue(row, [
            "Barcode",
            "barcode",
            "BARCODE",
            "Bar Code",
            "bar code",
            "EAN",
            "ean",
            "UPC",
            "upc",
          ])
        );

        /* ------------------------------------------------------------------ */
        /* Purchase Price                                                      */
        /* ------------------------------------------------------------------ */

        const purchasePriceValue = getValue(
          row,
          [
            "Purchase Price",
            "purchase price",
            "PurchasePrice",
            "purchasePrice",
            "Cost Price",
            "cost price",
          ]
        );

        /* ------------------------------------------------------------------ */
        /* Sale Price                                                          */
        /* ------------------------------------------------------------------ */

        const salePriceValue = getValue(
          row,
          [
            "Sale Price",
            "sale price",
            "SalePrice",
            "salePrice",
            "Selling Price",
            "selling price",
            "Price",
            "price",
          ]
        );

        /* ------------------------------------------------------------------ */
        /* Stock                                                               */
        /* ------------------------------------------------------------------ */

        const stockValue = getValue(
          row,
          [
            "Stock",
            "stock",
            "Quantity",
            "quantity",
            "Qty",
            "qty",
            "Current Stock",
            "current stock",
          ]
        );

        /* ------------------------------------------------------------------ */
        /* Category                                                            */
        /* ------------------------------------------------------------------ */

        const category = cleanText(
          getValue(row, [
            "Category",
            "category",
            "CATEGORY",
            "Category Name",
            "category name",
          ])
        );

        /* ------------------------------------------------------------------ */
        /* Unit                                                                */
        /* ------------------------------------------------------------------ */

        const unit =
          cleanText(
            getValue(row, [
              "Unit",
              "unit",
              "UNIT",
            ])
          ) || "box";

        /* ------------------------------------------------------------------ */
        /* Image                                                               */
        /* ------------------------------------------------------------------ */

        const image = cleanText(
          getValue(row, [
            "Image",
            "image",
            "Image URL",
            "image url",
            "ImageUrl",
            "imageUrl",
          ])
        );

        /* ------------------------------------------------------------------ */
        /* Required field validation                                          */
        /* ------------------------------------------------------------------ */

        if (!name) {
          const reason =
            "Product name is required";

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        if (!barcode) {
          const reason =
            "Barcode is required";

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        if (
          salePriceValue === "" ||
          salePriceValue === null ||
          salePriceValue === undefined
        ) {
          const reason =
            "Sale price is required";

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        if (!category) {
          const reason =
            "Category is required";

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        /* ------------------------------------------------------------------ */
        /* Convert numbers                                                     */
        /* ------------------------------------------------------------------ */

        const salePrice =
          parseNumber(salePriceValue);

        const purchasePrice =
          purchasePriceValue === "" ||
          purchasePriceValue === null ||
          purchasePriceValue === undefined
            ? 0
            : parseNumber(
                purchasePriceValue
              );

        const stock =
          stockValue === "" ||
          stockValue === null ||
          stockValue === undefined
            ? 0
            : parseNumber(stockValue);

        /* ------------------------------------------------------------------ */
        /* Price validation                                                    */
        /* ------------------------------------------------------------------ */

        if (
          !Number.isFinite(salePrice) ||
          salePrice < 0
        ) {
          const reason =
            "Invalid sale price";

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        if (
          !Number.isFinite(
            purchasePrice
          ) ||
          purchasePrice < 0
        ) {
          const reason =
            "Invalid purchase price";

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        /* ------------------------------------------------------------------ */
        /* Stock validation                                                    */
        /* ------------------------------------------------------------------ */

        if (
          !Number.isFinite(stock) ||
          stock < 0
        ) {
          const reason =
            "Invalid stock quantity";

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        /* ------------------------------------------------------------------ */
        /* Normalize duplicate values                                         */
        /* ------------------------------------------------------------------ */

        const normalizedBarcode =
          barcode.toLowerCase();

        const normalizedSku =
          sku.toLowerCase();

        /* ------------------------------------------------------------------ */
        /* Duplicate barcode inside Excel sheet                               */
        /* ------------------------------------------------------------------ */

        if (
          sheetBarcodes.has(
            normalizedBarcode
          )
        ) {
          const reason =
            `Duplicate barcode in uploaded sheet: ${barcode}`;

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        /* ------------------------------------------------------------------ */
        /* Duplicate SKU inside Excel sheet                                   */
        /* ------------------------------------------------------------------ */

        if (
          sku &&
          sheetSkus.has(normalizedSku)
        ) {
          const reason =
            `Duplicate SKU in uploaded sheet: ${sku}`;

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        /* ------------------------------------------------------------------ */
        /* Barcode already in database                                        */
        /* ------------------------------------------------------------------ */

        const existingBarcode =
          await Product.findOne({
            barcode,
          }).lean();

        if (existingBarcode) {
          const reason =
            `Barcode already exists: ${barcode}`;

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        /* ------------------------------------------------------------------ */
        /* SKU already in database                                             */
        /* ------------------------------------------------------------------ */

        if (sku) {
          const existingSku =
            await Product.findOne({
              sku,
            }).lean();

          if (existingSku) {
            const reason =
              `SKU already exists: ${sku}`;

            skipped.push({
              row: rowNumber,
              reason,
              data: row,
            });

            console.log(
              `ROW ${rowNumber} SKIPPED: ${reason}`
            );

            continue;
          }
        }

        /* ------------------------------------------------------------------ */
        /* Product data                                                        */
        /* ------------------------------------------------------------------ */

        const productData = {
          name,
          barcode,
          price: salePrice,
          purchasePrice,
          salePrice,
          stock,
          category,
          unit,
          image,
        };

        /*
         * Do not send sku: ""
         * because unique MongoDB indexes can
         * reject multiple empty SKU values.
         */
        if (sku) {
          productData.sku = sku;
        }

        /* ------------------------------------------------------------------ */
        /* Create product                                                      */
        /* ------------------------------------------------------------------ */

        const product =
          await Product.create(
            productData
          );

        /* ------------------------------------------------------------------ */
        /* Mark successfully used barcode/SKU                                 */
        /* ------------------------------------------------------------------ */

        sheetBarcodes.add(
          normalizedBarcode
        );

        if (sku) {
          sheetSkus.add(
            normalizedSku
          );
        }

        /* ------------------------------------------------------------------ */
        /* Successful result                                                   */
        /* ------------------------------------------------------------------ */

        imported.push({
          row: rowNumber,
          productId: product._id,
          name: product.name,
          sku: product.sku || "",
          barcode: product.barcode,
        });

        console.log(
          `ROW ${rowNumber} IMPORTED:`,
          {
            name: product.name,
            sku: product.sku || "",
            barcode: product.barcode,
          }
        );
      } catch (rowError) {
        console.error(
          `ROW ${rowNumber} IMPORT ERROR:`,
          rowError
        );

        /* ------------------------------------------------------------------ */
        /* Mongo duplicate key error                                          */
        /* ------------------------------------------------------------------ */

        if (rowError?.code === 11000) {
          const duplicateField =
            Object.keys(
              rowError.keyPattern || {}
            )[0] ||
            Object.keys(
              rowError.keyValue || {}
            )[0];

          let reason =
            "Duplicate product data";

          if (duplicateField === "sku") {
            reason =
              `SKU already exists: ${
                rowError?.keyValue?.sku ||
                ""
              }`;
          }

          if (
            duplicateField ===
            "barcode"
          ) {
            reason =
              `Barcode already exists: ${
                rowError?.keyValue?.barcode ||
                ""
              }`;
          }

          skipped.push({
            row: rowNumber,
            reason,
            data: row,
          });

          console.log(
            `ROW ${rowNumber} SKIPPED: ${reason}`
          );

          continue;
        }

        /* ------------------------------------------------------------------ */
        /* Other row error                                                     */
        /* ------------------------------------------------------------------ */

        const reason =
          rowError?.message ||
          "Failed to import row";

        skipped.push({
          row: rowNumber,
          reason,
          data: row,
        });

        console.log(
          `ROW ${rowNumber} SKIPPED: ${reason}`
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Summary                                                                */
    /* ---------------------------------------------------------------------- */

    console.log(
      "\n========================================"
    );

    console.log(
      "PRODUCT IMPORT RESULT:",
      {
        totalRows: rows.length,
        imported: imported.length,
        skipped: skipped.length,
      }
    );

    /* ---------------------------------------------------------------------- */
    /* Group skipped reasons                                                  */
    /* ---------------------------------------------------------------------- */

    if (skipped.length > 0) {
      const skipReasons = {};

      for (const skippedRow of skipped) {
        const reason =
          skippedRow.reason ||
          "Unknown";

        skipReasons[reason] =
          (skipReasons[reason] || 0) + 1;
      }

      console.log(
        "PRODUCT IMPORT SKIP REASONS:",
        skipReasons
      );
    }

    console.log(
      "========================================\n"
    );

    /* ---------------------------------------------------------------------- */
    /* Response                                                               */
    /* ---------------------------------------------------------------------- */

    return res.status(200).json({
      success: true,
      message:
        "Product import completed",

      summary: {
        totalRows: rows.length,
        imported: imported.length,
        skipped: skipped.length,
      },

      imported,
      skipped,
    });
  } catch (error) {
    console.error(
      "Product import fatal error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to import products",
      error:
        error?.message ||
        "Unknown import error",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* DOWNLOAD PRODUCT TEMPLATE                                                  */
/* -------------------------------------------------------------------------- */

export const downloadProductTemplate = async (
  req,
  res
) => {
  try {
    const templateData = [
      {
        "Product Name":
          "Paracetamol 500mg",

        SKU:
          "PARA-500-001",

        Barcode:
          "1234567890123",

        "Purchase Price":
          80,

        "Sale Price":
          120,

        Stock:
          50,

        Category:
          "Tablet",

        Unit:
          "box",

        Image:
          "",
      },
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(
        templateData
      );

    /* ---------------------------------------------------------------------- */
    /* Column widths                                                          */
    /* ---------------------------------------------------------------------- */

    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
      { wch: 35 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Products"
    );

    const buffer =
      XLSX.write(
        workbook,
        {
          type: "buffer",
          bookType: "xlsx",
        }
      );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="products-template.xlsx"'
    );

    return res.send(buffer);
  } catch (error) {
    console.error(
      "Product template error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate product template",
      error:
        error?.message ||
        "Unknown template error",
    });
  }
};