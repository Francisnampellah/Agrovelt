export interface CreateOrganizationRequest {
  name: string
  slug: string
  email: string
  phoneNumber?: string
}

export interface UpdateOrganizationRequest {
  name?: string
  slug?: string
  email?: string
  phoneNumber?: string
}

export interface OrganizationResponse {
  id: string
  name: string
  slug: string
  email: string
  phoneNumber: string | null
  createdAt: Date
}
