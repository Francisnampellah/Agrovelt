import * as XLSX from 'xlsx'

export interface ExcelValidationError {
  row: number
  field: string
  value: any
  error: string
}

export interface BulkImportResult<T> {
  success: boolean
  totalRows: number
  successCount: number
  failureCount: number
  data?: T[]
  errors: ExcelValidationError[]
}

/**
 * Parse Excel file and extract sheet data
 */
export function parseExcelFile(filePath: string, sheetName?: string): any[] {
  const workbook = XLSX.readFile(filePath)
  const sheetNames = workbook.SheetNames
  
  if (sheetNames.length === 0) {
    throw new Error('Workbook has no sheets')
  }

  // Safe access to sheet name
  const firstSheetName = sheetNames[0]
  const selectedSheetName = sheetName || firstSheetName

  if (!selectedSheetName) {
    throw new Error('Could not determine sheet name')
  }

  const sheet = workbook.Sheets[selectedSheetName]
  
  if (!sheet) {
    throw new Error(`Sheet "${selectedSheetName}" not found in workbook`)
  }

  // Use header: 1 to get raw array of arrays
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 })
  
  if (rows.length === 0) {
    return []
  }

  const headers = rows[0]
  if (!headers || !Array.isArray(headers)) {
    return []
  }

  const dataRows = rows.slice(1)

  return dataRows.map((row) => {
    const parsedRow: Record<string, any> = {}
    
    headers.forEach((header, index) => {
      // Preferred safe pattern to avoid TS2538: Type 'undefined' cannot be used as an index type
      const key = header as string | undefined
      if (key !== undefined && key !== null && String(key).trim() !== '') {
        parsedRow[String(key)] = row[index]
      }
    })
    
    return parsedRow
  })
}

/**
 * Validate required fields in a row
 */
export function validateRequiredFields(row: any, rowIndex: number, requiredFields: string[]): ExcelValidationError[] {
  const errors: ExcelValidationError[] = []
  
  for (const field of requiredFields) {
    const value = row[field]
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      errors.push({
        row: rowIndex + 2, // +2 because rowIndex is 0-based and row 1 is header
        field,
        value,
        error: `${field} is required`
      })
    }
  }
  
  return errors
}

/**
 * Validate field type and constraints
 */
export function validateFieldType(
  row: any,
  rowIndex: number,
  field: string,
  type: 'string' | 'number' | 'date' | 'boolean' | 'email',
  constraints?: {
    min?: number
    max?: number
    pattern?: RegExp
  }
): ExcelValidationError[] {
  const errors: ExcelValidationError[] = []
  const value = row[field]

  if (value === undefined || value === null) return errors

  try {
    switch (type) {
      case 'number':
        const num = Number(value)
        if (isNaN(num)) {
          errors.push({
            row: rowIndex + 2,
            field,
            value,
            error: `${field} must be a valid number`
          })
        } else {
          if (constraints?.min !== undefined && num < constraints.min) {
            errors.push({
              row: rowIndex + 2,
              field,
              value,
              error: `${field} must be >= ${constraints.min}`
            })
          }
          if (constraints?.max !== undefined && num > constraints.max) {
            errors.push({
              row: rowIndex + 2,
              field,
              value,
              error: `${field} must be <= ${constraints.max}`
            })
          }
        }
        break

      case 'date':
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          errors.push({
            row: rowIndex + 2,
            field,
            value,
            error: `${field} must be a valid date`
          })
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== 1 && value !== 0) {
          errors.push({
            row: rowIndex + 2,
            field,
            value,
            error: `${field} must be a boolean (true/false or 0/1)`
          })
        }
        break

      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailPattern.test(String(value))) {
          errors.push({
            row: rowIndex + 2,
            field,
            value,
            error: `${field} must be a valid email address`
          })
        }
        break

      case 'string':
        if (constraints?.pattern && !constraints.pattern.test(String(value))) {
          errors.push({
            row: rowIndex + 2,
            field,
            value,
            error: `${field} format is invalid`
          })
        }
        break
    }
  } catch (error: any) {
    errors.push({
      row: rowIndex + 2,
      field,
      value,
      error: `Error validating ${field}: ${error.message}`
    })
  }

  return errors
}

/**
 * Parse boolean from various representations
 */
export function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes'
  }
  return false
}

/**
 * Clean and normalize row data
 */
export function normalizeRow(row: any, fieldMappings: Record<string, string>): any {
  const normalized: any = {}
  
  for (const [key, mappedKey] of Object.entries(fieldMappings)) {
    const value = row[key]
    if (value !== undefined && value !== null) {
      normalized[mappedKey] = typeof value === 'string' ? value.trim() : value
    }
  }
  
  return normalized
}
