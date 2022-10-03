### External Seller Connector - Shopify

### De ce?

Scopul acestei aplicatii este sa integram "External Seller Connector" folosind WebService-ul oferit de Shopify.

## Steps

1. Generam o aplicatie de shopify folosind CLI-ul oferit: [LINK](https://shopify.dev/tools/cli). Acest CLI o sa genereze o aplicatie de nodejs (aplicatia trebuie hostata de noi). 
2. Aplicatia de nodejs o sa aiba si o baza de date unde salvam credentialele de VTEX(accountname, apikey, appsecret)
3. Pentru a primi informatii relevante despre produse/comenzi/etc o sa ne folosim de webhooks: [Anatomy of a webhook](https://shopify.dev/tutorials/manage-webhooks) / lista webhooks - [List](https://shopify.dev/docs/admin-api/graphql/reference/events/webhooksubscriptiontopic)

Exemplu webhook

Definim ruta pentru webhooks:

```javascript
router.post("/webhooks", async (ctx) => {
  try {
    await Shopify.Webhooks.Registry.process(ctx.req, ctx.res);
    console.log(`Webhook processed, returned status code 200`);
  } catch (error) {
    console.log(`Failed to process webhook: ${error}`);
  }
});
```

Register webhook si handler :

```javascript
const response = await Shopify.Webhooks.Registry.register({
  shop,
  accessToken,
  path: "/webhooks",
  topic: "PRODUCTS_UPDATE",
  webhookHandler: async (topic, shop, body) => {
    console.log(JSON.stringify(body));
  },
});
```
## Error Handling
Pentru toate situațiile (error, success) obiectul logat va avea forma de mai jos

```json
{
  "ACTION": "ACTION",
  "DATE_TIME": "DATE_TIME",
  "REQ_OBJECT": "REQ_OBJECT",
  "REASON": "REASON",
  "TYPE": "TYPE"
}
```
## Produse

Ne folosim de hook-ul `PRODUCTS_UPDATE` pentru a trimite requestul de change notification pentru fiecare produs.

Odata ce primim produsele apelam **[Change Notification](https://developers.vtex.com/vtex-developer-docs/reference/catalog-api-sku-seller#catalog-api-get-seller-sku-notification)** pentru fiecare produs in parte.

Daca primim status response code 200 - Apelam **[Fulfillment Simulation](https://developers.vtex.com/vtex-developer-docs/reference/external-seller#fulfillment-simulation)**

Daca primim status response code 404 - Apelam **[Send SKU Suggestion](https://developers.vtex.com/vtex-developer-docs/reference/manage-suggestions-1)**

## Comenzi - Order Placement
Trebuie sa implementam [Order Placement](https://developers.vtex.com/vtex-developer-docs/reference/external-seller#order-placement).

Aici trebuie sa apelam API-ul de [create order](https://shopify.dev/docs/admin-api/rest/reference/orders/order#create-2021-04)
si sa respectam request body si response body specificat de VTEX in documentatie.


## Comenzi - Order Dispatching 

Acest request este trimis de marketplace catre seller odata ce s-a facut plata cu succes.

Trebuie sa implementam [Order Dispatching](https://developers.vtex.com/vtex-developer-docs/reference/external-seller#order-dispatching).

In Shopify nu se poate schimba statusul in mod direct, trebuie sa ne folosim de API-ul de [Transactions](https://shopify.dev/docs/admin-api/rest/reference/orders/transaction#create-2021-04) pentru a face asta.

Utile: 
 - https://community.shopify.com/c/Shopify-APIs-SDKs/Order-status-update-using-api/m-p/551843#M36491`

 - https://shopify.dev/docs/admin-api/rest/reference/orders/transaction#create-2021-04

Respectam request body si response body specificat de VTEX in documentatie.

## Comenzi - Order Invoice Notification

Ne folosim de hook-ul `ORDERS_PAID` pentru a trimite requestul Order Invoice Notification pentru fiecare order.

Apelam requestul: [Order Invoice Notification](https://developers.vtex.com/vtex-developer-docs/reference/invoice#invoicenotification) cu request body specificat de VTEX in documentatie.

***Shopify nu ofera optiunea de a avea un invoice_url, trebuie sa folosim fie un plugin de Shopify de exemplu : [Order Printer Pro](https://apps.shopify.com/order-printer-pro) sau sa dezvoltam noi ceva similar cu `macromex.invoicing`***


## Comenzi - Cancellation by the marketplace

Trebuie sa apelam API-ul oferit de Shopify pentru a anula comanda. [Link](https://shopify.dev/docs/admin-api/rest/reference/orders/order#cancel-2021-04)

Respectam request body si response body specificat de VTEX in [documentatie](https://developers.vtex.com/vtex-developer-docs/reference/external-seller#mkp-order-cancellation).

## Comenzi - Cancellation by the seller

Ne folosim de hook-ul `ORDERS_CANCELLED` pentru a trimite requestul Cancel Order pentru fiecare order.

Apelam: [Cancel Order](https://developers.vtex.com/vtex-developer-docs/reference/orders#cancelorder) cu request body specificat de VTEX in documentatie.

**Restul endpointurilor sunt folosite de VTEX Marketplace si sunt deja folosite in workflow-ul lor. Deci daca avem totul implementat conform specifiicatiilor avem o integrare perfecta.**