import {cancelOrder, changeNotification, notifyInvoice, sendSKUSuggestion, updateTracking} from "./vtexClient";
import Settings from "./Settings";
import ActivityLogs from "./ActivityLogs";
import { getSimulationLogisticInfo, getSimulationProducts } from "./vtexHelper";
import { generateOrderObject } from "../shopify/shopifyHelper";
import moment from "moment";

export async function logActivity(ctx, next) {
  let settings = null;

  await checkAuth(ctx).then(async (response) => {
    if (response) {
      settings = response.toJSON();
    }
  });

  await next()
    .then(() => {
      if (settings) {
        ActivityLogs.create({
          created_at: new Date().toString(),
          action: ctx.url,
          request: ctx.method,
          response: JSON.stringify(ctx.body),
          type: "success",
          shop: settings.shop,
        });
      }
    })
    .catch((error) => {
      if (settings) {
        ActivityLogs.create({
          created_at: new Date().toString(),
          action: ctx.url,
          request: ctx.method,
          response: JSON.stringify(error.toString()),
          type: "error",
          shop: settings.shop,
        });
      }
    });
}

async function checkAuth(ctx) {
  const params = ctx.request.url.split("?");
  const query = new URLSearchParams(params[1]);
  const token = query.get("token");
  return await Settings.findOne({ where: { access_token: token } });
}

export async function handleProduct(body, shop) {
  body.variants.map(async (item) => {
    await changeNotification(item.id, shop).then(async (response) => {
      if (response.status === 404) {
        await sendSKUSuggestion(item.id, body, shop);
      }
    });
  })
}

export const handleSimulation = async (ctx) => {
  await checkAuth(ctx).then(async (response) => {
    if (response) {
      const settings = response.toJSON();
      const payload = ctx.request.body;

      const items = await getSimulationProducts(payload, settings);
      const logisticsInfo = await getSimulationLogisticInfo(payload, settings);

      const body = {
        country: payload.country,
        postalCode: payload.postalCode,
        geoCoordinates: payload.geoCoordinates,
        pickupPoints: [],
        messages: [],
        items: items,
        logisticsInfo: logisticsInfo,
      };

      ctx.status = 200;
      ctx.body = body;
    }
  });
};

export const orderPlacement = async (ctx) => {
  await checkAuth(ctx).then(async (response) => {
    if (response) {
      const payload = ctx.request.body;
      const settings = response.toJSON();
      const orderBody = await generateOrderObject(payload, settings);

      const order = await fetch(
        `https://${settings.shop}/admin/api/2021-07/orders.json`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": settings.shopify_token,
          },
          method: "POST",
          body: JSON.stringify(orderBody),
        }
      );
      const orderResponse = await order.json();

      response = [{
        marketplaceOrderId: payload[0].marketplaceOrderId,
        orderId: orderResponse.order.id.toString(),
        followUpEmail: payload[0].clientProfileData.email,
        items: payload[0].items,
        clientProfileData: payload[0].clientProfileData,
        shippingData: payload[0].shippingData,
        paymentData: null
      }]

      ctx.status = 200;
      ctx.body = response;
    }
  });
};

export const orderCancel = async (ctx) => {
  await checkAuth(ctx).then(async (response) => {
    if (response) {
      const payload = ctx.request.body;
      const settings = response.toJSON();

      const orderCancellation = await fetch(
        `https://${settings.shop}/admin/api/2021-07/orders/${ctx.params.order_id}/cancel.json`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": settings.shopify_token,
          },
          method: "POST",
          body: JSON.stringify({}),
        }
      );
      await orderCancellation.json();

      response = {
        date: moment().format('YYYY-MM-DD HH:m:s'),
        marketplaceOrderId: payload.marketplaceOrderId,
        orderId: ctx.params.order_id,
        receipt: null
      }

      ctx.status = 200;
      ctx.body = response;
    }
  });
};

export async function cancelMarketplaceOrder(body, shop) {
  await cancelOrder(body.reference, shop);
}

export const fulfillOrder = async (ctx) => {
  await checkAuth(ctx).then(async (response) => {
    if (response) {
      const payload = ctx.request.body;
      const settings = response.toJSON();

      //this will capture the payment and marks the order ad paid, but it will automatically trigger the
      //ORDERS_PAID webhook witch will automatically send the invoice notification

      // const capture = await fetch(
      //   `https://${settings.shop}/admin/api/2021-07/orders/${ctx.params.order_id}/transactions.json`,
      //   {
      //     headers: {
      //       "Content-Type": "application/json",
      //       "X-Shopify-Access-Token": settings.shopify_token,
      //     },
      //     method: "POST",
      //     body: JSON.stringify({
      //       transaction: {
      //         kind: "capture",
      //         gateway: "manual"
      //       }
      //     }),
      //   }
      // );
      // await capture.json();

      response = {
        date: moment().format('YYYY-MM-DD HH:m:s'),
        marketplaceOrderId: payload.marketplaceOrderId,
        orderId: ctx.params.order_id,
        receipt: null
      }

      ctx.status = 200;
      ctx.body = response;
    }
  });
}

export async function notifyMarketplaceInvoice(body, shop) {
  await notifyInvoice(body, shop);
}

export async function updateMarketplaceTracking(body, shop) {
  await updateTracking(body, shop);
}

export async function getShopData(settings) {
  const data = await fetch(
    `https://${settings.shop}/admin/api/2021-07/shop.json`,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": settings.shopify_token,
      },
      method: "GET",
    }
  );
  return await data.json()
}

export async function getShippingZones(settings) {
  const data = await fetch(
    `https://${settings.shop}/admin/api/2021-07/shipping_zones.json`,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": settings.shopify_token,
      },
      method: "GET",
    }
  );
  return await data.json()
}
