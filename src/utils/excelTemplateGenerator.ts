import * as ExcelJS from 'exceljs'
import * as fs from 'fs'
import * as path from 'path'

export interface TemplateColumn {
  name: string
  required?: boolean
  type?: string
  dropdownValues?: string[]
}

export interface TemplateOptions {
  columns: TemplateColumn[]
  sheetName?: string
}

/**
 * Generate Excel template with headers and data validation dropdowns using ExcelJS
 */
export async function createExcelTemplate(options: TemplateOptions): Promise<ExcelJS.Workbook> {
  const { columns, sheetName = 'Data' } = options

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)

  // Add header row
  const headerRow = worksheet.addRow(columns.map(col => col.name))
  
  // Format header row
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' }
    }
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' }
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Add data validation (dropdowns)
  columns.forEach((col, colIndex) => {
    if (col.dropdownValues && col.dropdownValues.length > 0) {
      const colNumber = colIndex + 1
      // Apply to rows 2 to 1000
      for (let i = 2; i <= 1000; i++) {
        const cell = worksheet.getCell(i, colNumber)
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${col.dropdownValues.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid Selection',
          error: `Please select a value from the dropdown for ${col.name}`
        }
      }
    }
  })

  // Set column widths
  worksheet.columns = columns.map(col => ({
    header: col.name,
    key: col.name,
    width: Math.max(15, col.name.length + 5)
  }))

  return workbook
}

/**
 * Generate product bulk import template
 */
export async function generateProductTemplate(categories: string[]): Promise<ExcelJS.Workbook> {
  return createExcelTemplate({
    columns: [
      { name: 'name', required: true, type: 'string' },
      { name: 'description', required: false, type: 'string' },
      { name: 'categoryName', required: false, type: 'string', dropdownValues: categories },
      { name: 'unit', required: false, type: 'string' },
      { name: 'dosageInfo', required: false, type: 'string' },
      { name: 'manufacturer', required: false, type: 'string' },
      { name: 'isRestricted', required: false, type: 'boolean', dropdownValues: ['Yes', 'No'] }
    ],
    sheetName: 'Products'
  })
}

/**
 * Generate inventory update template
 */
export async function generateInventoryUpdateTemplate(): Promise<ExcelJS.Workbook> {
  return createExcelTemplate({
    columns: [
      { name: 'shopId', required: true, type: 'string' },
      { name: 'variantId', required: true, type: 'string' },
      { name: 'quantity', required: true, type: 'number' },
      { name: 'costPrice', required: true, type: 'number' },
      { name: 'batchNumber', required: false, type: 'string' },
      { name: 'expiryDate', required: false, type: 'date' }
    ],
    sheetName: 'Inventory Update'
  })
}

/**
 * Generate inventory adjust template
 */
export async function generateInventoryAdjustTemplate(): Promise<ExcelJS.Workbook> {
  return createExcelTemplate({
    columns: [
      { name: 'shopId', required: true, type: 'string' },
      { name: 'variantId', required: true, type: 'string' },
      { name: 'change', required: true, type: 'number' },
      { name: 'type', required: true, type: 'string', dropdownValues: ['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN'] },
      { name: 'batchNumber', required: false, type: 'string' },
      { name: 'referenceId', required: false, type: 'string' },
      { name: 'costPrice', required: false, type: 'number' }
    ],
    sheetName: 'Inventory Adjust'
  })
}

/**
 * Write workbook to file and return file path
 */
export async function saveTemplate(workbook: ExcelJS.Workbook, filename: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'uploads', 'templates')
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const filePath = path.join(uploadDir, filename)
  await workbook.xlsx.writeFile(filePath)
  return filePath
}
