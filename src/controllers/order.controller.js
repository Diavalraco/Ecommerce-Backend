const Order = require('../models/order.model');
const Products = require('../models/products.model');
const Coupon = require('../models/coupon.model');
const Address = require('../models/address.model');
const crypto = require('crypto');
const config = require('../config/config');
const razorpay = config.razorpay;

const createOrder = async (req, res) => {
  try {
    const {items, deliveryAddressId, couponCode} = req.body;
    const userId = req.user.id;

    const address = await Address.findOne({_id: deliveryAddressId, userId});
    if (!address) {
      return res.status(400).json({error: 'Invalid delivery address'});
    }

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Products.findById(item.productId);
      if (!product || product.status !== 'active') {
        return res.status(400).json({error: `Product ${item.productId} not available`});
      }

      const quantityDetail = product.quantityDetails[item.quantityIndex];
      if (!quantityDetail) {
        return res.status(400).json({error: 'Invalid quantity index'});
      }

      const packageDetail = quantityDetail.packages[item.packageIndex];
      if (!packageDetail) {
        return res.status(400).json({error: 'Invalid package index'});
      }

      const itemTotal = packageDetail.sellPrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: item.productId,
        quantityIndex: item.quantityIndex,
        packageIndex: item.packageIndex,
        quantity: item.quantity,
        price: packageDetail.sellPrice,
        totalPrice: itemTotal,
      });
    }

    let discountAmount = 0;
    let validCoupon = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        status: 'active',
      });
      if (!coupon) {
        return res.status(400).json({error: 'Invalid coupon code'});
      }
      if (subtotal < coupon.minOrderValue) {
        return res.status(400).json({
          error: `Minimum order value should be ₹${coupon.minOrderValue} to use this coupon`,
        });
      }

      const type = coupon.discountType.toLowerCase();
      if (type === 'percent' || type === 'percentage') {
        discountAmount = Math.min((subtotal * coupon.discountValue) / 100, coupon.maxDiscount);
      } else {
        discountAmount = Math.min(coupon.discountValue, coupon.maxDiscount ?? coupon.discountValue);
      }

      discountAmount = parseFloat(discountAmount.toFixed(2));
      validCoupon = coupon;
    }

    const rawTotal = subtotal - discountAmount;
    const totalAmount = Math.round(rawTotal);

    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100,
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        couponCode: validCoupon ? validCoupon.code : '',
      },
    });

    const order = new Order({
      userId,
      items: orderItems,
      subtotal,
      couponCode: validCoupon ? validCoupon.code : null,
      discountAmount,
      totalAmount,
      deliveryAddress: deliveryAddressId,
      razorpayOrderId: razorpayOrder.id,
    });

    await order.save();

    if (validCoupon) {
      await Coupon.findByIdAndUpdate(validCoupon._id, {$inc: {usageCount: 1}});
    }

    const populatedOrder = await Order.findById(order._id)
      .populate('items.productId', 'name images')
      .populate('deliveryAddress');

    res.status(201).json({
      message: 'Order created successfully',
      order: populatedOrder,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({error: 'Internal server error'});
  }
};

const applyCoupon = async (req, res) => {
  try {
    const {couponCode, subtotal} = req.body;

    if (!couponCode || !subtotal) {
      return res.status(400).json({error: 'Coupon code and subtotal are required'});
    }

    const coupon = await Coupon.findOne({code: couponCode.toUpperCase(), status: 'active'});
    if (!coupon) {
      return res.status(400).json({error: 'Invalid coupon code'});
    }

    if (subtotal < coupon.minOrderValue) {
      return res.status(400).json({
        error: `Minimum order value should be ₹${coupon.minOrderValue} to use this coupon`,
        minOrderValue: coupon.minOrderValue,
      });
    }
    const type = coupon.discountType.toLowerCase();

    if (type === 'percent' || type === 'percentage') {
      discountAmount = Math.min((subtotal * coupon.discountValue) / 100, coupon.maxDiscount);
    } else {
      discountAmount = Math.min(coupon.discountValue, coupon.maxDiscount ?? coupon.discountValue);
    }
    discountAmount = parseFloat(discountAmount.toFixed(2));

    const rawTotal = subtotal - discountAmount;
    const totalAmount = Math.round(rawTotal);

    res.json({
      message: 'Coupon applied successfully',
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscount: coupon.maxDiscount,
      },
      subtotal,
      discountAmount,
      totalAmount,
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({error: 'Internal server error'});
  }
};
const verifyPayment = async (req, res) => {
  try {
    const {razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId} = req.body;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature',
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    order.paymentDate = new Date();

    await order.save();

    if (order.paymentStatus === 'paid') {
      return res.json({
        success: true,
        status: 'success',
        message: 'Payment verified successfully',
        order: await Order.findById(order._id)
          .populate('items.productId', 'name images')
          .populate('deliveryAddress'),
      });
    }

    res.status(400).json({
      success: false,
      error: 'Payment status not paid',
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

module.exports = {
  createOrder,
  applyCoupon,
  verifyPayment,
};
