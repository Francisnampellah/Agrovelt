import { PrismaClient } from '@prisma/client'
import { BulkImportResult, ExcelValidationError, validateRequiredFields, validateFieldType, normalizeRow } from '../../utils/excelParser'
import { CreateProductRequest } from './types'

export interface BulkProductRow {
  name: string
  description?: string
  categoryName?: string
  organizationId: string
  unit?: string
  dosageInfo?: string
  manufacturer?: string
  isRestricted?: string
}

export class BulkProductService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Validate a single product row
   */
  private validateProductRow(row: any, rowIndex: number, organizationId: string): ExcelValidationError[] {
    const errors: ExcelValidationError[] = []

    // Required fields
    errors.push(...validateRequiredFields(row, rowIndex, ['name']))

    // Field types
    errors.push(...validateFieldType(row, rowIndex, 'name', 'string', { min: 1, max: 255 }))

    // Optional fields validation
    if (row.description) {
      errors.push(...validateFieldType(row, rowIndex, 'description', 'string', { max: 2000 }))
    }

    if (row.isRestricted !== undefined && row.isRestricted !== null) {
      errors.push(...validateFieldType(row, rowIndex, 'isRestricted', 'boolean'))
    }

    return errors
  }

  /**
   * Process a single product row and resolve category
   */
  private async processProductRow(row: BulkProductRow, organizationId: string): Promise<CreateProductRequest> {
    let categoryId: string | undefined

    if (row.categoryName) {
      const category = await this.prisma.category.findFirst({
        where: { name: { mode: 'insensitive', equals: row.categoryName } }
      })
      categoryId = category?.id
      // Note: If category doesn't exist, we don't fail; categoryId stays undefined
    }

    const isRestricted = typeof row.isRestricted === 'string' 
      ? row.isRestricted.toLowerCase() === 'true' || row.isRestricted === '1'
      : Boolean(row.isRestricted)

    // Refactored to omit undefined fields to support exactOptionalPropertyTypes: true
    return {
      name: row.name,
      organizationId,
      isRestricted,
      ...(row.description !== undefined && { description: row.description }),
      ...(categoryId !== undefined && { categoryId }),
      ...(row.unit !== undefined && { unit: row.unit }),
      ...(row.dosageInfo !== undefined && { dosageInfo: row.dosageInfo }),
      ...(row.manufacturer !== undefined && { manufacturer: row.manufacturer })
    }
  }

  /**
   * Bulk import products from parsed Excel data
   */
  async bulkImportProducts(
    rows: any[],
    organizationId: string,
    dryRun: boolean = false
  ): Promise<BulkImportResult<any>> {
    const errors: ExcelValidationError[] = []
    const successData: CreateProductRequest[] = []

    // Validate all rows first
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowErrors = this.validateProductRow(row, i, organizationId)
      
      if (rowErrors.length > 0) {
        errors.push(...rowErrors)
      } else {
        try {
          const processedRow = await this.processProductRow(row, organizationId)
          successData.push(processedRow)
        } catch (error: any) {
          errors.push({
            row: i + 2,
            field: 'general',
            value: row,
            error: `Error processing row: ${error.message}`
          })
        }
      }
    }

    // If dry run or there are errors, return early
    if (dryRun || errors.length > 0) {
      return {
        success: errors.length === 0,
        totalRows: rows.length,
        successCount: successData.length,
        failureCount: errors.length,
        data: dryRun ? successData : [],
        errors
      }
    }

    // Process successful rows with transaction
    let createdProducts = 0
    try {
      const results = await this.prisma.$transaction(
        successData.map(data => 
          this.prisma.product.create({
            data,
            include: { category: true }
          })
        )
      )
      createdProducts = results.length
    } catch (error: any) {
      return {
        success: false,
        totalRows: rows.length,
        successCount: 0,
        failureCount: rows.length,
        data: [],
        errors: [{
          row: 0,
          field: 'transaction',
          value: null,
          error: `Transaction failed: ${error.message}`
        }]
      }
    }

    return {
      success: true,
      totalRows: rows.length,
      successCount: createdProducts,
      failureCount: 0,
      data: [],
      errors: []
    }
  }
}
