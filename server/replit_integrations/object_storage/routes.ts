import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  const FILE_SIZE_LIMITS: Record<string, number> = {
    image: 10 * 1024 * 1024,
    audio: 25 * 1024 * 1024,
    video: 100 * 1024 * 1024,
  };

  const getMediaCategory = (contentType: string, fileName: string): string => {
    if (contentType?.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(fileName)) return 'video';
    if (contentType?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac|webm)$/i.test(fileName)) return 'audio';
    return 'image';
  };

  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const category = getMediaCategory(contentType || '', name);
      if (size && size > 0) {
        const maxSize = FILE_SIZE_LIMITS[category] || FILE_SIZE_LIMITS.image;
        if (size > maxSize) {
          const maxMB = Math.round(maxSize / (1024 * 1024));
          return res.status(413).json({
            error: "file_too_large",
            message: `${category.charAt(0).toUpperCase() + category.slice(1)} files must be under ${maxMB}MB. Your file is ${(size / (1024 * 1024)).toFixed(1)}MB.`,
            maxSize,
            maxMB,
            category,
          });
        }
      } else if (category === 'audio' || category === 'video') {
        return res.status(400).json({
          error: "missing_file_size",
          message: "File size is required for audio and video uploads.",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

