import { PrismaClient, InventoryTxnType, Prisma } from '@prisma/client'
import { BulkImportResult, ExcelValidationError, validateRequiredFields, validateFieldType, parseBoolean } from '../../utils/excelParser'
import { UpdateInventoryRequest, AdjustInventoryRequest } from './types'
import { InventoryService } from './inventory.service'

export interface BulkInventoryUpdateRow {
  shopId: string
  variantId: string
  batchNumber?: string
  quantity: number | string
  costPrice: number | string
  expiryDate?: string
}

export interface BulkInventoryAdjustRow {
  shopId: string
  variantId: string
  batchNumber?: string
  change: number | string
  type: string
  referenceId?: string
}

type TxClient = Prisma.TransactionClient

export class BulkInventoryService {
  constructor(
    private prisma: PrismaClient,
    private inventoryService: InventoryService
  ) {}

  /**
   * Validate an inventory update row
   */
  private validateUpdateRow(row: any, rowIndex: number): ExcelValidationError[] {
    const errors: ExcelValidationError[] = []

    errors.push(...validateRequiredFields(row, rowIndex, ['shopId', 'variantId', 'quantity', 'costPrice']))
    errors.push(...validateFieldType(row, rowIndex, 'quantity', 'number', { min: 0 }))
    errors.push(...validateFieldType(row, rowIndex, 'costPrice', 'number', { min: 0 }))

    if (row.expiryDate) {
      errors.push(...validateFieldType(row, rowIndex, 'expiryDate', 'date'))
    }

    return errors
  }

  /**
   * Validate an inventory adjust row
   */
  private validateAdjustRow(row: any, rowIndex: number): ExcelValidationError[] {
    const errors: ExcelValidationError[] = []

    errors.push(...validateRequiredFields(row, rowIndex, ['shopId', 'variantId', 'change', 'type']))
    errors.push(...validateFieldType(row, rowIndex, 'change', 'number'))

    const validTypes = Object.values(InventoryTxnType)
    if (!validTypes.includes(row.type?.toUpperCase())) {
      errors.push({
        row: rowIndex + 2,
        field: 'type',
        value: row.type,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      })
    }

    return errors
  }

  /**
   * Process inventory update rows
   */
  async bulkUpdateInventory(
    rows: any[],
    user: { userId: string, role: string },
    dryRun: boolean = false
  ): Promise<BulkImportResult<any>> {
    const errors: ExcelValidationError[] = []
    const successData: UpdateInventoryRequest[] = []
    const shopVariantIds: Map<string, string[]> = new Map()

    // Validate and collect rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowErrors = this.validateUpdateRow(row, i)

      if (rowErrors.length > 0) {
        errors.push(...rowErrors)
      } else {
        // Refactored to omit undefined fields to support exactOptionalPropertyTypes: true
        const request: UpdateInventoryRequest = {
          shopId: row.shopId,
          variantId: row.variantId,
          batchNumber: row.batchNumber || 'DEFAULT',
          quantity: Number(row.quantity),
          costPrice: Number(row.costPrice),
          ...(row.expiryDate !== undefined && { expiryDate: row.expiryDate })
        }

        successData.push(request)

        // Track variants per shop for organization validation
        if (!shopVariantIds.has(row.shopId)) {
          shopVariantIds.set(row.shopId, [])
        }
        shopVariantIds.get(row.shopId)!.push(row.variantId)
      }
    }

    // Validate organization consistency for each shop
    for (const [shopId, variantIds] of shopVariantIds.entries()) {
      try {
        // 1. Verify user has access to this shop
        await this.inventoryService.assertShopAccess(shopId, user.userId, user.role)
        // 2. Verify all variants belong to the same organization as the shop
        await this.inventoryService.assertSameOrg(shopId, [...new Set(variantIds)])
      } catch (error: any) {
        errors.push({
          row: 0,
          field: 'shopId',
          value: shopId,
          error: `Organization validation failed: ${error.message}`
        })
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

    // Execute updates in transaction
    let updatedCount = 0
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const request of successData) {
          await this.inventoryService.updateInventory(request, tx)
          updatedCount++
        }
      })
    } catch (error: any) {
      return {
        success: false,
        totalRows: rows.length,
        successCount: updatedCount,
        failureCount: rows.length - updatedCount,
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
      successCount: updatedCount,
      failureCount: 0,
      data: [],
      errors: []
    }
  }

  /**
   * Process inventory adjust rows
   */
  async bulkAdjustInventory(
    rows: any[],
    user: { userId: string, role: string },
    dryRun: boolean = false
  ): Promise<BulkImportResult<any>> {
    const errors: ExcelValidationError[] = []
    const successData: (AdjustInventoryRequest & { costPrice?: number })[] = []
    const shopVariantIds: Map<string, string[]> = new Map()

    // Validate and collect rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowErrors = this.validateAdjustRow(row, i)

      if (rowErrors.length > 0) {
        errors.push(...rowErrors)
      } else {
        // Refactored to omit undefined fields to support exactOptionalPropertyTypes: true
        const request: AdjustInventoryRequest & { costPrice?: number } = {
          shopId: row.shopId,
          variantId: row.variantId,
          batchNumber: row.batchNumber || 'DEFAULT',
          change: Number(row.change),
          type: row.type.toUpperCase() as InventoryTxnType,
          ...(row.referenceId !== undefined && { referenceId: row.referenceId }),
          ...(row.costPrice !== undefined && { costPrice: Number(row.costPrice) })
        }

        successData.push(request)

        // Track variants per shop
        if (!shopVariantIds.has(row.shopId)) {
          shopVariantIds.set(row.shopId, [])
        }
        shopVariantIds.get(row.shopId)!.push(row.variantId)
      }
    }

    // Validate organization consistency
    for (const [shopId, variantIds] of shopVariantIds.entries()) {
      try {
        // 1. Verify user has access to this shop
        await this.inventoryService.assertShopAccess(shopId, user.userId, user.role)
        // 2. Verify all variants belong to the same organization as the shop
        await this.inventoryService.assertSameOrg(shopId, [...new Set(variantIds)])
      } catch (error: any) {
        errors.push({
          row: 0,
          field: 'shopId',
          value: shopId,
          error: `Organization validation failed: ${error.message}`
        })
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

    // Execute adjustments in transaction
    let adjustedCount = 0
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const request of successData) {
          await this.inventoryService.adjustInventory(request, tx)
          adjustedCount++
        }
      })
    } catch (error: any) {
      return {
        success: false,
        totalRows: rows.length,
        successCount: adjustedCount,
        failureCount: rows.length - adjustedCount,
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
      successCount: adjustedCount,
      failureCount: 0,
      data: [],
      errors: []
    }
  }
}
