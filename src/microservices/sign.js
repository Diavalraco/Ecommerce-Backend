const crypto = require("crypto");
const config = require("../config/config");

const orderId = "order_R47jbSX18F5k4C";
const paymentId = "pay_ABCdef012345";
const keySecret = config.razorpay.key_secret;

const signature = crypto
  .createHmac("sha256", keySecret)
  .update(`${orderId}|${paymentId}`)
  .digest("hex");

console.log("Signature:  ", signature);
  
RAZORPAY_KEY_ID=rzp_test_7f2a3rN8kKecHB
RAZORPAY_KEY_SECRET=XYLikb9n3MxIToj6I30UFkxd