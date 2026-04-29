export interface CreateOrganizationRequest {
  name: string
}

export interface UpdateOrganizationRequest {
  name?: string
}

export interface OrganizationResponse {
  id: string
  name: string
  createdAt: Date
}
