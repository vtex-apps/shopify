import Shopify from "@shopify/shopify-api";
import {getShippingZones, getShopData} from "./vtexHandlers";

export const priceMultiplier = 100

export async function formattedProductData(skuId, data, shopSettings) {
  let product = data.variants.filter(function(item) {
    return item.id === skuId
  });
  product = product[0]
  const sku = `${shopSettings.seller_id}-${skuId}`
  const variant = await getVariant(skuId, shopSettings)
  const shopData = await getShopData(shopSettings)

  return {
    ProductName: `${data.title} ${product.title}`,
    ProductId: data.id,
    ProductDescription: data.body_html,
    BrandName: data.vendor??"NONAME",
    SkuName: sku,
    SellerId: shopSettings.seller_id,
    Height: 1,
    Width: 1,
    Length: 1,
    WeightKg: product.weight,
    RefId: sku,
    SellerStockKeepingUnitId: skuId,
    CategoryFullPath: variant?.product?.collections?.edges[0]?.node?.title ?? "NONAME",
    SkuSpecifications: await specifications(skuId, data),
    ProductSpecifications: await specifications(skuId, data),
    Images: await images(data),
    MeasurementUnit: 'un',
    UnitMultiplier: 1,
    AvailableQuantity: product.inventory_quantity,
    Pricing: {
      Currency: shopData.shop.currency,
      SalePrice: product.price,
      CurrencySymbol: shopData.shop.currency,
    },
  }
}

export async function getSimulationProducts(data, settings) {
  const response = []
  await Promise.all(data.items.map(async (item, index) => {
    await getVariant(item.id, settings)
      .then(variant => {
        response.push({
          id: item.id,
          requestIndex: index,
          quantity: item.quantity,
          price: variant.price * priceMultiplier,
          listPrice: variant.price * priceMultiplier,
          sellingPrice: variant.price * priceMultiplier,
          measurementUnit: 'un',
          merchantName: null,
          priceValidUntil: null,
          seller: settings.seller_id,
          unitMultiplier: 1,
          attachmentOfferings: [],
          offerings: [],
          priceTags: [],
          availability: variant.inventoryQuantity?'available':'unavailable'
        })
      })
  }))
  return response
}


export async function getSimulationLogisticInfo(data, settings) {
  const response = []
  let shipping = 0
  const shippingZones = await getShippingZones(settings)
  let shippingZone = shippingZones.shipping_zones.filter(function(item) {
    return item.name === "Domestic"
  })
  if (shippingZone.length) {
    shippingZone = shippingZone[0]
    if (shippingZone.price_based_shipping_rates.length) {
      shipping = shippingZone.price_based_shipping_rates[0].price * priceMultiplier
    }
  }

  await Promise.all(data.items.map(async (item, index) => {
    await getVariant(item.id, settings)
      .then(variant => {
        response.push({
          itemIndex: index,
          quantity: item.quantity,
          stockBalance: variant.inventoryQuantity,
          shipsTo: [ ...[], data?.country ],
          slas: [
            {
              id: 'Normal',
              deliveryChannel: 'delivery',
              name: 'Normal',
              shippingEstimate: '1bd',
              price: shipping / data.items.length
            }
          ],
          deliveryChannels: [
            {
              id: 'delivery',
              stockBalance: variant.inventoryQuantity
            }
          ]
        })
      })
  }))
  return response
}

export async function images(data) {
  const output = []

  await Promise.all(data.images.map(async (item) => {
      output.push({
        imageName: `Image${item.id}`,
        imageUrl: item.src
      })
    })
  )

  return output
}

export async function specifications(skuId, data) {
  const output = []

  let product = data.variants.filter(function(item) {
    return item.id === skuId
  });
  product = product[0]

  await Promise.all(data.options.map(async (item) => {
      if (product[`option${item.position}`]) {
        output.push({
          'FieldName': item.name,
          'FieldValues': [
            product[`option${item.position}`]
          ]
        })
      }
    })
  )

  return output
}

export async function getProduct(id, settings) {
  const client = new Shopify.Clients.Graphql(settings.shop, settings.shopify_token);

  const { body: { data: { product } } } =  await client.query({
    data: `{
      product(id: "gid://shopify/Product/${id}") {
          title,
          handle,
          variants(first: 1) {
            edges {
              node {
                id,
                price,
                inventoryQuantity
              }
            }
          }
        }
    }`,
  });

  return product;
}

export async function getVariant(id, settings) {
  const client = new Shopify.Clients.Graphql(settings.shop, settings.shopify_token);

  const { body: { data: { productVariant } } } =  await client.query({
    data: `{
      productVariant(id: "gid://shopify/ProductVariant/${id}") {
          title,
          price,
          inventoryQuantity,
          product {
            collections(first: 1) {
              edges {
                node {
                  title
                }
              }
            }
          }
        }
    }`,
  });

  return productVariant;
}

export async function formattedInvoiceData(data) {
  const items = await Promise.all(
    data.line_items.map(async (item) => {
      return {
        id: item.variant_id,
        quantity: item.quantity,
        price: item.price * priceMultiplier,
      };
    })
  );

  return {
    type: "Output",
    invoiceNumber: data.id,
    invoiceValue: data.current_total_price * priceMultiplier,
    issuanceDate: new Date().toISOString(),
    items: items
  }
}
