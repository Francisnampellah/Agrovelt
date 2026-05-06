# Product Image Upload Feature

This document describes how product images are handled in the Agrovelt POS system.

## Overview

Product images are stored in a Docker volume for persistence and served statically through the Express API. The system implements a secure and efficient image management approach.

## Features

- **Automatic File Organization**: Images are stored in `uploads/products/` directory with unique filenames
- **Image Validation**: Only JPEG, PNG, GIF, and WebP formats are allowed
- **File Size Limit**: Maximum 5MB per image
- **Volume Persistence**: Images survive container restarts
- **Static File Serving**: Images are served without authentication
- **URL Storage**: Image URLs are stored in the database for easy retrieval

## Database Schema

The `Product` model now includes three image-related fields:

```prisma
model Product {
  // ...existing fields...
  
  // Image handling
  imageUrl     String?       // URL to access the image (e.g., /uploads/products/image.jpg)
  imagePath    String?       // File path in volume (e.g., image-uuid.jpg)
  imageMimeType String?      // e.g., image/jpeg, image/png
  
  // ...existing fields...
}
```

## API Endpoints

### 1. Create Product (with optional image)

**Endpoint**: `POST /api/products`

**Request** (multipart/form-data):
```
Headers:
  Authorization: Bearer <token>
  Content-Type: multipart/form-data

Body:
  - name: Product name (text)
  - description: Product description (text)
  - organizationId: UUID (text)
  - categoryId: UUID (text, optional)
  - unit: Measurement unit (text, optional)
  - image: Image file (binary, optional)
```

**Response**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Product name",
    "description": "Description",
    "imageUrl": "/uploads/products/product-uuid.jpg",
    "imagePath": "product-uuid.jpg",
    "imageMimeType": "image/jpeg",
    "organizationId": "uuid",
    "createdAt": "2026-05-06T11:14:29.000Z"
  }
}
```

### 2. Upload Product Image

**Endpoint**: `POST /api/products/{id}/image`

**Request** (multipart/form-data):
```
Headers:
  Authorization: Bearer <token>
  Content-Type: multipart/form-data

Parameters:
  id: Product UUID (path parameter)

Body:
  - image: Image file (binary, required)
```

**Response**:
```json
{
  "message": "Product image uploaded successfully",
  "data": {
    "id": "uuid",
    "name": "Product name",
    "imageUrl": "/uploads/products/product-uuid.jpg",
    "imagePath": "product-uuid.jpg",
    "imageMimeType": "image/jpeg",
    "updatedAt": "2026-05-06T11:15:00.000Z"
  }
}
```

### 3. Get Product (includes image URL)

**Endpoint**: `GET /api/products/{id}`

**Response**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Product name",
    "imageUrl": "/uploads/products/product-uuid.jpg",
    "imageMimeType": "image/jpeg",
    "category": { "id": "uuid", "name": "Fertilizers" },
    "variants": [...]
  }
}
```

### 4. Delete Product (removes image)

**Endpoint**: `DELETE /api/products/{id}`

**Response**:
```json
{
  "message": "Product deleted successfully"
}
```

When a product is deleted, its associated image file is automatically removed from the volume.

## Image Access

Images are publicly accessible at:
```
http://<api-url>/uploads/products/<filename>
```

Example: `http://localhost:4000/uploads/products/product-uuid.jpg`

**Note**: The `/uploads` path does NOT require authentication for GET requests to allow client applications to display product images without additional API calls.

## File Structure

```
project-root/
├── uploads/
│   └── products/
│       ├── product-abc123.jpg
│       ├── product-def456.png
│       └── product-ghi789.gif
├── src/
├── prisma/
└── docker-compose.yml
```

## Docker Volume Configuration

The `uploads` directory is mounted as a volume in `docker-compose.yml`:

```yaml
services:
  api:
    volumes:
      - ./uploads:/app/uploads  # Persist uploaded files
```

This ensures that images are retained even when containers are restarted or removed.

## File Upload Utilities

The file upload functionality is centralized in `src/utils/fileUpload.ts`:

### Functions

- **`uploadProductImage`**: Multer middleware for single file upload
- **`deleteFile(filePath: string)`**: Removes a file from the volume
- **`getFilePath(filename: string)`**: Generates the public URL for an image
- **`getFileSystemPath(filename: string)`**: Gets the full file system path

### Example Usage

```typescript
import { uploadProductImage, deleteFile, getFilePath } from './utils/fileUpload'

// Use in routes
router.post('/products/:id/image', uploadProductImage.single('image'), handler)

// Delete a file
deleteFile('product-uuid.jpg')

// Get public URL
const url = getFilePath('product-uuid.jpg') // Returns: /uploads/products/product-uuid.jpg
```

## Error Handling

### Invalid File Type
```json
{
  "error": "Only image files are allowed (jpeg, png, gif, webp)"
}
```

### File Size Exceeded
```json
{
  "error": "File size too large. Maximum 5MB allowed"
}
```

### Product Not Found
```json
{
  "error": "Product not found"
}
```

## Best Practices

1. **Validate File Type**: Always validate on both client and server
2. **Optimize Images**: Consider compressing images before upload
3. **Handle Storage**: Monitor disk space for the uploads volume
4. **Backup**: Regularly backup the uploads volume
5. **CDN Integration**: For production, consider serving images from a CDN

## Security Considerations

1. **File Type Validation**: Only specific MIME types are allowed
2. **File Size Limits**: 5MB maximum to prevent abuse
3. **Authentication**: Image upload requires valid JWT token
4. **Public Access**: Images are publicly viewable (no auth required for GET)
5. **Directory Isolation**: Files are stored in a dedicated `uploads/products/` directory

## Cleanup

To clear uploaded images:

```bash
# Remove uploads directory
rm -rf uploads/

# Or in Docker
docker volume rm agrovelt_uploads
```

Images will be re-created as new files are uploaded.

## Troubleshooting

### Images not persisting after restart
- Ensure the volume is properly mounted in docker-compose.yml
- Check file permissions on the host machine
- Verify the `uploads` directory exists and is writable

### "File not found" when accessing image URL
- Verify the image was successfully uploaded
- Check the database for the correct `imageUrl`
- Ensure the Express server is serving static files from `/uploads`

### Upload fails with permission error
- Check Docker container permissions
- Ensure the `uploads` directory is writable by the container user
- Verify volume mount permissions

## Future Enhancements

- [ ] Image compression and thumbnail generation
- [ ] Multiple images per product
- [ ] Image cropping and editing
- [ ] CDN integration
- [ ] Image analytics and usage tracking
- [ ] Batch image upload
