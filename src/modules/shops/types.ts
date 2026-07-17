export interface CreateShopRequest {
  name: string
  location?: string
  ownerId: string
  parentId?: string
  organizationId: string
  region: string
  country: string
  district: string
  streetAddress: string
  phoneNumber: string
}

export interface UpdateShopRequest {
  name?: string
  location?: string
  parentId?: string
  region?: string
  country?: string
  district?: string
  streetAddress?: string
  phoneNumber?: string
}

export interface ShopResponse {
  id: string
  name: string
  location: string | null
  ownerId: string
  parentId: string | null
  createdAt: Date
  region: string | null
  country: string | null
  district: string | null
  streetAddress: string | null
  phoneNumber: string | null
}

export interface ShopWithRelationsResponse extends ShopResponse {
  owner: {
    id: string
    name: string
    email: string
  }
  parent?: ShopResponse | null
  branches?: ShopResponse[]
  staff?: {
    id: string
    userId: string
    role: string
    user: {
      name: string
      email: string
    }
  }[]
}
