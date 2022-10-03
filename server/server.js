import "@babel/polyfill";
import dotenv from "dotenv";
import "isomorphic-fetch";
import createShopifyAuth, { verifyRequest } from "@shopify/koa-shopify-auth";
import Shopify, { ApiVersion } from "@shopify/shopify-api";
import Koa from "koa";
import next from "next";
import Router from "koa-router";
import koaBody from "koa-body";
import sequelize from "./vtex/connection";
import Settings from "./vtex/Settings";
import {
  logActivity,
  handleProduct,
  handleSimulation,
  orderPlacement,
  orderCancel,
  cancelMarketplaceOrder,
  fulfillOrder,
  notifyMarketplaceInvoice,
  updateMarketplaceTracking
} from "./vtex/vtexHandlers";

dotenv.config();
const port = parseInt(process.env.PORT, 10) || 8081;
const dev = process.env.NODE_ENV !== "production";
const app = next({
  dev,
});
const handle = app.getRequestHandler();

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SCOPES.split(","),
  HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
  API_VERSION: ApiVersion.October20,
  IS_EMBEDDED_APP: true,
  // This should be replaced with your preferred storage strategy
  SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS = {};

app.prepare().then(async () => {
  await sequelize.sync();

  const server = new Koa();
  const router = new Router();
  server.keys = [Shopify.Context.API_SECRET_KEY];
  server.use(
    createShopifyAuth({
      async afterAuth(ctx) {
        // Access token and shop available in ctx.state.shopify
        const { shop, accessToken, scope } = ctx.state.shopify;
        const host = ctx.query.host;
        ACTIVE_SHOPIFY_SHOPS[shop] = scope;

        await Settings.findOne({ where: { shop: shop } }).then(function (obj) {
          if (obj) {
            obj.update({ shopify_token: accessToken });
          } else {
            Settings.create({ shop: shop, shopify_token: accessToken });
          }
        });

        const response = await Shopify.Webhooks.Registry.register({
          shop,
          accessToken,
          path: "/webhooks",
          topic: "APP_UNINSTALLED",
          webhookHandler: async (topic, shop, body) =>
            delete ACTIVE_SHOPIFY_SHOPS[shop],
        });

        if (!response.success) {
          console.log(
            `Failed to register APP_UNINSTALLED webhook: ${response.result}`
          );
        }

        await Shopify.Webhooks.Registry.register({
          shop,
          accessToken,
          path: "/webhooks",
          topic: "PRODUCTS_UPDATE",
          webhookHandler: async (topic, shop, body) =>
            handleProduct(JSON.parse(body), shop),
        });

        await Shopify.Webhooks.Registry.register({
          shop,
          accessToken,
          path: "/webhooks",
          topic: "ORDERS_CANCELLED",
          webhookHandler: async (topic, shop, body) =>
            cancelMarketplaceOrder(JSON.parse(body), shop),
        });

        await Shopify.Webhooks.Registry.register({
          shop,
          accessToken,
          path: "/webhooks",
          topic: "ORDERS_PAID",
          webhookHandler: async (topic, shop, body) =>
            notifyMarketplaceInvoice(JSON.parse(body), shop),
        });

        await Shopify.Webhooks.Registry.register({
          shop,
          accessToken,
          path: "/webhooks",
          topic: "ORDERS_UPDATED",
          webhookHandler: async (topic, shop, body) =>
            updateMarketplaceTracking(JSON.parse(body), shop),
        });

        router.post("/admin/apps/vtex_connector", koaBody(), async (ctx) => {
          const query = new URLSearchParams(ctx.request.header.referer);
          const shopParam = query.get("shop");
          const hostParam = query.get("host");

          ctx.type = "application/json; charset=utf-8";

          if (
            hostParam === null ||
            shopParam === null ||
            ACTIVE_SHOPIFY_SHOPS[shopParam] === undefined
          ) {
            ctx.status = 401;
            ctx.body = JSON.stringify({ message: "Unauthorized!" });
          } else {
            const payload = JSON.parse(ctx.request.body);

            const model = await Settings.findOne({
              where: { shop: shop },
            }).then(function (obj) {
              if (obj) {
                return obj.update(payload);
              }
              payload.shop = shop;
              return Settings.create(payload);
            });

            ctx.status = 200;
            ctx.body = JSON.stringify(model.toJSON());
          }
        });

        // Redirect to app with shop parameter upon auth
        ctx.redirect(`/?shop=${shop}&host=${host}`);
      },
    })
  );

  const handleRequest = async (ctx) => {
    await handle(ctx.req, ctx.res);
    ctx.respond = false;
    ctx.res.statusCode = 200;
  };

  router.post("/webhooks", async (ctx) => {
    try {
      await Shopify.Webhooks.Registry.process(ctx.req, ctx.res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  router.post(
    "/graphql",
    verifyRequest({ returnHeader: true }),
    async (ctx, next) => {
      await Shopify.Utils.graphqlProxy(ctx.req, ctx.res);
    }
  );

  router.get("/admin/apps/vtex_connector_settings", async (ctx) => {
    const query = new URLSearchParams(ctx.request.header.referer);
    const shopParam = query.get("shop");
    const hostParam = query.get("host");

    ctx.type = "application/json; charset=utf-8";
    ctx.status = 200;

    if (
      hostParam === null ||
      shopParam === null ||
      ACTIVE_SHOPIFY_SHOPS[shopParam] === undefined
    ) {
      ctx.body = JSON.stringify({});
    } else {
      const response = await Settings.findOne({ where: { shop: shopParam } });
      if (response === null) {
        ctx.body = JSON.stringify({});
      } else {
        ctx.body = JSON.stringify(response.toJSON());
      }
    }
  });

  router.post("/api/fulfillment/pvt/orderForms/simulation", koaBody(), handleSimulation);
  router.post("/api/fulfillment/pvt/orders", koaBody(), orderPlacement);
  router.post("/api/fulfillment/pvt/orders/:order_id/cancel", koaBody(), orderCancel);
  router.post("/api/fulfillment/pvt/orders/:order_id/fulfill", koaBody(), fulfillOrder);

  router.get("(/_next/static/.*)", handleRequest); // Static content is clear
  router.get("/_next/webpack-hmr", handleRequest); // Webpack content is clear
  router.get("(.*)", async (ctx) => {
    const shop = ctx.query.shop;

    // This shop hasn't been seen yet, go through OAuth to create a session
    if (ACTIVE_SHOPIFY_SHOPS[shop] === undefined) {
      ctx.redirect(`/auth?shop=${shop}`);
    } else {
      await handleRequest(ctx);
    }
  });

  server.use(async (ctx, next) => {
    await logActivity(ctx, next)
  })

  server.use(router.allowedMethods());
  server.use(router.routes());

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
