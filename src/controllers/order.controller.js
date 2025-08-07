const Order = require('../models/order.model');
const Products = require('../models/products.model');
const Coupon = require('../models/coupon.model');
const Address = require('../models/address.model');

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
      const coupon = await Coupon.findOne({code: couponCode.toUpperCase(), status: 'active'});
      if (!coupon) {
        return res.status(400).json({error: 'Invalid coupon code'});
      }

      if (subtotal < coupon.minOrderValue) {
        return res.status(400).json({
          error: `Minimum order value should be ₹${coupon.minOrderValue} to use this coupon`,
        });
      }

      if (coupon.discountType === 'percent') {
        discountAmount = Math.min((subtotal * coupon.discountValue) / 100, coupon.maxDiscount);
      } else {
        discountAmount = Math.min(coupon.discountValue, coupon.maxDiscount);
      }

      validCoupon = coupon;
    }

    const totalAmount = subtotal - discountAmount;

    const order = new Order({
      userId,
      items: orderItems,
      subtotal,
      couponCode: validCoupon ? validCoupon.code : null,
      discountAmount,
      totalAmount,
      deliveryAddress: deliveryAddressId,
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

    let discountAmount = 0;
    if (coupon.discountType === 'percent') {
      discountAmount = Math.min((subtotal * coupon.discountValue) / 100, coupon.maxDiscount);
    } else {
      discountAmount = Math.min(coupon.discountValue, coupon.maxDiscount);
    }

    const totalAmount = subtotal - discountAmount;

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

module.exports = {
  createOrder,
  applyCoupon,
};
