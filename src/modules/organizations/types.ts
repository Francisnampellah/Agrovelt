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

export interface LinkedUserResponse {
  id: string
  name: string
  email: string
  role: string
  organizationId: string | null
}

export interface CreateOrganizationForUserResponse {
  organization: OrganizationResponse
  user: LinkedUserResponse
}
