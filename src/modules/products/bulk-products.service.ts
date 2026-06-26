import { PrismaClient } from '@prisma/client'
import { BulkImportResult, ExcelValidationError, validateRequiredFields, validateFieldType } from '../../utils/excelParser'
import { CreateProductRequest } from './types'

export interface BulkProductRow {
  name: string
  description?: string
  categoryName?: string
  unit?: string
  dosageInfo?: string
  manufacturer?: string
  isRestricted?: string
}

export class BulkProductService {
  constructor(private prisma: PrismaClient) {}

  private validateProductRow(row: any, rowIndex: number): ExcelValidationError[] {
    const errors: ExcelValidationError[] = []

    errors.push(...validateRequiredFields(row, rowIndex, ['name']))
    errors.push(...validateFieldType(row, rowIndex, 'name', 'string', { min: 1, max: 255 }))

    if (row.description) {
      errors.push(...validateFieldType(row, rowIndex, 'description', 'string', { max: 2000 }))
    }

    if (row.isRestricted !== undefined && row.isRestricted !== null) {
      errors.push(...validateFieldType(row, rowIndex, 'isRestricted', 'boolean'))
    }

    return errors
  }

  private async processProductRow(row: BulkProductRow): Promise<CreateProductRequest> {
    let categoryId: string | undefined

    if (row.categoryName) {
      const category = await this.prisma.category.findFirst({
        where: { name: { mode: 'insensitive', equals: row.categoryName } }
      })
      categoryId = category?.id
    }

    const isRestricted = typeof row.isRestricted === 'string'
      ? row.isRestricted.toLowerCase() === 'true' || row.isRestricted === '1'
      : Boolean(row.isRestricted)

    return {
      name: row.name,
      isRestricted,
      ...(row.description !== undefined && { description: row.description }),
      ...(categoryId !== undefined && { categoryId }),
      ...(row.unit !== undefined && { unit: row.unit }),
      ...(row.dosageInfo !== undefined && { dosageInfo: row.dosageInfo }),
      ...(row.manufacturer !== undefined && { manufacturer: row.manufacturer })
    }
  }

  async bulkImportProducts(
    rows: any[],
    dryRun: boolean = false
  ): Promise<BulkImportResult<any>> {
    const errors: ExcelValidationError[] = []
    const successData: CreateProductRequest[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowErrors = this.validateProductRow(row, i)

      if (rowErrors.length > 0) {
        errors.push(...rowErrors)
      } else {
        try {
          const processedRow = await this.processProductRow(row)
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
