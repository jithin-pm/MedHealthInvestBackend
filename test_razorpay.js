require('dotenv').config();
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function testOrder() {
  try {
    console.log("Testing Razorpay with Key:", process.env.RAZORPAY_KEY_ID);
    const options = {
      amount: 10000, // 100 INR
      currency: "INR",
      receipt: "receipt_test_" + Date.now(),
    };
    const order = await razorpay.orders.create(options);
    console.log("Order Created Successfully:", order.id);
  } catch (error) {
    console.error("Razorpay Test Failed:", error);
  }
}

testOrder();
