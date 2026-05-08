# Agrovelt POS API - Comprehensive UI Implementation Guide

## Executive Summary

Agrovelt is a multi-tenant, role-based Point of Sale (POS) system designed for agricultural retail management. This document provides comprehensive guidance for UI designers implementing interfaces against this API.

**Key Architecture**: Multi-tenancy with three-tier role hierarchy (SUPER_ADMIN → Organization Users) and subsidiary role-based access control (ADMIN, OWNER, STAFF).

---

## Part 1: System Architecture

### 1.1 Multi-Tenancy Model

```
┌─────────────────────────────────────────────────────────┐
│              AGROVELT SYSTEM                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ SUPER_ADMIN TIER (Global Access)                │  │
│  │ - Manages all organizations                      │  │
│  │ - No organization membership                     │  │
│  │ - Full system visibility                         │  │
│  └──────────────────────────────────────────────────┘  │
│                           │                             │
│           ┌───────────────┼───────────────┐            │
│           ▼               ▼               ▼            │
│  ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │  Organization A │ │ Organization B│ │Organization C│  │
│  │                 │ │               │ │             │  │
│  │ Users: ADMIN    │ │ Users: ADMIN  │ │ Users:ADMIN │  │
│  │ OWNER, STAFF    │ │ OWNER, STAFF  │ │ OWNER,STAFF │  │
│  │                 │ │               │ │             │  │
│  │ Shops: Main/    │ │ Shops: Main/  │ │ Shops:Main/ │  │
│  │ Branches        │ │ Branches      │ │ Branches    │  │
│  │                 │ │               │ │             │  │
│  │ Products,       │ │ Products,     │ │ Products,   │  │
│  │ Inventory       │ │ Inventory     │ │ Inventory   │  │
│  └─────────────────┘ │               │ │             │  │
│                      └─────────────────┘ └─────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Key Principle**: Each organization's data is completely isolated. Organization A users cannot see Organization B's data.

### 1.2 Role Hierarchy

```
SUPER_ADMIN (No organization)
    ├─ Can create/manage organizations
    ├─ Can view all system data
    ├─ Cannot perform business operations
    └─ Dashboard: Global analytics & org management

ADMIN (Organization-scoped)
    ├─ Can manage users in organization
    ├─ Can manage shops
    ├─ Can view organization inventory/sales
    ├─ Limited to organization data only
    └─ Dashboard: Organization overview

OWNER (Organization-scoped)
    ├─ Can manage shops they own
    ├─ Can view shop inventory/sales
    ├─ Can perform POS transactions
    └─ Dashboard: Their shops' performance

STAFF (Shop-scoped)
    ├─ Can only operate POS in assigned shops
    ├─ Limited transaction capabilities
    └─ Dashboard: Current shift/transactions
```

### 1.3 Data Isolation Patterns

All endpoints respect organizational boundaries:

```javascript
// Organization Users see only their org data
GET /api/products
// Returns: Products from user's organization only

// SUPER_ADMIN sees all data
GET /api/products
// Returns: ALL products from all organizations

// Staff see only shop-specific data
GET /api/shops
// Returns: Only shops assigned to staff member
```

---

## Part 2: Authentication & Authorization

### 2.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ AUTHENTICATION FLOW                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. User submits credentials (email + password)              │
│    ▼                                                         │
│ 2. API validates (POST /api/auth/login)                    │
│    ├─ Hash comparison                                       │
│    ├─ User active check                                     │
│    └─ Organization membership validation                    │
│    ▼                                                         │
│ 3. API returns tokens:                                      │
│    ├─ accessToken: 15-minute JWT                           │
│    ├─ refreshToken: 7-day long-lived token                 │
│    ├─ user object: {id, name, email, role, org}           │
│    └─ expiresIn: 900 (seconds)                             │
│    ▼                                                         │
│ 4. Client stores in secure storage                          │
│    └─ LocalStorage (for dev) or SessionStorage              │
│    └─ HttpOnly Cookie (recommended for prod)               │
│    ▼                                                         │
│ 5. All subsequent requests include:                         │
│    └─ Authorization: Bearer <accessToken>                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Token Refresh Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ TOKEN LIFECYCLE                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Access Token Valid: ✓ Use normally                          │
│                     └─ 15 minutes from issue                │
│                                                             │
│ Access Token Expiring (< 5 min): Refresh silently           │
│    POST /api/auth/refresh-token                            │
│    └─ Returns new accessToken + refreshToken               │
│    └─ Minimum disruption to UX                             │
│                                                             │
│ Access Token Expired (401 response):                        │
│    1. Check if refreshToken exists                         │
│    2. If yes, attempt silent refresh                       │
│    3. If refresh succeeds, retry original request          │
│    4. If refresh fails, redirect to login                  │
│                                                             │
│ Refresh Token Expired:                                      │
│    └─ User must re-authenticate (login)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**UI Implementation Pattern**:
```javascript
// Interceptor pattern for token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response.status === 401 && !isRetried) {
      const newTokens = await refreshToken();
      // Retry original request with new token
      return api.request(error.config);
    }
    // Redirect to login
    redirectToLogin();
  }
);
```

### 2.3 Role-Based Access Control (RBAC)

**Pattern**: Check `user.role` on both client and server.

```javascript
// Client-side (UI rendering)
if (user.role === 'SUPER_ADMIN') {
  render(<OrganizationManagement />);
} else if (user.role === 'ADMIN') {
  render(<UserAndShopManagement />);
} else if (user.role === 'OWNER') {
  render(<ShopDashboard />);
} else {
  render(<POSInterface />);
}

// Server-side (API enforcement)
router.post('/organizations', 
  authMiddleware.authorize('SUPER_ADMIN'),  // Enforced
  organizationController.create
);
```

---

## Part 3: Data Model Architecture

### 3.1 Organization Structure

```
Organization
├─ id: UUID
├─ name: String
├─ createdAt: DateTime
│
├─ Users[]
│   ├─ ADMIN (manage org)
│   ├─ OWNER (manage shops)
│   └─ STAFF (operate POS)
│
├─ Shops[]
│   ├─ MAIN Shops (primary locations)
│   │   └─ Branches[] (subsidiary locations)
│   │
│   ├─ Inventory (per shop)
│   │   ├─ ProductVariant[]
│   │   ├─ BatchNumber (FEFO support)
│   │   └─ Quantity
│   │
│   ├─ Sales (transactions)
│   │ SaleItems (line items)
│   │ Payments
│   │
│   ├─ Purchases (supplier orders)
│   │ PurchaseItems
│   │
│   └─ Staff[] (assigned users)
│
├─ Products[]
│   ├─ Variants[] (sizes/packages)
│   │   └─ SKU (unique barcode)
│   │
│   ├─ Category
│   ├─ Image (stored in volume)
│   ├─ Dosage Info (agrovet specific)
│   └─ Restricted Flag
│
└─ Suppliers[]
    ├─ Contact
    ├─ License
    └─ Region
```

### 3.2 Key Relationships

```javascript
// ORGANIZATION ISOLATION
User → Organization (organizationId not null for org users)
User → Organization (organizationId null for SUPER_ADMIN)

// SHOP HIERARCHY
Shop → Organization (must match)
Shop → User (owner)
Shop → Shop (parent, for branches)

// INVENTORY TRACKING
Inventory → Shop, ProductVariant, Organization
Inventory @@unique([shopId, variantId, batchNumber])
// Prevents duplicate stock entries

// PRODUCT CATALOG
Product → Organization (products per org)
ProductVariant → Product
// SKU globally unique (for barcode scanners)

// TRANSACTION AUDIT
Sale → Shop → Organization
Purchase → Shop → Organization
// All transactions org-scoped and auditable
```

---

## Part 4: API Patterns & Conventions

### 4.1 Request/Response Pattern

**Standard Success Response**:
```json
{
  "data": { /* entity or array of entities */ },
  "message": "Operation successful",
  "timestamp": "2026-05-06T11:30:00Z"
}
```

**Standard Error Response**:
```json
{
  "error": "Descriptive error message",
  "statusCode": 400,
  "timestamp": "2026-05-06T11:30:00Z"
}
```

**Status Codes Used**:
- `200 OK` - Successful GET, PUT
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Data conflict (e.g., duplicate SKU)
- `500 Server Error` - Unexpected error

### 4.2 Filtering & Pagination Patterns

**Current Implementation**:
```javascript
// LIST endpoints return all data (no pagination currently)
GET /api/products
// Returns: Array of ALL products

GET /api/shops
// Returns: Array of ALL shops in org (SUPER_ADMIN sees all)

// FILTER by organization (done server-side automatically)
// No client-side query parameters needed
```

**Recommended UI Implementation**:
```javascript
// Client-side pagination/filtering for UX
const [items, setItems] = useState([]);
const [filteredItems, setFilteredItems] = useState([]);
const [page, setPage] = useState(1);
const pageSize = 20;

useEffect(() => {
  // Fetch all items
  fetchItems().then(data => {
    setItems(data);
    // Apply client-side filtering
    const filtered = data.filter(item => matchesFilter(item));
    setFilteredItems(filtered);
  });
}, []);

// Render paginated results
const displayItems = filteredItems.slice(
  (page - 1) * pageSize,
  page * pageSize
);
```

### 4.3 Field Validation Patterns

**Product Creation**:
```javascript
POST /api/products
{
  "name": "String, required, 1+ chars",
  "description": "String, optional",
  "organizationId": "UUID, required",
  "categoryId": "UUID, optional",
  "unit": "String (kg, liter, piece), optional",
  "dosageInfo": "String, optional",
  "manufacturer": "String, optional",
  "isRestricted": "Boolean, default false"
}
```

**Validation Strategy for UI**:
```javascript
// Client-side validation (user feedback)
const validateProductForm = (data) => {
  const errors = {};
  if (!data.name?.trim()) errors.name = "Name required";
  if (data.name?.length > 255) errors.name = "Name too long";
  if (!data.organizationId) errors.org = "Organization required";
  return errors;
};

// Server-side validation (security & data integrity)
// All fields re-validated by API
```

---

## Part 5: Image Upload & Storage

### 5.1 Product Image Upload Flow

```
┌─────────────────────────────────────────────────────────────┐
│ PRODUCT IMAGE UPLOAD FLOW                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. User selects image file                                 │
│    └─ Max 5MB                                              │
│    └─ Formats: JPEG, PNG, GIF, WebP                        │
│                                                             │
│ 2. Two approaches:                                          │
│                                                             │
│ APPROACH A: Upload with product creation                   │
│    POST /api/products (multipart/form-data)               │
│    ├─ name, description, organizationId (fields)          │
│    └─ image (file)                                         │
│                                                             │
│ APPROACH B: Upload after product created                   │
│    POST /api/products/{id}/image                           │
│    └─ image (file in multipart/form-data)                 │
│                                                             │
│ 3. Server processes:                                        │
│    ├─ Validate MIME type                                   │
│    ├─ Check file size                                      │
│    ├─ Generate unique filename (UUID)                      │
│    ├─ Save to /uploads/products/ volume                    │
│    ├─ Store path in database                               │
│    └─ Return imageUrl: /uploads/products/uuid-name.jpg    │
│                                                             │
│ 4. Client receives response:                                │
│    {                                                        │
│      "data": {                                              │
│        "id": "...",                                         │
│        "imageUrl": "/uploads/products/...",               │
│        "imageMimeType": "image/jpeg",                      │
│        ...                                                  │
│      }                                                      │
│    }                                                        │
│                                                             │
│ 5. Image accessible at:                                    │
│    http://localhost:4000/uploads/products/uuid-name.jpg   │
│    └─ No authentication required (public)                 │
│    └─ Persisted in Docker volume                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Image Upload UI Best Practices

```javascript
// Component structure
<ProductForm onSubmit={handleSubmit}>
  <TextInput name="name" label="Product Name" required />
  
  <ImageUploader 
    onFileSelect={setImage}
    acceptedFormats={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
    maxSize={5 * 1024 * 1024} // 5MB
    preview={true}
  />
  
  <button type="submit">Create Product</button>
</ProductForm>

// Multi-part form handling
const handleSubmit = async (formData) => {
  const multipartData = new FormData();
  multipartData.append('name', formData.name);
  multipartData.append('organizationId', formData.organizationId);
  if (image) {
    multipartData.append('image', image);
  }
  
  const response = await api.post('/api/products', multipartData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  // Response includes imageUrl
  displayProductWithImage(response.data.imageUrl);
};

// Update image later
const handleImageUpdate = async (productId, newImage) => {
  const formData = new FormData();
  formData.append('image', newImage);
  
  await api.post(`/api/products/${productId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
```

---

## Part 6: Shop Hierarchy & Multi-Location

### 6.1 Shop Type Model

```
Organization
├─ MAIN Shops (primary locations, parentId=null)
│   ├─ Name: "Downtown Store"
│   ├─ Location: "123 Main St"
│   ├─ Type: "MAIN"
│   ├─ Owner: User UUID
│   │
│   └─ Branches (secondary locations, parentId=MainShop.id)
│       ├─ Name: "Downtown - Warehouse"
│       ├─ Location: "456 Oak Ave"
│       ├─ Type: "BRANCH"
│       ├─ ParentId: MainShop.id
│       ├─ Separate inventory
│       └─ Independent staff assignments
│
└─ Another MAIN Shop
    └─ Different branches
```

**UI Representation**:
```
Shops
├─ Downtown Store (MAIN)
│  ├─ Inventory: 250 items
│  ├─ Branches:
│  │  ├─ Downtown - Warehouse
│  │  └─ Downtown - Kiosk
│  └─ Staff: 8 assigned
│
└─ Uptown Store (MAIN)
   ├─ Inventory: 180 items
   ├─ Branches: (none)
   └─ Staff: 5 assigned
```

### 6.2 Shop Creation Flow

```javascript
// Create MAIN shop
POST /api/shops
{
  "name": "Downtown Store",
  "location": "123 Main St",
  "ownerId": "owner-uuid",
  "organizationId": "org-uuid",
  "parentId": null  // null = MAIN shop
}

// Create BRANCH (after MAIN exists)
POST /api/shops
{
  "name": "Downtown - Warehouse",
  "location": "456 Oak Ave",
  "ownerId": "owner-uuid",
  "organizationId": "org-uuid",
  "parentId": "main-shop-uuid"  // Points to MAIN shop
}

// API auto-sets type based on parentId:
// parentId=null → type="MAIN"
// parentId=value → type="BRANCH"
```

---

## Part 7: Inventory & Stock Management

### 7.1 Stock Tracking Model

```
Inventory Record (per shop, per variant, per batch)
├─ shopId: UUID
├─ variantId: UUID (ProductVariant)
├─ batchNumber: String (FEFO - First Expiry First Out)
├─ expiryDate: DateTime (optional, for perishables)
├─ quantity: Integer
├─ costPrice: Float
├─ sellingPrice: Float
└─ updatedAt: DateTime

// Unique constraint:
@@unique([shopId, variantId, batchNumber])
// Prevents double-counting stock
```

**Benefits**:
- FEFO compliance for agricultural products (essential for perishables)
- Per-batch price tracking (costs/prices vary by batch)
- Expiry date management
- Stock accuracy

### 7.2 Inventory Transaction Audit

```
Every inventory change is logged:

InventoryTransaction
├─ shopId: UUID
├─ variantId: UUID
├─ type: PURCHASE | SALE | ADJUSTMENT | RETURN | TRANSFER
├─ quantity: Integer (positive or negative)
├─ referenceId: String (links to source transaction)
├─ createdAt: DateTime
└─ batchNumber: String (which batch affected)

// UI Example: Inventory History
Product: Potassium Fertilizer (1kg Bag)
Shop: Downtown Store

Transactions:
├─ 2026-05-06 10:00 | PURCHASE | +100 units | Batch A
├─ 2026-05-06 11:30 | SALE | -5 units | Batch A
├─ 2026-05-06 14:00 | TRANSFER | -20 units | Batch A (to branch)
└─ 2026-05-06 16:00 | ADJUSTMENT | -2 units | Batch A (shrinkage)
```

---

## Part 8: Sales & Transactions

### 8.1 POS Transaction Flow

```
┌─────────────────────────────────────────────────────────────┐
│ POINT OF SALE (POS) TRANSACTION                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Initialize Sale                                         │
│    └─ shopId: current shop                                 │
│    └─ staff: logged-in user                                │
│                                                             │
│ 2. Add Items                                               │
│    ├─ Scan/select ProductVariant                           │
│    ├─ Check inventory (real-time)                          │
│    ├─ Add quantity to cart                                 │
│    └─ Calculate subtotal (quantity × sellingPrice)        │
│                                                             │
│ 3. Review Line Items                                       │
│    ├─ Display all SaleItems                               │
│    ├─ Show pricing per item                                │
│    └─ Show running total                                   │
│                                                             │
│ 4. Process Payment                                         │
│    ├─ Payment method: CASH | CARD | MOBILE                │
│    ├─ Amount tendered                                      │
│    └─ Calculate change                                     │
│                                                             │
│ 5. Confirm Transaction                                     │
│    POST /api/sales                                         │
│    {                                                        │
│      "shopId": "...",                                       │
│      "items": [                                             │
│        {                                                    │
│          "variantId": "...",                               │
│          "quantity": 5,                                     │
│          "unitPrice": 45.00                                │
│        }                                                    │
│      ],                                                     │
│      "totalAmount": 225.00,                                │
│      "paymentMethod": "CASH"                               │
│    }                                                        │
│                                                             │
│ 6. Server processing:                                      │
│    ├─ Lock inventory (prevent concurrent sells)           │
│    ├─ Create Sale record                                   │
│    ├─ Create SaleItems                                     │
│    ├─ Update inventory quantities                          │
│    ├─ Create Payment record                                │
│    ├─ Create Transaction audit logs                        │
│    └─ Release locks                                        │
│                                                             │
│ 7. Response                                                │
│    {                                                        │
│      "saleId": "...",                                       │
│      "receiptNumber": "auto-generated",                    │
│      "timestamp": "...",                                   │
│      "totalAmount": 225.00,                                │
│      "status": "COMPLETED"                                 │
│    }                                                        │
│                                                             │
│ 8. Print Receipt                                           │
│    ├─ Sale ID, timestamp, items                           │
│    ├─ Unit prices and quantities                           │
│    ├─ Total amount, payment method                         │
│    └─ Receipt number for refunds                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Sales History Patterns

```javascript
// Get sales for shop (filter client-side for now)
GET /api/sales
// Returns: All sales for authenticated user's scope

// Sales data structure
{
  "id": "sale-uuid",
  "shopId": "shop-uuid",
  "status": "COMPLETED",
  "totalAmount": 225.00,
  "createdAt": "2026-05-06T10:30:00Z",
  "items": [
    {
      "variantId": "variant-uuid",
      "name": "Potassium Fertilizer - 1kg",
      "quantity": 5,
      "unitPrice": 45.00,
      "subtotal": 225.00
    }
  ],
  "payment": {
    "method": "CASH",
    "amount": 225.00
  }
}

// UI: Sales Dashboard
Daily Sales: $2,450
Transactions: 18
Top Products: Fertilizer (45 units), Pesticide (28 units)
Payment Methods: Cash (60%), Card (40%)
```

---

## Part 9: Best Practices for UI Implementation

### 9.1 State Management Architecture

```
┌──────────────────────────────────────────────────────────┐
│ RECOMMENDED STATE MANAGEMENT                             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Global State (Redux, Zustand, Context)                  │
│ ├─ user: { id, email, role, organization }            │
│ ├─ organization: { id, name }                          │
│ ├─ currentShop: { id, name, type }                     │
│ ├─ authToken: string                                    │
│ └─ permissions: computed from user role                │
│                                                          │
│ API Cache Layer                                          │
│ ├─ organizations: []                                    │
│ ├─ shops: []                                            │
│ ├─ products: []                                         │
│ ├─ inventory: []                                        │
│ └─ users: []                                            │
│                                                          │
│ Local Component State                                    │
│ ├─ Form data (name, email, etc.)                       │
│ ├─ UI toggles (modals, dropdowns)                      │
│ ├─ Loading/error states                                │
│ └─ Pagination/filtering                                │
│                                                          │
│ Session Storage                                         │
│ └─ Tokens (accessToken, refreshToken)                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 9.2 API Error Handling Pattern

```javascript
// Centralized error handler
const handleApiError = (error) => {
  if (!error.response) {
    // Network error
    showNotification('Network error. Please check connection.');
    return;
  }
  
  const { status, data } = error.response;
  
  switch (status) {
    case 400:
      // Validation error - show field-specific errors
      showFieldErrors(data.errors || { general: data.error });
      break;
    
    case 401:
      // Unauthorized - attempt refresh or redirect to login
      redirectToLogin();
      break;
    
    case 403:
      // Forbidden - show permission error
      showNotification('You do not have permission for this action.');
      break;
    
    case 404:
      // Not found
      showNotification(`Resource not found: ${data.error}`);
      break;
    
    case 409:
      // Conflict (e.g., duplicate SKU)
      showNotification(`Conflict: ${data.error}`);
      break;
    
    case 500:
      // Server error
      showNotification('Server error. Please try again later.');
      logErrorToService(error);
      break;
    
    default:
      showNotification('An unexpected error occurred.');
  }
};
```

### 9.3 Loading States & Skeleton UI

```javascript
// Standard loading pattern
const [isLoading, setIsLoading] = useState(false);
const [products, setProducts] = useState([]);

useEffect(() => {
  loadProducts();
}, []);

const loadProducts = async () => {
  setIsLoading(true);
  try {
    const { data } = await api.get('/api/products');
    setProducts(data);
  } catch (error) {
    handleApiError(error);
  } finally {
    setIsLoading(false);
  }
};

// Render logic
if (isLoading) {
  return <ProductListSkeleton count={5} />;
}

return <ProductList items={products} />;
```

### 9.4 Form Submission Pattern

```javascript
const handleFormSubmit = async (formData) => {
  // Client-side validation
  const validationErrors = validateProductForm(formData);
  if (Object.keys(validationErrors).length > 0) {
    setFieldErrors(validationErrors);
    return;
  }
  
  setIsSubmitting(true);
  setFieldErrors({});
  
  try {
    // Prepare payload
    const payload = {
      name: formData.name,
      description: formData.description,
      organizationId: currentOrg.id,
      categoryId: formData.category?.id,
      unit: formData.unit,
      manufacturer: formData.manufacturer,
      isRestricted: formData.isRestricted
    };
    
    // Create product
    const response = await api.post('/api/products', payload);
    
    // Upload image if provided
    if (formData.image) {
      const imgFormData = new FormData();
      imgFormData.append('image', formData.image);
      
      await api.post(
        `/api/products/${response.data.id}/image`,
        imgFormData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
    }
    
    // Success
    showNotification('Product created successfully');
    redirectToProductList();
    
  } catch (error) {
    handleApiError(error);
  } finally {
    setIsSubmitting(false);
  }
};
```

### 9.5 Responsive Layout Pattern

```javascript
// Dashboard layout example
<Layout>
  <Header>
    <Logo />
    <UserMenu user={user} />
  </Header>
  
  <Container>
    <Sidebar>
      {/* Role-based navigation */}
      {user.role === 'SUPER_ADMIN' && (
        <NavGroup title="System">
          <NavItem href="/organizations">Organizations</NavItem>
          <NavItem href="/system-users">Users</NavItem>
        </NavGroup>
      )}
      
      {user.role !== 'SUPER_ADMIN' && (
        <NavGroup title="Business">
          <NavItem href="/shops">Shops</NavItem>
          <NavItem href="/products">Products</NavItem>
          <NavItem href="/inventory">Inventory</NavItem>
          <NavItem href="/sales">Sales</NavItem>
        </NavGroup>
      )}
    </Sidebar>
    
    <MainContent>
      {/* Route content */}
      <Outlet />
    </MainContent>
  </Container>
</Layout>
```

### 9.6 Real-time Updates & Polling

```javascript
// For inventory/sales data that changes frequently
useEffect(() => {
  // Initial load
  fetchInventory();
  
  // Poll every 30 seconds
  const interval = setInterval(() => {
    fetchInventory();
  }, 30000);
  
  return () => clearInterval(interval);
}, [currentShop?.id]);

// Alternative: WebSocket for real-time (future enhancement)
// useEffect(() => {
//   const ws = new WebSocket('ws://api.server/inventory');
//   ws.onmessage = (event) => {
//     const update = JSON.parse(event.data);
//     updateInventoryInUI(update);
//   };
//   return () => ws.close();
// }, []);
```

---

## Part 10: Performance & Optimization

### 10.1 Data Caching Strategy

```javascript
// Cache products with invalidation
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let productCache = null;
let cacheFetchTime = null;

const getProducts = async () => {
  const now = Date.now();
  
  // Return cached if valid
  if (
    productCache &&
    cacheFetchTime &&
    (now - cacheFetchTime) < CACHE_DURATION
  ) {
    return productCache;
  }
  
  // Fetch fresh data
  const response = await api.get('/api/products');
  productCache = response.data;
  cacheFetchTime = now;
  
  return productCache;
};

// Invalidate cache on mutations
const createProduct = async (data) => {
  const response = await api.post('/api/products', data);
  productCache = null; // Clear cache
  cacheFetchTime = null;
  return response.data;
};
```

### 10.2 Image Optimization

```javascript
// Lazy load product images
<img
  src={product.imageUrl}
  alt={product.name}
  loading="lazy"
  width="300"
  height="300"
/>

// Show placeholder while loading
<img
  src={product.imageUrl}
  placeholder="blur"
  onError={(e) => {
    e.target.src = '/placeholder-product.png';
  }}
/>

// Progressive image loading (optional)
<img
  src={product.imageUrl}
  srcSet={`
    ${product.imageUrl}?w=300 300w,
    ${product.imageUrl}?w=600 600w
  `}
  sizes="(max-width: 600px) 300px, 600px"
/>
```

### 10.3 Pagination Client-Side

```javascript
// For large lists (even though server returns all)
const ITEMS_PER_PAGE = 20;

const [currentPage, setCurrentPage] = useState(1);
const [filteredItems, setFilteredItems] = useState([]);

const paginatedItems = filteredItems.slice(
  (currentPage - 1) * ITEMS_PER_PAGE,
  currentPage * ITEMS_PER_PAGE
);

const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

return (
  <>
    <ItemList items={paginatedItems} />
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  </>
);
```

---

## Part 11: Security Best Practices

### 11.1 Token Storage

```javascript
// ❌ AVOID: localStorage for sensitive tokens
localStorage.setItem('accessToken', token); // XSS vulnerable

// ✓ BETTER: HttpOnly cookies (set by server)
// Server: Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=Strict

// ✓ ACCEPTABLE: SessionStorage + CSRF protection
sessionStorage.setItem('accessToken', token); // Cleared on tab close
```

### 11.2 CSRF Protection

```javascript
// Include CSRF token in requests
const api = axios.create({
  baseURL: 'http://api.server'
});

api.interceptors.request.use((config) => {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  if (token) {
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});
```

### 11.3 Input Sanitization

```javascript
// Sanitize user inputs to prevent XSS
import DOMPurify from 'dompurify';

const displayProductName = (name) => {
  return DOMPurify.sanitize(name);
};

// In templates
<h2>{DOMPurify.sanitize(product.name)}</h2>
```

---

## Part 12: Navigation & User Flows

### 12.1 SUPER_ADMIN Flow

```
Login
├─ Dashboard (system overview)
│  ├─ Total organizations
│  ├─ Total users
│  └─ System health
│
├─ Organizations
│  ├─ List all organizations
│  ├─ Create new organization
│  ├─ Edit organization
│  └─ View organization details
│
├─ Global Users (SUPER_ADMIN accounts)
│  ├─ List all SUPER_ADMIN users
│  └─ Manage SUPER_ADMIN accounts
│
└─ Reports
   ├─ System-wide sales report
   ├─ Organization performance
   └─ User activity log
```

### 12.2 Organization ADMIN Flow

```
Login
├─ Dashboard (organization overview)
│  ├─ Total shops
│  ├─ Total inventory value
│  ├─ Recent sales
│  └─ Staff performance
│
├─ Users
│  ├─ List organization users
│  ├─ Create user (ADMIN/OWNER/STAFF)
│  ├─ Edit user details
│  └─ Deactivate users
│
├─ Shops
│  ├─ List shops (MAIN + BRANCHES)
│  ├─ Create new shop
│  ├─ Edit shop details
│  └─ Assign staff to shops
│
├─ Products
│  ├─ Browse product catalog
│  ├─ Create/edit products
│  ├─ Upload product images
│  ├─ Manage categories
│  └─ Manage variants
│
├─ Inventory
│  ├─ View inventory across shops
│  ├─ Adjust stock
│  ├─ Manage batches (FEFO)
│  ├─ Track expiry dates
│  └─ Inventory history
│
├─ Sales & Purchases
│  ├─ View sales report
│  ├─ Create purchase orders
│  ├─ View purchase history
│  └─ Manage suppliers
│
└─ Reports
   └─ Organization-specific reports
```

### 12.3 OWNER/STAFF Flow

```
Login
├─ POS / Dashboard
│  ├─ Today's sales
│  ├─ Inventory for my shops
│  └─ Today's transactions
│
├─ Point of Sale
│  ├─ Ring up sale
│  ├─ Search products
│  ├─ View inventory
│  ├─ Process payment
│  └─ Print receipt
│
├─ Inventory (if OWNER)
│  └─ Manage stock for shops
│
└─ Settings
   └─ Change password
```

---

## Part 13: API Endpoints Summary

### Quick Reference Table

| Resource | Method | Endpoint | Auth | Role |
|----------|--------|----------|------|------|
| **Auth** | POST | `/api/auth/register` | ✗ | - |
| | POST | `/api/auth/login` | ✗ | - |
| | POST | `/api/auth/exchange` | ✗ | - |
| | POST | `/api/auth/refresh-token` | ✗ | - |
| **Organizations** | GET | `/api/organizations` | ✓ | SUPER_ADMIN |
| | POST | `/api/organizations` | ✓ | SUPER_ADMIN |
| | GET | `/api/organizations/{id}` | ✓ | SUPER_ADMIN |
| | PUT | `/api/organizations/{id}` | ✓ | SUPER_ADMIN |
| **Users** | GET | `/api/users` | ✓ | ADMIN+ |
| | POST | `/api/users` | ✓ | ADMIN+ |
| **Shops** | GET | `/api/shops` | ✓ | AUTH |
| | POST | `/api/shops` | ✓ | AUTH |
| | GET | `/api/shops/{id}` | ✓ | AUTH |
| | PUT | `/api/shops/{id}` | ✓ | AUTH |
| | DELETE | `/api/shops/{id}` | ✓ | AUTH |
| **Products** | GET | `/api/products` | ✓ | AUTH |
| | POST | `/api/products` | ✓ | AUTH |
| | GET | `/api/products/{id}` | ✓ | AUTH |
| | POST | `/api/products/{id}/image` | ✓ | AUTH |
| | DELETE | `/api/products/{id}` | ✓ | AUTH |
| **Variants** | POST | `/api/variants` | ✓ | AUTH |
| **Categories** | GET | `/api/categories` | ✓ | AUTH |
| | POST | `/api/categories` | ✓ | AUTH |
| **Health** | GET | `/health` | ✗ | - |

---

## Part 14: Development Workflow Recommendations

### 14.1 Feature Development Checklist

```
□ 1. Understand the data model
  □ What entities are involved?
  □ How are they related?
  □ What organization scoping applies?

□ 2. Check API documentation (Swagger)
  http://localhost:4000/api-docs

□ 3. Understand authentication
  □ Is endpoint public or protected?
  □ What role is required?
  □ How to handle token refresh?

□ 4. Design UI wireframes/mockups

□ 5. Plan component architecture
  □ Container components (smart)
  □ Presentational components (dumb)
  □ Custom hooks for API calls

□ 6. Implement form validation
  □ Client-side for UX
  □ Display server errors

□ 7. Add error handling
  □ Network errors
  □ Validation errors
  □ Permission errors

□ 8. Add loading states
  □ Skeleton screens
  □ Spinners
  □ Disabled buttons

□ 9. Test with real API
  □ Create test data
  □ Test all user roles
  □ Test error scenarios

□ 10. Implement caching/optimization
  □ Don't over-fetch
  □ Lazy load images
  □ Paginate large lists
```

### 14.2 Testing Scenarios

```javascript
// Test Matrix for Each Feature

Test Role: SUPER_ADMIN
├─ Can access organization management
├─ Can see all organizations
├─ Cannot perform business operations
└─ Sees global system data

Test Role: ADMIN
├─ Can manage organization users
├─ Can create/edit shops
├─ Cannot access other organizations
└─ Cannot see other organizations' products

Test Role: OWNER
├─ Can only access shops they own
├─ Can view inventory
├─ Can process sales
└─ Cannot modify other owners' shops

Test Role: STAFF
├─ Can only operate POS
├─ Limited to assigned shops
├─ Cannot modify settings
└─ Cannot access reports

Test Data Isolation
├─ Org A user cannot see Org B products
├─ Org A user cannot create Org B shops
├─ Staff cannot see other shop inventory
└─ All API responses filter by org
```

---

## Part 15: Troubleshooting Guide

### Common Issues & Solutions

```
ISSUE: 401 Unauthorized on valid token
CAUSE: Token expired during request
FIX: Implement token refresh interceptor
   - Check token expiry time
   - Refresh before timeout
   - Retry request with new token

ISSUE: 403 Forbidden when accessing resource
CAUSE: User role insufficient or org mismatch
FIX: Check user.role in response
   - Verify authorization requirement
   - Check organization membership
   - Confirm resource organization match

ISSUE: Data not loading after page refresh
CAUSE: State lost, token might be expired
FIX: Restore token from storage on app init
   - Check sessionStorage/localStorage
   - Validate token not expired
   - Redirect to login if needed

ISSUE: Image not displaying
CAUSE: Image URL incorrect or file deleted
FIX: Check response data
   - Verify imageUrl in product response
   - Confirm /uploads path accessible
   - Check file exists in volume

ISSUE: Form submission failing silently
CAUSE: Network error or server error
FIX: Add comprehensive error handling
   - Log errors to console
   - Show error notification
   - Check server logs
```

---

## Conclusion

This API is designed with:
- **Security**: Role-based access, token management, data isolation
- **Scalability**: Multi-tenancy, organized data structure
- **Usability**: Clear patterns, comprehensive validation, error handling
- **Flexibility**: Support for multiple organization models and use cases

For UI designers implementing this system, remember:
1. **Always respect role-based access** - don't show SUPER_ADMIN features to regular users
2. **Handle organization context** - all data operations are org-scoped
3. **Implement token refresh** - provide seamless experience across 15-minute token lifetime
4. **Validate early, handle errors gracefully** - both client and server validation
5. **Optimize for performance** - cache when possible, paginate large datasets
6. **Design for different user flows** - SUPER_ADMIN has completely different interface than STAFF

Good luck with the implementation! 🚀
