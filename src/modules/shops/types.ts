export interface CreateShopRequest {
  name: string
  location?: string
  ownerId: string
}

export interface UpdateShopRequest {
  name?: string
  location?: string
}

export interface ShopResponse {
  id: string
  name: string
  location: string | null
  ownerId: string
  createdAt: Date
}

export interface ShopWithStaffResponse extends ShopResponse {
  staff: {
    id: string
    userId: string
    role: string
    user: {
      name: string
      email: string
    }
  }[]
}
