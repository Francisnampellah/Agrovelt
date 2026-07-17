import {
  DEFAULT_INCLUDE,
  GenerateBusinessReportRequest,
  MAX_RECENT_MOVEMENTS,
  MAX_REPORT_RANGE_DAYS,
  MAX_TIMELINE_POINTS,
  MAX_TOP_PRODUCTS,
  NormalizedReportRequest,
  REPORT_GROUP_BY,
  REPORT_PAYMENT_METHODS,
  REPORT_TRANSACTION_TYPES,
  ReportGroupBy,
  ReportInclude,
  ReportPaymentMethod,
  ReportTransactionType
} from './types'
import { ReportApiError } from './report.errors'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function normalizeReportRequest(body: GenerateBusinessReportRequest): NormalizedReportRequest {
  if (!body?.from || !body?.to) {
    throw new ReportApiError('from and to are required ISO-8601 dates', 400, 'REPORT_DATES_REQUIRED')
  }

  const from = new Date(body.from)
  const to = new Date(body.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ReportApiError('from and to must be valid ISO-8601 dates', 400, 'REPORT_DATES_INVALID')
  }
  if (from > to) {
    throw new ReportApiError('from must be before or equal to to', 400, 'REPORT_DATE_ORDER')
  }

  const rangeDays = (to.getTime() - from.getTime()) / MS_PER_DAY
  if (rangeDays > MAX_REPORT_RANGE_DAYS) {
    throw new ReportApiError(
      `Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days`,
      422,
      'REPORT_RANGE_TOO_LARGE',
      { maxDays: MAX_REPORT_RANGE_DAYS, rangeDays: Math.ceil(rangeDays) }
    )
  }

  const groupBy = (body.groupBy ?? 'DAY') as ReportGroupBy
  if (!REPORT_GROUP_BY.includes(groupBy)) {
    throw new ReportApiError('Unsupported groupBy value', 400, 'REPORT_GROUP_BY_INVALID', { groupBy })
  }

  if (body.filters?.paymentMethods) {
    for (const method of body.filters.paymentMethods) {
      if (!REPORT_PAYMENT_METHODS.includes(method as ReportPaymentMethod)) {
        throw new ReportApiError(
          'Unsupported payment method',
          400,
          'REPORT_PAYMENT_METHOD_INVALID',
          { method, allowed: REPORT_PAYMENT_METHODS }
        )
      }
    }
  }

  if (body.filters?.transactionTypes) {
    for (const type of body.filters.transactionTypes) {
      if (!REPORT_TRANSACTION_TYPES.includes(type as ReportTransactionType)) {
        throw new ReportApiError(
          'Unsupported transaction type',
          400,
          'REPORT_TRANSACTION_TYPE_INVALID',
          { type, allowed: REPORT_TRANSACTION_TYPES }
        )
      }
    }
  }

  const include: Required<ReportInclude> = { ...DEFAULT_INCLUDE, ...(body.include ?? {}) }

  const topProducts = body.limits?.topProducts ?? 10
  const recentMovements = body.limits?.recentMovements ?? 50
  const timelinePoints = body.limits?.timelinePoints ?? 31
  if (topProducts < 1 || topProducts > MAX_TOP_PRODUCTS) {
    throw new ReportApiError('limits.topProducts out of range', 400, 'REPORT_LIMIT_INVALID', {
      field: 'topProducts',
      max: MAX_TOP_PRODUCTS
    })
  }
  if (recentMovements < 1 || recentMovements > MAX_RECENT_MOVEMENTS) {
    throw new ReportApiError('limits.recentMovements out of range', 400, 'REPORT_LIMIT_INVALID', {
      field: 'recentMovements',
      max: MAX_RECENT_MOVEMENTS
    })
  }
  if (timelinePoints < 1 || timelinePoints > MAX_TIMELINE_POINTS) {
    throw new ReportApiError('limits.timelinePoints out of range', 400, 'REPORT_LIMIT_INVALID', {
      field: 'timelinePoints',
      max: MAX_TIMELINE_POINTS
    })
  }

  return {
    from,
    to,
    shopIds: body.shopIds ?? [],
    timezone: body.timezone ?? 'Africa/Dar_es_Salaam',
    groupBy,
    currency: body.currency ?? 'TZS',
    include,
    filters: {
      ...body.filters,
      onlyLowStock: body.filters?.onlyLowStock ?? false,
      lowStockThreshold: body.filters?.lowStockThreshold ?? 10
    },
    limits: { topProducts, recentMovements, timelinePoints },
    sort: {
      movements: body.sort?.movements ?? 'DESC',
      topProductsBy: body.sort?.topProductsBy ?? 'REVENUE'
    },
    raw: body
  }
}
