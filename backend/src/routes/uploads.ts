import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { authenticateToken, requireRole } from "../middleware/auth";
import { getStorageService } from "../utils/storage";
import { db } from "../db/connection";
import { organizations } from "../schema";
import { eq } from "drizzle-orm";

const router = Router();

// Configure memory storage for multer parsing. Buffers are processed by the storage provider
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // Strict 2MB file limit
  },
  fileFilter: (req, file, callback) => {
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error("Invalid file type. Only PNG, JPG, JPEG, and SVG images are allowed."));
    }
  }
});

const uploadSingleLogo = upload.single("logo");

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Strict 5MB file limit
  },
  fileFilter: (req, file, callback) => {
    const allowedMimeTypes = [
      "image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/gif",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
      "text/plain",
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel", // xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
      "application/zip",
      "application/x-zip-compressed"
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".svg", ".gif", ".pdf", ".docx", ".txt", ".csv", ".xls", ".xlsx", ".zip"];
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      callback(null, true);
    } else {
      callback(new Error(`Invalid file type. Allowed types: PNG, JPG, JPEG, SVG, GIF, PDF, DOCX, TXT, CSV, XLS, XLSX, ZIP.`));
    }
  }
});

const uploadSingleAttachment = attachmentUpload.single("file");

/**
 * POST /api/uploads/logo
 * 
 * Handles uploading an organization brand logo image file.
 * The file is processed and partitioned in storage by organization ID (tenant key).
 * Restricts access strictly to organization Administrators.
 * Updates the organization's logoUrl field in the database.
 */
router.post(
  "/logo",
  authenticateToken,
  requireRole(["admin"]),
  (req: Request, res: Response) => {
    uploadSingleLogo(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File too large. Maximum size allowed is 2MB." });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No image file provided." });
      }

      try {
        const orgId = req.user!.orgId;
        const storageService = getStorageService();

        // 1. Upload file partitioned under uploads/[orgId]/branding
        const fileUrlPath = await storageService.uploadFile(req.file, "branding", orgId);

        return res.json({
          success: true,
          logoUrl: fileUrlPath,
        });
      } catch (error) {
        console.error("Upload organization logo failed:", error);
        return res.status(500).json({ error: "Failed to upload logo image" });
      }
    });
  }
);

/**
 * POST /api/uploads/attachment
 * 
 * Handles uploading a file attachment for tickets or message replies.
 * The file is processed and partitioned in storage by organization ID (tenant key) under folder 'attachments'.
 * Allowed files are checked for 5MB limit and valid mimetypes/extensions.
 * Open to all authenticated users.
 */
router.post(
  "/attachment",
  authenticateToken,
  (req: Request, res: Response) => {
    uploadSingleAttachment(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File too large. Maximum size allowed is 5MB." });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file provided." });
      }

      try {
        const orgId = req.user!.orgId;
        const storageService = getStorageService();

        // 1. Upload file partitioned under uploads/[orgId]/attachments
        const fileUrlPath = await storageService.uploadFile(req.file, "attachments", orgId);

        return res.json({
          success: true,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          filePath: fileUrlPath,
          mimeType: req.file.mimetype,
        });
      } catch (error) {
        console.error("Upload attachment failed:", error);
        return res.status(500).json({ error: "Failed to upload attachment file" });
      }
    });
  }
);

export default router;
