export function getSwaggerConfig(port: number | string) {
  return {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Agrovelt POS API',
        version: '1.0.0',
        description: 'Multi-shop Point of Sale system API',
      },
      servers: [
        {
          url: `http://localhost:${port}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
    apis: ['./src/routes/*.ts', './src/modules/auth/*.ts'],
  }
}
