import express from "express";
import multer from "multer";

import {
  importProducts,
  downloadProductTemplate,
} from "../controllers/importExportController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      ".csv",
      ".xls",
      ".xlsx",
      ".xlsm",
      ".ods",
    ];

    const fileName = String(file.originalname || "").toLowerCase();

    const isAllowed = allowedExtensions.some((extension) =>
      fileName.endsWith(extension)
    );

    if (!isAllowed) {
      cb(
        new Error(
          "Unsupported file format. Please upload CSV, XLS, XLSX, XLSM or ODS file."
        )
      );
      return;
    }

    cb(null, true);
  },
});

router.post(
  "/products",
  upload.single("file"),
  importProducts
);

router.get(
  "/products/template",
  downloadProductTemplate
);

export default router;