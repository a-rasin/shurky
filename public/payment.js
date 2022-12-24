const applePayButton = document.querySelector('#apple-pay-button');
const paymentButton = document.querySelector('#payment-button');

const makePayment = (method) => async () => {
  const request = new PaymentRequest(method, buildShoppingCartDetails());
  request.show().then((paymentResponse) => {
    // Here we would process the payment. For this demo, simulate immediate success:
    paymentResponse.complete('success')
      .then(() => {
        // For demo purposes:
        alert('done')
      })
      .catch((e) => console.log(e));
  })
}

const googlePaymentDataRequest = {
  environment: 'TEST',
  apiVersion: 2,
  apiVersionMinor: 0,
  merchantInfo: {
    // A merchant ID is available after approval by Google.
    // @see {@link https://developers.google.com/pay/api/web/guides/test-and-deploy/integration-checklist}
    // merchantId: '12345678901234567890',
    merchantName: 'Example Merchant'
  },
  allowedPaymentMethods: [{
    type: 'CARD',
    parameters: {
      allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
      allowedCardNetworks: ["AMEX", "DISCOVER", "INTERAC", "JCB", "MASTERCARD", "VISA"]
    },
    tokenizationSpecification: {
      type: 'PAYMENT_GATEWAY',
      // Check with your payment gateway on the parameters to pass.
      // @see {@link https://developers.google.com/pay/api/web/reference/request-objects#gateway}
      parameters: {
        'gateway': 'example',
        'gatewayMerchantId': 'exampleGatewayMerchantId'
      }
    }
  }]
};

const applePaymentDataRequest = {
  version: 3,
  merchantIdentifier: "merchant.com.example",
  merchantCapabilities: ["supports3DS", "supportsCredit", "supportsDebit"],
  supportedNetworks: ["amex", "discover", "masterCard", "visa"],
  countryCode: "US",
};

function buildSupportedPaymentMethodData() {
  // Example supported payment methods:
  return [
    {supportedMethods: "https://apple.com/apple-pay", data: applePaymentDataRequest},
    {supportedMethods: 'https://google.com/pay', data: googlePaymentDataRequest},
    // {supportedMethods: 'basic-card', data: { supporedNetworks: googlePaymentDataRequest.allowedPaymentMethods[0].parameters.allowedCardNetworks.map(a => a.toLowerCase())}},
  ];
}

function buildShoppingCartDetails() {
  // Hardcoded for demo purposes:
  return {
    id: 'order-123',
    displayItems: [
      {
        label: 'Example item',
        amount: { currency: 'USD', value: '1.00' }
      }
    ],
    total: {
      label: 'Total',
      amount: { currency: 'USD', value: '1.00' }
    }
  };
}

// Enable available buttons
new PaymentRequest([buildSupportedPaymentMethodData()[1]], {
  total: { label: "Stub", amount: { currency: "USD", value: "0.01" } },
})
  .canMakePayment()
  .then((result) => {
      paymentButton.disabled = !result
  });

applePayButton.disabled = !(window.ApplePaySession && ApplePaySession.canMakePayments());

paymentButton.addEventListener('click', makePayment([buildSupportedPaymentMethodData()[1]]));
applePayButton.addEventListener('click', makePayment([buildSupportedPaymentMethodData()[0]]));
