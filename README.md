# Agrovelt - Multi-Shop POS System

A production-grade Point of Sale (POS) system designed for multi-shop operations, built with Node.js, TypeScript, Prisma, and PostgreSQL.

## Features

- **Multi-Shop Support**: Manage multiple shops with isolated data
- **Authentication & Authorization**: JWT-based auth with role-based access (Admin, Owner, Staff)
- **Activity Logging**: Comprehensive audit trail for all user actions
- **Inventory Management**: Dual-model inventory with transaction audit trail
- **Sales & Purchases**: Complete transaction handling with price snapshotting
- **User Management**: Role-based access with admin controls
- **API Documentation**: Interactive Swagger/OpenAPI documentation
- **Docker Ready**: Containerized deployment with PostgreSQL

## Tech Stack

- **Backend**: Node.js + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **API**: Express.js with Swagger documentation
- **Deployment**: Docker + Docker Compose

## Project Structure

```
src/
├── modules/
│   ├── auth/          # Authentication & authorization
│   ├── users/         # User management
│   ├── shops/         # Shop operations
│   ├── products/      # Product catalog
│   ├── inventory/     # Stock management
│   ├── sales/         # Sales transactions
│   ├── purchases/     # Purchase orders
│   └── reports/       # Reporting endpoints
├── middleware/        # Custom middleware
├── utils/             # Utility functions
└── index.ts           # Application entry point

prisma/
└── schema.prisma      # Database schema
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)

### Setup with Docker

1. **Clone and navigate to the project**
   ```bash
   cd agrovelt
   ```

2. **Start services**
   ```bash
   docker-compose up -d --build
   ```

3. **Run database migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Access the application**
   - API: http://localhost:3000
   - Swagger Docs: http://localhost:3000/api-docs
   - Database: localhost:5432

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up database**
   ```bash
   # Update .env with your PostgreSQL connection
   npx prisma migrate dev --name init
   npx prisma generate
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

## API Documentation

The API is documented using Swagger/OpenAPI. Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api-docs

### Key Endpoints

**Authentication:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

**Administration (Admin only):**
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:userId/deactivate` - Deactivate user

**Business Operations:**
- `GET /api/users` - List users (Admin)
- `POST /api/users` - Create user (Admin)
- `GET /api/shops` - List shops
- `POST /api/shops` - Create shop
- `GET /api/products` - List products
- `POST /api/products` - Create product

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles

- **ADMIN**: Full system access, can manage users and all shops
- **OWNER**: Can manage their own shops and staff
- **STAFF**: Limited access to assigned shops

### Activity Logging

All user actions are automatically logged in the `AuditLog` table, including:
- User registration/login
- Profile updates
- Password changes
- User management actions
- Business operations

## Database Schema

The system uses a normalized PostgreSQL schema with the following key entities:

- **Users**: System users with roles (Admin, Owner, Staff)
- **Shops**: Business locations owned by users
- **Products**: Catalog items with variants
- **Inventory**: Current stock levels per shop
- **InventoryTransactions**: Audit trail for stock changes
- **Sales**: Transaction records with items and payments
- **Purchases**: Supplier purchase orders
- **AuditLog**: Activity logging for all user actions

### Design Principles

1. **Shop Isolation**: All transactional data includes `shopId` for multi-tenancy
2. **Price Snapshotting**: Sale items store prices at time of sale to prevent historical corruption
3. **Dual Inventory Model**: `Inventory` for fast reads, `InventoryTransaction` for audit trail
4. **Transaction Safety**: All business operations use database transactions

## Development

### Available Scripts

```bash
npm run dev          # Start development server with ts-node
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Create and apply migrations
npm run prisma:studio   # Open Prisma Studio for database management
```

### Environment Variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/agrovelt?schema=public"
PORT=3000
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="24h"
```

### Database Management

```bash
npx prisma migrate dev     # Create and apply migrations
npx prisma generate        # Generate Prisma client
npx prisma studio          # Visual database management
npx prisma db push         # Push schema changes (development)
```

## Deployment

### Docker Production

```bash
docker-compose -f docker-compose.yml up -d
```

### Environment Configuration

For production, ensure:
- Strong database passwords
- Proper environment variables
- SSL/TLS for database connections
- Regular backups

## Contributing

1. Follow the modular structure
2. Use TypeScript strictly
3. Include Swagger documentation for new endpoints
4. Add tests for business logic
5. Use database transactions for data integrity

## License

ISC