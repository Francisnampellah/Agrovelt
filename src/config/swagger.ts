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
        { name: 'Pricing', description: 'Pricing management and overrides' },
        { name: 'CashFlow', description: 'Cash flow entries and reports' },
        { name: 'Purchases', description: 'Purchase orders and receipts' },
        { name: 'Sales', description: 'Sales and payments' },
        { name: 'Expenses', description: 'Expense recording' },
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
              slug: { type: 'string' },
              email: { type: 'string' },
              phoneNumber: { type: 'string', nullable: true },
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
          ProductVariant: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              productId: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              sku: { type: 'string' },
              defaultCostPrice: { type: 'number', nullable: true },
              defaultSellingPrice: { type: 'number', nullable: true },
              markupPercent: { type: 'number', nullable: true },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Inventory: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              shopId: { type: 'string', format: 'uuid' },
              variantId: { type: 'string', format: 'uuid' },
              batchNumber: { type: 'string' },
              expiryDate: { type: 'string', format: 'date-time', nullable: true },
              quantity: { type: 'integer' },
              costPrice: { type: 'number' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          ShopVariantPrice: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              shopId: { type: 'string', format: 'uuid' },
              variantId: { type: 'string', format: 'uuid' },
              sellingPrice: { type: 'number' },
              minSellingPrice: { type: 'number', nullable: true },
              updatedAt: { type: 'string', format: 'date-time' },
              updatedBy: { type: 'string' }
            }
          },
          PriceHistory: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              shopId: { type: 'string', format: 'uuid', nullable: true },
              variantId: { type: 'string', format: 'uuid' },
              priceType: { type: 'string', enum: ['COST', 'SELLING', 'MIN_SELLING'] },
              oldPrice: { type: 'number' },
              newPrice: { type: 'number' },
              reason: { type: 'string', nullable: true },
              changedBy: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          CashFlowEntry: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              shopId: { type: 'string', format: 'uuid' },
              direction: { type: 'string', enum: ['IN', 'OUT'] },
              category: { type: 'string', enum: ['SALE', 'PURCHASE', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'REFUND'] },
              amount: { type: 'number' },
              referenceId: { type: 'string', nullable: true },
              note: { type: 'string', nullable: true },
              recordedBy: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Purchase: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              shopId: { type: 'string', format: 'uuid' },
              supplierId: { type: 'string', format: 'uuid', nullable: true },
              totalAmount: { type: 'number' },
              createdBy: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Sale: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              shopId: { type: 'string', format: 'uuid' },
              subtotal: { type: 'number' },
              discount: { type: 'number' },
              tax: { type: 'number' },
              total: { type: 'number' },
              status: { type: 'string', enum: ['COMPLETED', 'REFUNDED'] },
              createdBy: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Expense: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              shopId: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              amount: { type: 'number' },
              category: { type: 'string', nullable: true },
              date: { type: 'string', format: 'date-time' }
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
