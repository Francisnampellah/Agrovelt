import { PrismaClient } from '@prisma/client'

type CatalogVariant = {
  name: string
  sku: string
  defaultCostPrice: number
  defaultSellingPrice: number
}

type CatalogProduct = {
  name: string
  category: string
  description: string
  unit: string
  manufacturer: string
  isRestricted?: boolean
  dosageInfo?: string
  variants: CatalogVariant[]
}

const CATALOG: CatalogProduct[] = [
  {
    name: 'NPK 17-17-17 Compound Fertilizer',
    category: 'Fertilizers',
    description: 'Balanced compound fertilizer for general crop nutrition.',
    unit: 'kg',
    manufacturer: 'Yara Tanzania',
    variants: [
      { name: '1kg', sku: 'AGV-FERT-NPK17-1KG', defaultCostPrice: 2800, defaultSellingPrice: 3500 },
      { name: '5kg', sku: 'AGV-FERT-NPK17-5KG', defaultCostPrice: 12000, defaultSellingPrice: 15000 },
      { name: '25kg', sku: 'AGV-FERT-NPK17-25KG', defaultCostPrice: 52000, defaultSellingPrice: 65000 },
      { name: '50kg', sku: 'AGV-FERT-NPK17-50KG', defaultCostPrice: 96000, defaultSellingPrice: 120000 }
    ]
  },
  {
    name: 'Urea 46% Nitrogen Fertilizer',
    category: 'Fertilizers',
    description: 'High nitrogen fertilizer for vegetative growth.',
    unit: 'kg',
    manufacturer: 'Minjingu Mines',
    variants: [
      { name: '1kg', sku: 'AGV-FERT-UREA-1KG', defaultCostPrice: 1800, defaultSellingPrice: 2300 },
      { name: '10kg', sku: 'AGV-FERT-UREA-10KG', defaultCostPrice: 15000, defaultSellingPrice: 19000 },
      { name: '25kg', sku: 'AGV-FERT-UREA-25KG', defaultCostPrice: 34000, defaultSellingPrice: 42000 },
      { name: '50kg', sku: 'AGV-FERT-UREA-50KG', defaultCostPrice: 64000, defaultSellingPrice: 80000 }
    ]
  },
  {
    name: 'DAP 18-46-0 Fertilizer',
    category: 'Fertilizers',
    description: 'Diammonium phosphate for root establishment and flowering.',
    unit: 'kg',
    manufacturer: 'OCP Africa',
    variants: [
      { name: '1kg', sku: 'AGV-FERT-DAP-1KG', defaultCostPrice: 2600, defaultSellingPrice: 3200 },
      { name: '10kg', sku: 'AGV-FERT-DAP-10KG', defaultCostPrice: 22000, defaultSellingPrice: 27500 },
      { name: '25kg', sku: 'AGV-FERT-DAP-25KG', defaultCostPrice: 50000, defaultSellingPrice: 62000 },
      { name: '50kg', sku: 'AGV-FERT-DAP-50KG', defaultCostPrice: 94000, defaultSellingPrice: 117000 }
    ]
  },
  {
    name: 'CAN 26% Calcium Ammonium Nitrate',
    category: 'Fertilizers',
    description: 'Nitrogen fertilizer with calcium for acidic soils.',
    unit: 'kg',
    manufacturer: 'Tanzania Fertilizer Co.',
    variants: [
      { name: '5kg', sku: 'AGV-FERT-CAN-5KG', defaultCostPrice: 11000, defaultSellingPrice: 13800 },
      { name: '25kg', sku: 'AGV-FERT-CAN-25KG', defaultCostPrice: 48000, defaultSellingPrice: 60000 },
      { name: '50kg', sku: 'AGV-FERT-CAN-50KG', defaultCostPrice: 90000, defaultSellingPrice: 112000 },
      { name: '50kg Bulk', sku: 'AGV-FERT-CAN-50KG-BLK', defaultCostPrice: 88000, defaultSellingPrice: 109000 }
    ]
  },
  {
    name: 'Lambda-Cyhalothrin 2.5% EC',
    category: 'Pesticides & Herbicides',
    description: 'Broad-spectrum insecticide for field and vegetable crops.',
    unit: 'liter',
    manufacturer: 'Bayer East Africa',
    isRestricted: true,
    dosageInfo: 'Apply 20-30ml per 20L water. PHI 14 days.',
    variants: [
      { name: '100ml', sku: 'AGV-PEST-LAMB-100ML', defaultCostPrice: 4500, defaultSellingPrice: 6000 },
      { name: '250ml', sku: 'AGV-PEST-LAMB-250ML', defaultCostPrice: 9500, defaultSellingPrice: 12500 },
      { name: '500ml', sku: 'AGV-PEST-LAMB-500ML', defaultCostPrice: 17000, defaultSellingPrice: 22000 },
      { name: '1L', sku: 'AGV-PEST-LAMB-1L', defaultCostPrice: 30000, defaultSellingPrice: 39000 }
    ]
  },
  {
    name: 'Glyphosate 41% SL Herbicide',
    category: 'Pesticides & Herbicides',
    description: 'Non-selective systemic herbicide for weed control.',
    unit: 'liter',
    manufacturer: 'Syngenta',
    isRestricted: true,
    dosageInfo: 'Apply 2-3L per hectare in 200-300L water.',
    variants: [
      { name: '250ml', sku: 'AGV-HERB-GLY-250ML', defaultCostPrice: 5000, defaultSellingPrice: 6500 },
      { name: '500ml', sku: 'AGV-HERB-GLY-500ML', defaultCostPrice: 9000, defaultSellingPrice: 11500 },
      { name: '1L', sku: 'AGV-HERB-GLY-1L', defaultCostPrice: 16000, defaultSellingPrice: 20500 },
      { name: '5L', sku: 'AGV-HERB-GLY-5L', defaultCostPrice: 70000, defaultSellingPrice: 90000 }
    ]
  },
  {
    name: 'Mancozeb 80% WP Fungicide',
    category: 'Pesticides & Herbicides',
    description: 'Protectant fungicide for blight and leaf spot diseases.',
    unit: 'kg',
    manufacturer: 'UPL Limited',
    dosageInfo: 'Mix 25g per 20L water. Spray at 7-10 day intervals.',
    variants: [
      { name: '250g', sku: 'AGV-FUNG-MANCO-250G', defaultCostPrice: 6000, defaultSellingPrice: 7800 },
      { name: '500g', sku: 'AGV-FUNG-MANCO-500G', defaultCostPrice: 11000, defaultSellingPrice: 14000 },
      { name: '1kg', sku: 'AGV-FUNG-MANCO-1KG', defaultCostPrice: 20000, defaultSellingPrice: 25500 },
      { name: '5kg', sku: 'AGV-FUNG-MANCO-5KG', defaultCostPrice: 90000, defaultSellingPrice: 115000 }
    ]
  },
  {
    name: 'Cypermethrin 10% EC',
    category: 'Pesticides & Herbicides',
    description: 'Synthetic pyrethroid insecticide for cotton and vegetables.',
    unit: 'liter',
    manufacturer: 'Twiga Chemicals',
    isRestricted: true,
    variants: [
      { name: '100ml', sku: 'AGV-PEST-CYP-100ML', defaultCostPrice: 3500, defaultSellingPrice: 4800 },
      { name: '250ml', sku: 'AGV-PEST-CYP-250ML', defaultCostPrice: 7500, defaultSellingPrice: 9800 },
      { name: '500ml', sku: 'AGV-PEST-CYP-500ML', defaultCostPrice: 13500, defaultSellingPrice: 17500 },
      { name: '1L', sku: 'AGV-PEST-CYP-1L', defaultCostPrice: 24000, defaultSellingPrice: 31000 }
    ]
  },
  {
    name: 'Hybrid Maize Seed SC 627',
    category: 'Seeds',
    description: 'High-yield drought-tolerant hybrid maize seed.',
    unit: 'kg',
    manufacturer: 'Seed Co Tanzania',
    variants: [
      { name: '2kg', sku: 'AGV-SEED-MAIZE-2KG', defaultCostPrice: 14000, defaultSellingPrice: 18000 },
      { name: '5kg', sku: 'AGV-SEED-MAIZE-5KG', defaultCostPrice: 32000, defaultSellingPrice: 40000 },
      { name: '10kg', sku: 'AGV-SEED-MAIZE-10KG', defaultCostPrice: 60000, defaultSellingPrice: 75000 },
      { name: '25kg', sku: 'AGV-SEED-MAIZE-25KG', defaultCostPrice: 140000, defaultSellingPrice: 175000 }
    ]
  },
  {
    name: 'Tomato Seed Assila F1',
    category: 'Seeds',
    description: 'Determinate tomato variety with firm fruits and long shelf life.',
    unit: 'gram',
    manufacturer: 'Syngenta Vegetables',
    variants: [
      { name: '5g', sku: 'AGV-SEED-TOM-5G', defaultCostPrice: 12000, defaultSellingPrice: 15500 },
      { name: '10g', sku: 'AGV-SEED-TOM-10G', defaultCostPrice: 22000, defaultSellingPrice: 28000 },
      { name: '25g', sku: 'AGV-SEED-TOM-25G', defaultCostPrice: 48000, defaultSellingPrice: 60000 },
      { name: '50g', sku: 'AGV-SEED-TOM-50G', defaultCostPrice: 90000, defaultSellingPrice: 112000 }
    ]
  },
  {
    name: 'Onion Seed Red Creole',
    category: 'Seeds',
    description: 'Red bulb onion variety suited to mid-altitude areas.',
    unit: 'gram',
    manufacturer: 'East African Seeds',
    variants: [
      { name: '10g', sku: 'AGV-SEED-ONION-10G', defaultCostPrice: 8000, defaultSellingPrice: 10500 },
      { name: '25g', sku: 'AGV-SEED-ONION-25G', defaultCostPrice: 18000, defaultSellingPrice: 23000 },
      { name: '100g', sku: 'AGV-SEED-ONION-100G', defaultCostPrice: 60000, defaultSellingPrice: 75000 },
      { name: '500g', sku: 'AGV-SEED-ONION-500G', defaultCostPrice: 250000, defaultSellingPrice: 310000 }
    ]
  },
  {
    name: 'Beans Seed Rosecoco',
    category: 'Seeds',
    description: 'Popular climbing bean variety for household and market production.',
    unit: 'kg',
    manufacturer: 'Agricultural Seed Agency',
    variants: [
      { name: '1kg', sku: 'AGV-SEED-BEAN-1KG', defaultCostPrice: 4500, defaultSellingPrice: 5800 },
      { name: '5kg', sku: 'AGV-SEED-BEAN-5KG', defaultCostPrice: 20000, defaultSellingPrice: 25000 },
      { name: '10kg', sku: 'AGV-SEED-BEAN-10KG', defaultCostPrice: 38000, defaultSellingPrice: 47000 },
      { name: '25kg', sku: 'AGV-SEED-BEAN-25KG', defaultCostPrice: 90000, defaultSellingPrice: 112000 }
    ]
  },
  {
    name: 'Dairy Meal Cattle Feed',
    category: 'Animal Feed',
    description: 'Complete dairy ration for lactating cows.',
    unit: 'kg',
    manufacturer: 'Tanga Fresh Feeds',
    variants: [
      { name: '10kg', sku: 'AGV-FEED-DAIRY-10KG', defaultCostPrice: 22000, defaultSellingPrice: 27000 },
      { name: '25kg', sku: 'AGV-FEED-DAIRY-25KG', defaultCostPrice: 50000, defaultSellingPrice: 62000 },
      { name: '50kg', sku: 'AGV-FEED-DAIRY-50KG', defaultCostPrice: 95000, defaultSellingPrice: 118000 },
      { name: '70kg', sku: 'AGV-FEED-DAIRY-70KG', defaultCostPrice: 128000, defaultSellingPrice: 160000 }
    ]
  },
  {
    name: 'Broiler Starter Crumbles',
    category: 'Animal Feed',
    description: 'High-energy starter feed for broiler chicks 0-3 weeks.',
    unit: 'kg',
    manufacturer: 'Silverlands Feeds',
    variants: [
      { name: '10kg', sku: 'AGV-FEED-BROIL-ST-10KG', defaultCostPrice: 24000, defaultSellingPrice: 30000 },
      { name: '25kg', sku: 'AGV-FEED-BROIL-ST-25KG', defaultCostPrice: 55000, defaultSellingPrice: 68000 },
      { name: '50kg', sku: 'AGV-FEED-BROIL-ST-50KG', defaultCostPrice: 104000, defaultSellingPrice: 130000 },
      { name: '70kg', sku: 'AGV-FEED-BROIL-ST-70KG', defaultCostPrice: 140000, defaultSellingPrice: 175000 }
    ]
  },
  {
    name: 'Layer Mash Poultry Feed',
    category: 'Animal Feed',
    description: 'Balanced layer feed for egg production.',
    unit: 'kg',
    manufacturer: 'AKM Glitters',
    variants: [
      { name: '10kg', sku: 'AGV-FEED-LAYER-10KG', defaultCostPrice: 21000, defaultSellingPrice: 26000 },
      { name: '25kg', sku: 'AGV-FEED-LAYER-25KG', defaultCostPrice: 48000, defaultSellingPrice: 60000 },
      { name: '50kg', sku: 'AGV-FEED-LAYER-50KG', defaultCostPrice: 92000, defaultSellingPrice: 115000 },
      { name: '70kg', sku: 'AGV-FEED-LAYER-70KG', defaultCostPrice: 125000, defaultSellingPrice: 156000 }
    ]
  },
  {
    name: 'Mineral Salt Lick Block',
    category: 'Animal Feed',
    description: 'Mineral supplement block for cattle and goats.',
    unit: 'piece',
    manufacturer: 'Kensalt Ltd',
    variants: [
      { name: '2kg', sku: 'AGV-FEED-SALT-2KG', defaultCostPrice: 3500, defaultSellingPrice: 4500 },
      { name: '5kg', sku: 'AGV-FEED-SALT-5KG', defaultCostPrice: 8000, defaultSellingPrice: 10000 },
      { name: '10kg', sku: 'AGV-FEED-SALT-10KG', defaultCostPrice: 15000, defaultSellingPrice: 19000 },
      { name: '20kg', sku: 'AGV-FEED-SALT-20KG', defaultCostPrice: 28000, defaultSellingPrice: 35000 }
    ]
  },
  {
    name: 'Albendazole 10% Oral Suspension',
    category: 'Veterinary Medicine',
    description: 'Broad-spectrum anthelmintic for cattle, sheep, and goats.',
    unit: 'liter',
    manufacturer: 'Cooper Kenya',
    isRestricted: true,
    dosageInfo: 'Cattle: 7.5mg/kg body weight. Withdrawal: milk 60h, meat 8 days.',
    variants: [
      { name: '100ml', sku: 'AGV-VET-ALB-100ML', defaultCostPrice: 5000, defaultSellingPrice: 6500 },
      { name: '250ml', sku: 'AGV-VET-ALB-250ML', defaultCostPrice: 11000, defaultSellingPrice: 14000 },
      { name: '500ml', sku: 'AGV-VET-ALB-500ML', defaultCostPrice: 20000, defaultSellingPrice: 25500 },
      { name: '1L', sku: 'AGV-VET-ALB-1L', defaultCostPrice: 36000, defaultSellingPrice: 46000 }
    ]
  },
  {
    name: 'Oxytetracycline 20% LA Injection',
    category: 'Veterinary Medicine',
    description: 'Long-acting antibiotic for bacterial infections in livestock.',
    unit: 'ml',
    manufacturer: 'Norbrook Laboratories',
    isRestricted: true,
    dosageInfo: 'Administer by deep IM injection. Prescription required.',
    variants: [
      { name: '50ml', sku: 'AGV-VET-OXY-50ML', defaultCostPrice: 18000, defaultSellingPrice: 23000 },
      { name: '100ml', sku: 'AGV-VET-OXY-100ML', defaultCostPrice: 32000, defaultSellingPrice: 41000 },
      { name: '250ml', sku: 'AGV-VET-OXY-250ML', defaultCostPrice: 70000, defaultSellingPrice: 89000 },
      { name: '500ml', sku: 'AGV-VET-OXY-500ML', defaultCostPrice: 130000, defaultSellingPrice: 165000 }
    ]
  },
  {
    name: 'Multivitamin Injectable',
    category: 'Veterinary Medicine',
    description: 'Vitamin supplement for stressed or recovering animals.',
    unit: 'ml',
    manufacturer: 'Vetlab Tanzania',
    variants: [
      { name: '100ml', sku: 'AGV-VET-MVIT-100ML', defaultCostPrice: 12000, defaultSellingPrice: 15500 },
      { name: '250ml', sku: 'AGV-VET-MVIT-250ML', defaultCostPrice: 26000, defaultSellingPrice: 33000 },
      { name: '500ml', sku: 'AGV-VET-MVIT-500ML', defaultCostPrice: 48000, defaultSellingPrice: 61000 },
      { name: '1L', sku: 'AGV-VET-MVIT-1L', defaultCostPrice: 90000, defaultSellingPrice: 114000 }
    ]
  },
  {
    name: 'Hand Sprayer Knapsack 16L',
    category: 'Farm Tools',
    description: 'Manual knapsack sprayer for crop protection applications.',
    unit: 'piece',
    manufacturer: 'Hudson Manufacturing',
    variants: [
      { name: 'Standard', sku: 'AGV-TOOL-SPRAY-16L-STD', defaultCostPrice: 45000, defaultSellingPrice: 58000 },
      { name: 'With Pressure Gauge', sku: 'AGV-TOOL-SPRAY-16L-PG', defaultCostPrice: 52000, defaultSellingPrice: 67000 },
      { name: 'Spare Nozzle Kit', sku: 'AGV-TOOL-SPRAY-NOZZLE', defaultCostPrice: 5000, defaultSellingPrice: 7000 },
      { name: 'Spare Strap Set', sku: 'AGV-TOOL-SPRAY-STRAP', defaultCostPrice: 8000, defaultSellingPrice: 10500 }
    ]
  },
  {
    name: 'Garden Hoe (Jembe)',
    category: 'Farm Tools',
    description: 'Heavy-duty hoe for land preparation and weeding.',
    unit: 'piece',
    manufacturer: 'Nyati Tools',
    variants: [
      { name: 'Small Handle', sku: 'AGV-TOOL-HOE-SM', defaultCostPrice: 12000, defaultSellingPrice: 15500 },
      { name: 'Medium Handle', sku: 'AGV-TOOL-HOE-MD', defaultCostPrice: 15000, defaultSellingPrice: 19000 },
      { name: 'Long Handle', sku: 'AGV-TOOL-HOE-LG', defaultCostPrice: 18000, defaultSellingPrice: 23000 },
      { name: 'Head Only', sku: 'AGV-TOOL-HOE-HEAD', defaultCostPrice: 8000, defaultSellingPrice: 10500 }
    ]
  },
  {
    name: 'Watering Can 10L',
    category: 'Farm Tools',
    description: 'Plastic watering can for nursery and garden use.',
    unit: 'piece',
    manufacturer: 'Plasco Tanzania',
    variants: [
      { name: 'Green', sku: 'AGV-TOOL-CAN10-GRN', defaultCostPrice: 9000, defaultSellingPrice: 11500 },
      { name: 'Blue', sku: 'AGV-TOOL-CAN10-BLU', defaultCostPrice: 9000, defaultSellingPrice: 11500 },
      { name: '5L', sku: 'AGV-TOOL-CAN5-STD', defaultCostPrice: 6000, defaultSellingPrice: 7800 },
      { name: '14L', sku: 'AGV-TOOL-CAN14-STD', defaultCostPrice: 12000, defaultSellingPrice: 15500 }
    ]
  },
  {
    name: 'Drip Irrigation Starter Kit',
    category: 'Irrigation & Equipment',
    description: 'Starter kit with mainline, drippers, and fittings for 500sqm.',
    unit: 'kit',
    manufacturer: 'Rain Bird East Africa',
    variants: [
      { name: '500sqm Kit', sku: 'AGV-IRR-DRIP-500', defaultCostPrice: 180000, defaultSellingPrice: 225000 },
      { name: '1000sqm Kit', sku: 'AGV-IRR-DRIP-1000', defaultCostPrice: 320000, defaultSellingPrice: 400000 },
      { name: 'Dripper Pack (100pc)', sku: 'AGV-IRR-DRIPPER-100', defaultCostPrice: 25000, defaultSellingPrice: 32000 },
      { name: 'Mainline 16mm 100m', sku: 'AGV-IRR-MAIN-100M', defaultCostPrice: 45000, defaultSellingPrice: 58000 }
    ]
  },
  {
    name: 'HDPE Water Pipe',
    category: 'Irrigation & Equipment',
    description: 'High-density polyethylene pipe for farm water distribution.',
    unit: 'meter',
    manufacturer: 'Pipelife Tanzania',
    variants: [
      { name: '20mm x 6m', sku: 'AGV-IRR-PIPE-20-6M', defaultCostPrice: 4500, defaultSellingPrice: 5800 },
      { name: '25mm x 6m', sku: 'AGV-IRR-PIPE-25-6M', defaultCostPrice: 6000, defaultSellingPrice: 7800 },
      { name: '32mm x 6m', sku: 'AGV-IRR-PIPE-32-6M', defaultCostPrice: 8500, defaultSellingPrice: 11000 },
      { name: '50mm x 6m', sku: 'AGV-IRR-PIPE-50-6M', defaultCostPrice: 14000, defaultSellingPrice: 18000 }
    ]
  },
  {
    name: 'Solar Water Pump 1HP',
    category: 'Irrigation & Equipment',
    description: 'Solar-powered submersible pump for shallow wells and tanks.',
    unit: 'piece',
    manufacturer: 'Lorentz East Africa',
    variants: [
      { name: '0.5HP Kit', sku: 'AGV-IRR-PUMP-05HP', defaultCostPrice: 650000, defaultSellingPrice: 820000 },
      { name: '1HP Kit', sku: 'AGV-IRR-PUMP-1HP', defaultCostPrice: 950000, defaultSellingPrice: 1200000 },
      { name: '1.5HP Kit', sku: 'AGV-IRR-PUMP-15HP', defaultCostPrice: 1250000, defaultSellingPrice: 1580000 },
      { name: 'Controller Only', sku: 'AGV-IRR-PUMP-CTRL', defaultCostPrice: 180000, defaultSellingPrice: 230000 }
    ]
  }
]

export async function seedCatalog(prisma: PrismaClient) {
  const categoryNames = [...new Set(CATALOG.map(item => item.category))]
  const categoryMap = new Map<string, string>()

  for (const name of categoryNames) {
    const existing = await prisma.category.findFirst({ where: { name } })
    const category = existing ?? await prisma.category.create({ data: { name } })
    categoryMap.set(name, category.id)
  }

  let productCount = 0
  let variantCount = 0

  for (const item of CATALOG) {
    const categoryId = categoryMap.get(item.category)
    if (!categoryId) continue

    let product = await prisma.product.findFirst({
      where: { name: item.name, categoryId }
    })

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: item.name,
          categoryId,
          description: item.description,
          unit: item.unit,
          manufacturer: item.manufacturer,
          isRestricted: item.isRestricted ?? false,
          ...(item.dosageInfo ? { dosageInfo: item.dosageInfo } : {})
        }
      })
    }

    productCount++

    for (const variant of item.variants) {
      await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        update: {
          name: variant.name,
          defaultCostPrice: variant.defaultCostPrice,
          defaultSellingPrice: variant.defaultSellingPrice,
          productId: product.id
        },
        create: {
          productId: product.id,
          name: variant.name,
          sku: variant.sku,
          defaultCostPrice: variant.defaultCostPrice,
          defaultSellingPrice: variant.defaultSellingPrice
        }
      })

      variantCount++
    }
  }

  console.log(
    `Catalog seed ready: ${categoryNames.length} categories, ${productCount} products, ${variantCount} variants`
  )
}
