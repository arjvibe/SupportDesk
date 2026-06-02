import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Interface definition for file storage service providers.
 * Decouples the upload/delete mechanisms from Express controllers.
 */
export interface StorageService {
  /**
   * Uploads a file buffer to the target storage directory.
   * 
   * @param file The Express parsed multer file object
   * @param folder The subfolder destination (e.g. 'branding', 'attachments')
   * @param orgId The active organization identifier (tenant partitioning key)
   * @returns The absolute URL or served relative path of the uploaded file
   */
  uploadFile(file: Express.Multer.File, folder: string, orgId: string): Promise<string>;

  /**
   * Deletes a file from the target storage service.
   * 
   * @param filePath The relative path or S3/CDN URL of the file to remove
   */
  deleteFile(filePath: string): Promise<void>;
}

/**
 * Local file system implementation of StorageService.
 * Used for development environments, partitioning uploads under uploads/[orgId]/[folder].
 */
export class LocalStorageService implements StorageService {
  async uploadFile(file: Express.Multer.File, folder: string, orgId: string): Promise<string> {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    const cleanName = `${timestamp}-${Math.round(Math.random() * 1e9)}${ext}`;
    
    // Build path: backend/uploads/[orgId]/[folder]/[cleanName]
    const targetDir = path.join(__dirname, "../../uploads", orgId, folder);
    
    // Ensure target directory hierarchy exists
    await fs.promises.mkdir(targetDir, { recursive: true });
    
    const targetPath = path.join(targetDir, cleanName);
    await fs.promises.writeFile(targetPath, file.buffer);
    
    // Return relative URL route path
    return `/uploads/${orgId}/${folder}/${cleanName}`;
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      // Remove starting slash if present and replace /uploads
      const relativePath = filePath.replace(/^\/?uploads\/?/, "");
      const targetPath = path.join(__dirname, "../../uploads", relativePath);
      
      if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
      }
    } catch (error) {
      console.error(`Failed to delete local file at path ${filePath}:`, error);
    }
  }
}

/**
 * AWS S3 cloud storage implementation of StorageService.
 * Used for production/staging environments, partitioning files using key prefix: [orgId]/[folder]/[filename].
 */
export class S3StorageService implements StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;
  private cdnDomain?: string;

  constructor() {
    this.region = process.env.AWS_REGION || "us-east-1";
    this.bucketName = process.env.AWS_S3_BUCKET || "";
    this.cdnDomain = process.env.CDN_DOMAIN; // e.g. https://cdn.mycompany.com

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string, orgId: string): Promise<string> {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    const cleanName = `${timestamp}-${Math.round(Math.random() * 1e9)}${ext}`;
    
    // S3 Key prefix pattern
    const key = `${orgId}/${folder}/${cleanName}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    // If CDN is configured, return prefix domain, otherwise fallback to direct S3 URL
    if (this.cdnDomain) {
      const base = this.cdnDomain.replace(/\/$/, "");
      return `${base}/${key}`;
    }
    
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      let key = "";
      if (this.cdnDomain && filePath.startsWith(this.cdnDomain)) {
        key = filePath.replace(this.cdnDomain, "").replace(/^\//, "");
      } else {
        const urlObj = new URL(filePath);
        key = urlObj.pathname.replace(/^\//, "");
      }

      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
    } catch (error) {
      console.error(`Failed to delete file from S3 bucket: ${filePath}`, error);
    }
  }
}

/**
 * Factory resolver that returns the configured StorageService implementation.
 * Reads configurations from process.env.STORAGE_PROVIDER ('local' or 's3').
 */
export function getStorageService(): StorageService {
  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider === "s3") {
    return new S3StorageService();
  }
  return new LocalStorageService();
}
