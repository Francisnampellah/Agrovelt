# Bulk Import Excel Templates

This guide explains how to use the bulk import feature to efficiently add/update products and inventory data from Excel files.

## Products Bulk Import

### Endpoint
```
POST /api/products/bulk/import?dryRun=false
```

### File Format
- **File Type**: `.xlsx` (Excel)
- **Max Size**: 10 MB
- **Encoding**: UTF-8

### Required Columns
| Column | Type | Required | Description |
|--------|------|----------|-------------|
| name | string | Yes | Product name (max 255 chars) |
| organizationId | string | Yes | Your organization UUID |
| description | string | No | Product description |
| categoryName | string | No | Category name (will link to existing category) |
| unit | string | No | Measurement unit (e.g., kg, liters) |
| dosageInfo | string | No | Dosage information for drugs/pesticides |
| manufacturer | string | No | Product manufacturer |
| isRestricted | boolean | No | Flag for regulated products (true/false) |

### Example Row
| name | organizationId | description | categoryName | unit | manufacturer |
|------|---|---|---|---|---|
| Organic Fertilizer NPK | 550e8400-e29b-41d4-a716-446655440000 | High quality NPK fertilizer | Fertilizers | kg | ABC Chemicals |

### Usage
1. Prepare Excel file with data
2. Use query parameter `?dryRun=true` to validate without importing
3. Review errors if any
4. Submit with `?dryRun=false` to import

### Response Example
```json
{
  "success": true,
  "totalRows": 100,
  "successCount": 98,
  "failureCount": 2,
  "data": null,
  "errors": [
    {
      "row": 5,
      "field": "name",
      "value": null,
      "error": "name is required"
    }
  ]
}
```

---

## Inventory Bulk Update

### Endpoint
```
POST /api/inventory/bulk/update?dryRun=false
```

### Required Columns
| Column | Type | Required | Description |
|--------|------|----------|-------------|
| shopId | string | Yes | Shop UUID |
| variantId | string | Yes | Product variant UUID |
| quantity | number | Yes | Stock quantity (>= 0) |
| costPrice | number | Yes | Cost per unit (>= 0) |
| batchNumber | string | No | Batch identifier (default: 'DEFAULT') |
| expiryDate | date | No | Expiration date (YYYY-MM-DD format) |

### Example Row
| shopId | variantId | quantity | costPrice | batchNumber | expiryDate |
|---|---|---|---|---|---|
| 660e8400-e29b-41d4-a716-446655440000 | 770e8400-e29b-41d4-a716-446655440000 | 150 | 25.50 | B-2026-001 | 2027-12-31 |

---

## Inventory Bulk Adjust

### Endpoint
```
POST /api/inventory/bulk/adjust?dryRun=false
```

### Required Columns
| Column | Type | Required | Description |
|--------|------|----------|-------------|
| shopId | string | Yes | Shop UUID |
| variantId | string | Yes | Product variant UUID |
| change | number | Yes | Quantity change (positive/negative) |
| type | string | Yes | Transaction type: PURCHASE, SALE, ADJUSTMENT, RETURN |
| batchNumber | string | No | Batch identifier (default: 'DEFAULT') |
| referenceId | string | No | Reference ID (e.g., purchase order ID) |
| costPrice | number | No | Required if change > 0 and no batch exists |

### Example Row
| shopId | variantId | change | type | batchNumber | referenceId |
|---|---|---|---|---|---|
| 660e8400-e29b-41d4-a716-446655440000 | 770e8400-e29b-41d4-a716-446655440000 | -50 | SALE | B-2026-001 | INV-20260508-001 |

---

## Dry-Run Mode

Always use `?dryRun=true` first to validate your data:

```bash
curl -X POST \
  "http://localhost:3000/api/products/bulk/import?dryRun=true" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@products.xlsx"
```

Dry-run responses include:
- Total rows count
- Success/failure count
- Error details (row number, field, reason)
- In dry-run: full valid data is returned

---

## Best Practices

1. **Validate UUIDs**: Ensure organizationId, shopId, variantId exist before import
2. **Check Dates**: Use YYYY-MM-DD format for expiryDate
3. **Test First**: Always use dry-run mode before actual import
4. **Batch Size**: Keep files under 1000 rows for optimal performance
5. **Error Handling**: Review all errors and fix before re-uploading
6. **Transaction Safety**: All rows are processed in a single transaction (all-or-nothing)

---

## Error Codes

| HTTP Code | Meaning |
|-----------|---------|
| 200 | Import successful or dry-run completed |
| 400 | Validation error or file format issue |
| 401 | Authentication required |
| 413 | File size exceeds 10MB limit |
