import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LocalStorageService, getStorageService } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Storage Service - Local Storage Provider Lifecycle", async () => {
  const service = new LocalStorageService();
  const mockFile = {
    originalname: "test-logo.png",
    buffer: Buffer.from("mock-image-content-bytes"),
    mimetype: "image/png",
    fieldname: "logo",
    encoding: "7bit",
    size: 24,
    stream: null as any,
    destination: "",
    filename: "",
    path: ""
  } as Express.Multer.File;

  const orgId = "test-tenant-999";
  const folder = "branding";

  // 1. Verify file upload creates folder structure and writes content
  const resultPath = await service.uploadFile(mockFile, folder, orgId);
  
  // Assert path matches expected relative pattern
  assert.match(resultPath, /^\/uploads\/test-tenant-999\/branding\/\d+-\d+\.png$/);

  // Compute disk target location
  const diskPath = path.join(__dirname, "../../uploads", orgId, folder, path.basename(resultPath));
  
  // Assert file exists on disk and content matches
  assert.strictEqual(fs.existsSync(diskPath), true);
  assert.strictEqual(fs.readFileSync(diskPath, "utf-8"), "mock-image-content-bytes");

  // 2. Verify file deletion unlinks target asset cleanly
  await service.deleteFile(resultPath);
  assert.strictEqual(fs.existsSync(diskPath), false);

  // Clean up empty directories
  try {
    const parentDir = path.dirname(diskPath);
    const tenantDir = path.dirname(parentDir);
    fs.rmdirSync(parentDir);
    fs.rmdirSync(tenantDir);
  } catch (err) {
    // Silently ignore cleanup errors if folder not empty
  }
});

test("Storage Service - Factory Resolver Configuration", () => {
  // Mock local provider env
  process.env.STORAGE_PROVIDER = "local";
  const localService = getStorageService();
  assert.strictEqual(localService.constructor.name, "LocalStorageService");

  // Mock S3 provider env
  process.env.STORAGE_PROVIDER = "s3";
  const s3Service = getStorageService();
  assert.strictEqual(s3Service.constructor.name, "S3StorageService");

  // Clean up environment variables
  delete process.env.STORAGE_PROVIDER;
});
