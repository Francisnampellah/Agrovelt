export const REPORT_GROUP_BY = ['DAY', 'WEEK', 'MONTH', 'SHOP', 'NONE'] as const
export type ReportGroupBy = (typeof REPORT_GROUP_BY)[number]

export const REPORT_PAYMENT_METHODS = ['CASH', 'CARD', 'MOBILE'] as const
export type ReportPaymentMethod = (typeof REPORT_PAYMENT_METHODS)[number]

export const REPORT_TRANSACTION_TYPES = [
  'SALE',
  'REFUND',
  'EXPENSE',
  'PURCHASE',
  'FUNDING',
  'ADJUSTMENT',
  'RETURN',
  'TRANSFER',
  'LOSS',
  'EXPIRED'
] as const
export type ReportTransactionType = (typeof REPORT_TRANSACTION_TYPES)[number]

export type ReportInclude = {
  summary?: boolean
  cashMovement?: boolean
  sales?: boolean
  refunds?: boolean
  expenses?: boolean
  purchases?: boolean
  funding?: boolean
  inventorySnapshot?: boolean
  productMovements?: boolean
  topProducts?: boolean
  receipts?: boolean
  breakdownByShop?: boolean
  breakdownByCategory?: boolean
  breakdownByPaymentMethod?: boolean
  timeline?: boolean
}

export type ReportFilters = {
  transactionTypes?: ReportTransactionType[]
  paymentMethods?: ReportPaymentMethod[]
  productIds?: string[]
  variantIds?: string[]
  categoryIds?: string[]
  expenseCategories?: string[]
  minAmount?: number | null
  maxAmount?: number | null
  onlyLowStock?: boolean
  lowStockThreshold?: number
}

export type ReportLimits = {
  topProducts?: number
  recentMovements?: number
  timelinePoints?: number
}

export type ReportSort = {
  movements?: 'ASC' | 'DESC'
  topProductsBy?: 'REVENUE' | 'UNITS'
}

export type GenerateBusinessReportRequest = {
  from: string
  to: string
  shopIds?: string[]
  timezone?: string
  groupBy?: ReportGroupBy
  currency?: string
  include?: ReportInclude
  filters?: ReportFilters
  limits?: ReportLimits
  sort?: ReportSort
}

export type NormalizedReportRequest = {
  from: Date
  to: Date
  shopIds: string[]
  timezone: string
  groupBy: ReportGroupBy
  currency: string
  include: Required<ReportInclude>
  filters: Required<Pick<ReportFilters, 'lowStockThreshold' | 'onlyLowStock'>> & ReportFilters
  limits: Required<ReportLimits>
  sort: Required<ReportSort>
  raw: GenerateBusinessReportRequest
}

export const DEFAULT_INCLUDE: Required<ReportInclude> = {
  summary: true,
  cashMovement: true,
  sales: false,
  refunds: false,
  expenses: false,
  purchases: false,
  funding: false,
  inventorySnapshot: false,
  productMovements: false,
  topProducts: true,
  receipts: false,
  breakdownByShop: false,
  breakdownByCategory: false,
  breakdownByPaymentMethod: false,
  timeline: true
}

export const MAX_REPORT_RANGE_DAYS = 366
export const MAX_TOP_PRODUCTS = 50
export const MAX_RECENT_MOVEMENTS = 200
export const MAX_TIMELINE_POINTS = 366
