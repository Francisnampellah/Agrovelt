export interface CreateCategoryRequest {
  name: string
}

export interface UpdateCategoryRequest {
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
  // Only honored for SUPER_ADMIN/ADMIN callers — see
  // products.controller.ts#stripProvenanceFieldsUnlessAdmin. Used by the
  // Mnyama Shop catalog sync path to mark provenance at creation time.
  source?: 'MNYAMA_SHOP' | 'CUSTOM'
  mnyamaShopDocId?: string | null
}

export type UpdateProductRequest = Partial<CreateProductRequest>

export interface CreateProductVariantRequest {
  productId: string
  name: string
  // Optional: when omitted, the server generates a unique SKU from the
  // product and variant names.
  sku?: string
  // Only honored for SUPER_ADMIN/ADMIN callers, same as Product.source above.
  source?: 'MNYAMA_SHOP' | 'CUSTOM'
  defaultCostPrice?: number | null
  defaultSellingPrice?: number | null
  markupPercent?: number | null
}

export interface UpdateProductVariantRequest {
  name?: string
  sku?: string
  source?: 'MNYAMA_SHOP' | 'CUSTOM'
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
