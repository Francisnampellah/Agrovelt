export function getSwaggerConfig(port: number | string) {
  return {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Agrovelt POS API',
        version: '1.0.0',
        description: 'Multi-shop Point of Sale system for agricultural retail management. Supports multi-tenancy, inventory management, sales, and comprehensive reporting.',
        contact: {
          name: 'Agrovelt Support',
          email: 'support@agrovelt.com'
        }
      },
      servers: [
        {
          url: `http://localhost:${port}`,
          description: 'Development server',
        },
        {
          url: 'https://api.agrovelt.com',
          description: 'Production server',
        }
      ],
      tags: [
        { name: 'Health', description: 'System health check' },
        { name: 'Auth', description: 'Authentication & authorization' },
        { name: 'Users', description: 'User management' },
        { name: 'Organizations', description: 'Organization management (SUPER_ADMIN only)' },
        { name: 'Shops', description: 'Shop management' },
        { name: 'Products', description: 'Product catalog and management' },
        { name: 'Inventory', description: 'Inventory tracking and management' },
        { name: 'Firebase', description: 'Firebase integration' },
        { name: 'Admin', description: 'Administrative operations' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT Bearer token obtained from login or token exchange'
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              error: {
                type: 'string',
                description: 'Error message'
              }
            }
          },
          User: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'STAFF'] },
              organizationId: { type: 'string', format: 'uuid', nullable: true, description: 'Null for SUPER_ADMIN users' },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Organization: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Shop: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              type: { type: 'string', enum: ['MAIN', 'BRANCH'] },
              location: { type: 'string', nullable: true },
              organizationId: { type: 'string', format: 'uuid' },
              ownerId: { type: 'string', format: 'uuid' },
              parentId: { type: 'string', format: 'uuid', nullable: true, description: 'Parent shop for branches' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Product: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              organizationId: { type: 'string', format: 'uuid' },
              categoryId: { type: 'string', format: 'uuid', nullable: true },
              unit: { type: 'string', nullable: true, description: 'e.g., kg, liter, piece' },
              dosageInfo: { type: 'string', nullable: true, description: 'Dosage information for drugs/pesticides' },
              manufacturer: { type: 'string', nullable: true },
              isRestricted: { type: 'boolean', description: 'Restricted products (e.g., regulated chemicals)' },
              imageUrl: { type: 'string', nullable: true, description: 'Public URL to product image' },
              imageMimeType: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          AuthResponse: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              user: { $ref: '#/components/schemas/User' },
              token: { type: 'string', description: 'Access token (15 minutes)' },
              refreshToken: { type: 'string', description: 'Refresh token (7 days)' }
            }
          }
        }
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
    apis: [
      './src/routes/*.ts',
      './src/modules/**/*.swagger.ts'
    ],
  }
}
