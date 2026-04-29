export interface CreateCategoryRequest {
  name: string
}

export interface CreateProductRequest {
  name: string
  description?: string
  categoryId?: string
  organizationId: string
  unit?: string
  dosageInfo?: string
  manufacturer?: string
  isRestricted?: boolean
}

export interface CreateProductVariantRequest {
  productId: string
  name: string
  sku: string
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
    createdAt: Date
  }[]
}
