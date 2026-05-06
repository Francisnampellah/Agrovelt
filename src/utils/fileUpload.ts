import path from 'path'
import fs from 'fs'
import multer, { FileFilterCallback } from 'multer'
import { v4 as uuidv4 } from 'uuid'

// Define upload directory
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products')

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req: any, file: any, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    const filename = `${name}-${uuidv4()}${ext}`
    cb(null, filename)
  }
})

// File filter for images only
const fileFilter = (req: any, file: any, cb: FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'))
  }
}

// Create multer upload middleware
export const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
})

// Utility function to delete a file
export const deleteFile = (filePath: string): boolean => {
  try {
    const fullPath = path.join(UPLOAD_DIR, filePath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
      return true
    }
    return false
  } catch (error) {
    console.error('Error deleting file:', error)
    return false
  }
}

// Utility function to get full file path
export const getFilePath = (filename: string): string => {
  return `/uploads/products/${filename}`
}

// Utility function to get file system path
export const getFileSystemPath = (filename: string): string => {
  return path.join(UPLOAD_DIR, filename)
}
