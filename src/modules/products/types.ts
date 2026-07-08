export interface CreateCategoryRequest {
  name: string
}

export interface CreateProductRequest {
  name: string
  description?: string
  categoryId?: string | null
  unit?: string
  dosageInfo?: string
  manufacturer?: string
  isRestricted?: boolean
  imageUrl?: string
  imagePath?: string
  imageMimeType?: string
}

export type UpdateProductRequest = Partial<CreateProductRequest>

export interface CreateProductVariantRequest {
  productId: string
  name: string
  sku: string
  defaultCostPrice?: number | null
  defaultSellingPrice?: number | null
  markupPercent?: number | null
}

export interface UpdateProductVariantRequest {
  name?: string
  sku?: string
  defaultCostPrice?: number | null
  defaultSellingPrice?: number | null
  markupPercent?: number | null
}

export interface ProductResponse {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  createdAt: Date
}

export interface ProductWithVariantsResponse extends ProductResponse {
  category?: {
    id: string
    name: string
  } | null
  variants: {
    id: string
    name: string
    sku: string
    defaultCostPrice: number | null
    defaultSellingPrice: number | null
    markupPercent: number | null
    createdAt: Date
  }[]
}
