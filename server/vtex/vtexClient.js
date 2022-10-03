import Settings from "./Settings";
import { formattedProductData, formattedInvoiceData } from "./vtexHelper";

async function getShopSettings(shop) {
  return await Settings.findOne({where: {shop: shop}})
}

export const headers = (settings) => {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json',
    'X-VTEX-API-AppKey': settings.app_key,
    'X-VTEX-API-AppToken': settings.app_token,
  }
}

export async function changeNotification(skuId, shop) {
  const shopSettings = (await getShopSettings(shop)).toJSON()

  return await fetch(`https://${shopSettings.account_name}.myvtex.com/api/catalog_system/pvt/skuseller/changenotification/${shopSettings.seller_id}/${skuId}`, {
    method: "POST",
    headers: headers(shopSettings)
  })
}

export async function sendSKUSuggestion(skuId, body, shop) {
  const shopSettings = (await getShopSettings(shop)).toJSON()
  const payload = await formattedProductData(skuId, body, shopSettings)

  if (payload.Images.length) {
    return await fetch(`https://api.vtex.com/${shopSettings.account_name}/suggestions/${shopSettings.seller_id}/${skuId}`, {
      method: "PUT",
      headers: headers(shopSettings),
      body: JSON.stringify(payload)
    })
  }
}

export async function cancelOrder(order_id, shop) {
  const shopSettings = (await getShopSettings(shop)).toJSON()
  return await fetch(`https://${shopSettings.account_name}.myvtex.com/api/oms/pvt/orders/${order_id}/cancel`, {
    method: "POST",
    headers: headers(shopSettings)
  })
}

export async function notifyInvoice(data, shop) {
  const shopSettings = (await getShopSettings(shop)).toJSON()
  const payload = await formattedInvoiceData(data)

  return await fetch(`https://${shopSettings.account_name}.myvtex.com/api/oms/pvt/orders/${data.reference}/invoice`, {
    method: "POST",
    headers: headers(shopSettings),
    body: JSON.stringify(payload)
  })
}

export async function updateTracking(data, shop) {
  const shopSettings = (await getShopSettings(shop)).toJSON()

  if (
    data
    && data.hasOwnProperty('fulfillments')
    && data.fulfillments[0].hasOwnProperty('tracking_number')
    && data.fulfillments[0].tracking_number
  ) {
    const payload = {
      trackingNumber: data.fulfillments[0].tracking_number,
      courier: data.fulfillments[0].tracking_company,
      trackingUrl: data.fulfillments[0].tracking_url,
    }

    return await fetch(`https://${shopSettings.account_name}.myvtex.com/api/oms/pvt/orders/${data.reference}/invoice/${data.id}`, {
      method: "PATCH",
      headers: headers(shopSettings),
      body: JSON.stringify(payload)
    })
  }
}


