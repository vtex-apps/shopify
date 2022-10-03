import {getVariant, priceMultiplier} from "../vtex/vtexHelper";

export async function generateOrderObject(data, settings) {
  const { clientProfileData, items, shippingData, marketplacePaymentValue } = data[0];

  const shippingCost = shippingData.logisticsInfo.reduce((result, item) => {
    return result + item.price
  }, 0)

  const products = await Promise.all(
    items.map(async (item) => {
      const variant = await getVariant(item.id, settings);
      return {
        title: variant.title,
        variant_id: item.id,
        quantity: item.quantity * item.unitMultiplier,
        price: item.price / item.unitMultiplier / priceMultiplier,
      };
    })
  );
  return {
    order: {
      line_items: products,
      shipping_lines: [
        {
          code: "INT.TP",
          price: shippingCost / priceMultiplier,
          title: "Standard",
          carrier_identifier: null,
          requested_fulfillment_service_id: null
        }
      ],
      customer: {
        first_name: clientProfileData.firstName,
        last_name: clientProfileData.lastName,
        email: clientProfileData.email,
      },
      billing_address: {
        first_name: clientProfileData.firstName,
        last_name: clientProfileData.lastName,
        address1: `${shippingData.address.street} ${shippingData.address.number}`,
        phone: clientProfileData.phone,
        city: shippingData.address.city,
        province: shippingData.address.state,
        country: shippingData.address.country,
        zip: shippingData.address.postalCode,
      },
      shipping_address: {
        first_name: clientProfileData.firstName,
        last_name: clientProfileData.lastName,
        address1: `${shippingData.address.street} ${shippingData.address.number}`,
        phone: clientProfileData.phone,
        city: shippingData.address.city,
        province: shippingData.address.state,
        country: shippingData.address.country,
        zip: shippingData.address.postalCode,
      },
      email: clientProfileData.email,
      financial_status: "pending",
      reference: data[0].marketplaceOrderId,
      fulfillment_status: "fulfilled",
      transactions: [
        {
          amount: marketplacePaymentValue / priceMultiplier,
          kind: "authorization",
          status: "success"
        }
      ]
    },
  };
}
