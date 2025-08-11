const crypto = require("crypto");
const config = require("../config/config");

const orderId = "order_R48FRabQ7HGoIy";
const paymentId = "pay_ABCdef012345";
const keySecret = config.razorpay.key_secret;

const signature = crypto
  .createHmac("sha256", keySecret)
  .update(`${orderId}|${paymentId}`)
  .digest("hex");

console.log("Signature:  ", signature);