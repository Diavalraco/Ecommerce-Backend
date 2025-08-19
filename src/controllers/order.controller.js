const Order = require('../models/order.model');
const Products = require('../models/products.model');
const Coupon = require('../models/coupon.model');
const Address = require('../models/address.model');
const Rating = require('../models/review.model')
const catchAsync = require('../utils/catchAsync');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
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

const escapeRegex = str => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
function getSelectedPackageForItem(item) {
  const product = item.productId || {};
  const qDetails = Array.isArray(product.quantityDetails) ? product.quantityDetails : [];

  // console.log('Product ID:', product._id);
  // console.log('Order indices - quantityIndex:', item.quantityIndex, 'packageIndex:', item.packageIndex);
  // console.log('Order data - quantity:', item.quantity, 'price:', item.price, 'totalPrice:', item.totalPrice);
  // console.log('Product quantityDetails length:', qDetails.length);

  if (qDetails.length > 0) {
    // console.log('Full quantityDetails structure:');
    qDetails.forEach((qd, idx) => {
      // console.log(`  [${idx}] quantity: "${qd.quantity}", packages: ${qd.packages?.length || 0}`);
      if (qd.packages) {
        qd.packages.forEach((pkg, pidx) => {
          // console.log(`    [${pidx}] title: "${pkg.title}", basePrice: ${pkg.basePrice}, sellPrice: ${pkg.sellPrice}`);
        });
      }
    });
  }

  let qIdx = Number.isFinite(Number(item.quantityIndex)) ? parseInt(item.quantityIndex, 10) : null;
  let pIdx = Number.isFinite(Number(item.packageIndex)) ? parseInt(item.packageIndex, 10) : null;

  // console.log('Parsed indices - qIdx:', qIdx, 'pIdx:', pIdx);

  if (qIdx !== null && qIdx >= 0 && qIdx < qDetails.length) {
    const quantityEntry = qDetails[qIdx];
    const packages = Array.isArray(quantityEntry.packages) ? quantityEntry.packages : [];

    console.log(`Found quantityEntry at index ${qIdx}:`, {
      quantity: quantityEntry.quantity,
      packagesLength: packages.length,
    });

    if (pIdx !== null && pIdx >= 0 && pIdx < packages.length) {
      const selectedPackage = packages[pIdx];
      // console.log(` EXACT MATCH found at [${qIdx}][${pIdx}]:`, selectedPackage);
      return {
        quantity: quantityEntry.quantity ?? null,
        package: selectedPackage,
        quantityIndex: qIdx,
        packageIndex: pIdx,
        unitPrice: item.price,
        totalPrice: item.totalPrice,
        orderedQuantity: item.quantity,
        matchReason: 'index_match',
      };
    }

    if (packages.length > 0) {
      const selectedPackage = packages[0];
      // console.log(` Using first package at [${qIdx}][0] (invalid packageIndex ${pIdx}):`, selectedPackage);
      return {
        quantity: quantityEntry.quantity ?? null,
        package: selectedPackage,
        quantityIndex: qIdx,
        packageIndex: 0,
        unitPrice: item.price,
        totalPrice: item.totalPrice,
        orderedQuantity: item.quantity,
        matchReason: 'index_clamped_to_package',
      };
    }
  }

  const orderedQty = Number(item.quantity) || 0;
  const unitFromOrder = orderedQty > 0 ? Number(item.totalPrice) / orderedQty : Number(item.price || 0);

  // console.log('Trying price match with unitFromOrder:', unitFromOrder);
  for (let qi = 0; qi < qDetails.length; qi++) {
    const packages = Array.isArray(qDetails[qi].packages) ? qDetails[qi].packages : [];
    for (let pi = 0; pi < packages.length; pi++) {
      const pkg = packages[pi];
      const sell = Number(pkg.sellPrice ?? pkg.basePrice ?? NaN);
      if (!Number.isNaN(sell) && Math.abs(Number(unitFromOrder) - sell) < 0.01) {
        // console.log(` PRICE MATCH found at [${qi}][${pi}]:`, pkg);
        return {
          quantity: qDetails[qi].quantity ?? null,
          package: pkg,
          quantityIndex: qi,
          packageIndex: pi,
          unitPrice: unitFromOrder,
          totalPrice: item.totalPrice,
          orderedQuantity: item.quantity,
          matchReason: 'matched_by_unit_price',
        };
      }
    }
  }

  if (qDetails.length > 0) {
    const packages = Array.isArray(qDetails[0].packages) ? qDetails[0].packages : [];
    if (packages.length > 0) {
      // console.log('Using fallback - first package of first quantity:', packages[0]);
      return {
        quantity: qDetails[0].quantity ?? null,
        package: packages[0],
        quantityIndex: 0,
        packageIndex: 0,
        unitPrice: item.price,
        totalPrice: item.totalPrice,
        orderedQuantity: item.quantity,
        matchReason: 'fallback_first_package',
      };
    }
  }

  // console.log(' No product data available - using constructed fallback');
  const basePrice = item.price || item.totalPrice || 0;
  const sellPrice = item.price || item.totalPrice || 0;

  return {
    quantity: String(item.quantity || '1'),
    package: {
      title: `Pack of ${item.quantity || 1}`,
      basePrice: basePrice,
      sellPrice: sellPrice,
      discountType: basePrice > sellPrice ? 'flat' : null,
      discountAmount: basePrice > sellPrice ? basePrice - sellPrice : null,
    },
    quantityIndex: null,
    packageIndex: null,
    unitPrice: item.price,
    totalPrice: item.totalPrice,
    orderedQuantity: item.quantity,
    matchReason: 'constructed_from_order_data',
  };
}

const getAllOrders = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', status, paymentStatus, sort = 'new_to_old', trackingId} = req.query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (status && status !== 'all') query.status = status;
  if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;
  if (trackingId && trackingId.trim()) {
    query.trackingId = trackingId.trim();
  }

  if (search && search.trim()) {
    const s = search.trim();
    const escaped = escapeRegex(s);
    const or = [];

    if (mongoose.Types.ObjectId.isValid(s)) {
      or.push({_id: mongoose.Types.ObjectId(s)});
    }

    or.push({
      $expr: {
        $regexMatch: {
          input: {$toString: '$_id'},
          regex: escaped,
          options: 'i',
        },
      },
    });

    or.push({razorpayOrderId: {$regex: escaped, $options: 'i'}});
    or.push({razorpayPaymentId: {$regex: escaped, $options: 'i'}});
    or.push({couponCode: {$regex: escaped, $options: 'i'}});
    or.push({trackingId: {$regex: escaped, $options: 'i'}});
    if (!isNaN(Number(s))) or.push({totalAmount: Number(s)});

    query.$or = or;
  }

  const sortOption = sort === 'old_to_new' ? {createdAt: 1} : {createdAt: -1};

  // console.log('getAllOrders query =>', JSON.stringify(query));

  const [ordersRaw, totalCount] = await Promise.all([
    Order.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate({path: 'userId', select: 'fullName name email phoneNumber phone _id'})
      .populate({
        path: 'items.productId',
        select: 'name images quantityDetails',
      })
      .populate('deliveryAddress')
      .lean(),
    Order.countDocuments(query),
  ]);

  const allProductIds = new Set();
  ordersRaw.forEach(order => {
    order.items.forEach(item => {
      if (item.productId && item.productId._id) {
        allProductIds.add(item.productId._id.toString());
      }
    });
  });

  // console.log('All product IDs in orders:', Array.from(allProductIds));

  let productDataMap = {};
  if (allProductIds.size > 0) {
    const objectIds = Array.from(allProductIds).map(id => new mongoose.Types.ObjectId(id));

    console.log(
      'Fetching quantityDetails for all products:',
      objectIds.map(id => id.toString())
    );

    const products = await mongoose
      .model('Products')
      .find({_id: {$in: objectIds}}, 'quantityDetails')
      .lean();

    console.log(
      'Fetched products:',
      products.map(p => ({
        id: p._id.toString(),
        hasQD: !!p.quantityDetails,
        qdLength: p.quantityDetails?.length || 0,
      }))
    );

    products.forEach(product => {
      productDataMap[product._id.toString()] = product.quantityDetails || [];
    });

    console.log('Product data map created for', Object.keys(productDataMap).length, 'products');
  }

  const orders = ordersRaw.map(order => {
    order.items = order.items.map(item => {
      if (item.productId && item.productId._id) {
        const productId = item.productId._id.toString();
        const quantityDetails = productDataMap[productId];

        if (quantityDetails && quantityDetails.length > 0) {
          console.log(`Using fetched quantityDetails for product ${productId} (${quantityDetails.length} entries)`);
          item.productId.quantityDetails = quantityDetails;
        } else {
          console.log(`No quantityDetails found for product ${productId}`);
          item.productId.quantityDetails = [];
        }
      }

      console.log('Processing item:', {
        orderId: order._id,
        productId: item.productId?._id,
        quantityIndex: item.quantityIndex,
        packageIndex: item.packageIndex,
        hasQuantityDetails: !!item.productId?.quantityDetails,
        quantityDetailsLength: item.productId?.quantityDetails?.length || 0,
      });

      const selected = getSelectedPackageForItem(item);

      console.log('Selected result:', {
        orderId: order._id,
        matchReason: selected?.matchReason,
        hasPackage: !!selected?.package,
        selectedQuantity: selected?.quantity,
      });

      if (item.productId && item.productId.quantityDetails) {
        delete item.productId.quantityDetails;
      }

      return {
        ...item,
        selectedPackage: selected ? selected.package : null,
        selectedQuantity: selected ? selected.quantity : null,
        selectedUnitPrice: selected ? selected.unitPrice : item.price,
        selectedTotalPrice: selected ? selected.totalPrice : item.totalPrice,
      };
    });
    return order;
  });

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: orders,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
    message: 'Orders fetched successfully',
  });
});

// const getOrdersByUser = catchAsync(async (req, res) => {
//   const userId = req.user.id;

//   const {page = 1, limit = 10, status, paymentStatus, sort = 'new_to_old'} = req.query;

//   const pageNum = Math.max(parseInt(page, 10) || 1, 1);
//   const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
//   const skip = (pageNum - 1) * limitNum;

//   const query = {userId};

//   if (status && status !== 'all') query.status = status;
//   if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;

//   const sortOption = sort === 'old_to_new' ? {createdAt: 1} : {createdAt: -1};

//   const [ordersRaw, totalCount] = await Promise.all([
//     Order.find(query)
//       .sort(sortOption)
//       .skip(skip)
//       .limit(limitNum)
//       .populate({
//         path: 'items.productId',
//         select: 'name images quantityDetails',
//       })
//       .populate('deliveryAddress')
//       .lean(),
//     Order.countDocuments(query),
//   ]);

//   const allProductIds = new Set();
//   ordersRaw.forEach(order => {
//     order.items.forEach(item => {
//       if (item.productId && item.productId._id) {
//         allProductIds.add(item.productId._id.toString());
//       }
//     });
//   });

//   console.log('Product IDs in user orders:', Array.from(allProductIds));

//   let productDataMap = {};
//   if (allProductIds.size > 0) {
//     const objectIds = Array.from(allProductIds).map(id => new mongoose.Types.ObjectId(id));

//     console.log(
//       'Fetching quantityDetails for user order products:',
//       objectIds.map(id => id.toString())
//     );

//     const products = await mongoose
//       .model('Products')
//       .find({_id: {$in: objectIds}}, 'quantityDetails')
//       .lean();

//     console.log(
//       'Fetched products for user orders:',
//       products.map(p => ({
//         id: p._id.toString(),
//         hasQD: !!p.quantityDetails,
//         qdLength: p.quantityDetails?.length || 0,
//       }))
//     );

//     products.forEach(product => {
//       productDataMap[product._id.toString()] = product.quantityDetails || [];
//     });

//     console.log('Product data map created for user orders with', Object.keys(productDataMap).length, 'products');
//   }

//   const orders = ordersRaw.map(order => {
//     order.items = order.items.map(item => {
//       if (item.productId && item.productId._id) {
//         const productId = item.productId._id.toString();
//         const quantityDetails = productDataMap[productId];

//         if (quantityDetails && quantityDetails.length > 0) {
//           console.log(
//             ` Using fetched quantityDetails for user order product ${productId} (${quantityDetails.length} entries)`
//           );
//           item.productId.quantityDetails = quantityDetails;
//         } else {
//           console.log(` No quantityDetails found for user order product ${productId}`);
//           item.productId.quantityDetails = [];
//         }
//       }

//       console.log('Processing user order item:', {
//         orderId: order._id,
//         userId: userId,
//         productId: item.productId?._id,
//         quantityIndex: item.quantityIndex,
//         packageIndex: item.packageIndex,
//         hasQuantityDetails: !!item.productId?.quantityDetails,
//         quantityDetailsLength: item.productId?.quantityDetails?.length || 0,
//       });

//       const selected = getSelectedPackageForItem(item);

//       console.log('Selected result for user order item:', {
//         orderId: order._id,
//         userId: userId,
//         matchReason: selected?.matchReason,
//         hasPackage: !!selected?.package,
//         selectedQuantity: selected?.quantity,
//       });

//       if (item.productId && item.productId.quantityDetails) {
//         delete item.productId.quantityDetails;
//       }

//       return {
//         ...item,
//         selectedPackage: selected ? selected.package : null,
//         selectedQuantity: selected ? selected.quantity : null,
//         selectedUnitPrice: selected ? selected.unitPrice : item.price,
//         selectedTotalPrice: selected ? selected.totalPrice : item.totalPrice,
//       };
//     });
//     return order;
//   });

//   res.status(httpStatus.OK).json({
//     status: true,
//     data: {
//       page: pageNum,
//       limit: limitNum,
//       results: orders,
//       totalPages: Math.ceil(totalCount / limitNum),
//       totalResults: totalCount,
//     },
//     message: `Orders for user ${userId} fetched successfully`,
//   });
// });

const getOrdersByUser = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const {page = 1, limit = 10, status, paymentStatus, sort = 'new_to_old'} = req.query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
  const skip = (pageNum - 1) * limitNum;

  const query = {userId};

  if (status && status !== 'all') query.status = status;
  if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;

  const sortOption = sort === 'old_to_new' ? {createdAt: 1} : {createdAt: -1};

  const [ordersRaw, totalCount] = await Promise.all([
    Order.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: 'items.productId',
        select: 'name images quantityDetails',
      })
      .populate('deliveryAddress')
      .lean(),
    Order.countDocuments(query),
  ]);

  const allProductIds = new Set();
  const orderIds = [];

  ordersRaw.forEach(order => {
    orderIds.push(order._id.toString());
    order.items.forEach(item => {
      if (item.productId && item.productId._id) {
        allProductIds.add(item.productId._id.toString());
      }
    });
  });

  console.log('Product IDs in user orders:', Array.from(allProductIds));

  let productDataMap = {};
  if (allProductIds.size > 0) {
    const objectIds = Array.from(allProductIds).map(id => new mongoose.Types.ObjectId(id));

    console.log(
      'Fetching quantityDetails for user order products:',
      objectIds.map(id => id.toString())
    );

    const products = await mongoose
      .model('Products')
      .find({_id: {$in: objectIds}}, 'quantityDetails')
      .lean();

    console.log(
      'Fetched products for user orders:',
      products.map(p => ({
        id: p._id.toString(),
        hasQD: !!p.quantityDetails,
        qdLength: p.quantityDetails?.length || 0,
      }))
    );

    products.forEach(product => {
      productDataMap[product._id.toString()] = product.quantityDetails || [];
    });

    console.log('Product data map created for user orders with', Object.keys(productDataMap).length, 'products');
  }
  let ratingsMap = {};
  if (orderIds.length > 0) {
    try {
      const ratings = await Rating.find({
        orderId: {$in: orderIds},
        userId: userId,
      }).lean();

      console.log(`Fetched ${ratings.length} ratings for ${orderIds.length} orders`);

      ratings.forEach(rating => {
        ratingsMap[rating.orderId.toString()] = rating;
      });
    } catch (error) {
      console.log('Rating model not found or error fetching ratings:', error.message);
    }
  }

  const orders = ordersRaw.map(order => {
    const orderRating = ratingsMap[order._id.toString()] || null;

    order.items = order.items.map(item => {
      if (item.productId && item.productId._id) {
        const productId = item.productId._id.toString();
        const quantityDetails = productDataMap[productId];

        if (quantityDetails && quantityDetails.length > 0) {
          console.log(
            ` Using fetched quantityDetails for user order product ${productId} (${quantityDetails.length} entries)`
          );
          item.productId.quantityDetails = quantityDetails;
        } else {
          console.log(` No quantityDetails found for user order product ${productId}`);
          item.productId.quantityDetails = [];
        }
      }

      console.log('Processing user order item:', {
        orderId: order._id,
        userId: userId,
        productId: item.productId?._id,
        quantityIndex: item.quantityIndex,
        packageIndex: item.packageIndex,
        hasQuantityDetails: !!item.productId?.quantityDetails,
        quantityDetailsLength: item.productId?.quantityDetails?.length || 0,
      });

      const selected = getSelectedPackageForItem(item);

      console.log('Selected result for user order item:', {
        orderId: order._id,
        userId: userId,
        matchReason: selected?.matchReason,
        hasPackage: !!selected?.package,
        selectedQuantity: selected?.quantity,
      });

      if (item.productId && item.productId.quantityDetails) {
        delete item.productId.quantityDetails;
      }

      return {
        ...item,
        selectedPackage: selected ? selected.package : null,
        selectedQuantity: selected ? selected.quantity : null,
        selectedUnitPrice: selected ? selected.unitPrice : item.price,
        selectedTotalPrice: selected ? selected.totalPrice : item.totalPrice,
      };
    });
    return {
      ...order,
      rating: orderRating
        ? {
            _id: orderRating._id,
            rating: orderRating.rating,
            review: orderRating.message,
            createdAt: orderRating.createdAt,
            updatedAt: orderRating.updatedAt,
          }
        : null,
      hasRating: !!orderRating,
    };
  });

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: orders,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
    message: `Orders for user ${userId} fetched successfully`,
  });
});

// const getOrderById = catchAsync(async (req, res) => {
//   const {id} = req.params;

//   if (!mongoose.Types.ObjectId.isValid(id)) {
//     return res.status(httpStatus.BAD_REQUEST).json({status: false, data: null, message: 'Invalid order id'});
//   }

//   const orderRaw = await Order.findById(id)
//     .populate('items.productId', 'name images quantityDetails')
//     .populate('deliveryAddress')
//     .populate({path: 'userId', select: 'fullName name email phoneNumber phone _id'})
//     .lean();

//   if (!orderRaw) {
//     return res.status(httpStatus.NOT_FOUND).json({status: false, data: null, message: 'Order not found'});
//   }

//   const allProductIds = new Set();
//   orderRaw.items.forEach(item => {
//     if (item.productId && item.productId._id) {
//       allProductIds.add(item.productId._id.toString());
//     }
//   });

//   console.log('Product IDs in order:', Array.from(allProductIds));

//   let productDataMap = {};
//   if (allProductIds.size > 0) {
//     const objectIds = Array.from(allProductIds).map(id => new mongoose.Types.ObjectId(id));

//     console.log(
//       'Fetching quantityDetails for order products:',
//       objectIds.map(id => id.toString())
//     );

//     const products = await mongoose
//       .model('Products')
//       .find({_id: {$in: objectIds}}, 'quantityDetails')
//       .lean();

//     console.log(
//       'Fetched products for order:',
//       products.map(p => ({
//         id: p._id.toString(),
//         hasQD: !!p.quantityDetails,
//         qdLength: p.quantityDetails?.length || 0,
//       }))
//     );

//     products.forEach(product => {
//       productDataMap[product._id.toString()] = product.quantityDetails || [];
//     });

//     console.log('Product data map created for order with', Object.keys(productDataMap).length, 'products');
//   }

//   const processedOrder = {
//     ...orderRaw,
//     items: orderRaw.items.map(item => {
//       if (item.productId && item.productId._id) {
//         const productId = item.productId._id.toString();
//         const quantityDetails = productDataMap[productId];

//         if (quantityDetails && quantityDetails.length > 0) {
//           console.log(` Using fetched quantityDetails for product ${productId} (${quantityDetails.length} entries)`);
//           item.productId.quantityDetails = quantityDetails;
//         } else {
//           console.log(`No quantityDetails found for product ${productId}`);
//           item.productId.quantityDetails = [];
//         }
//       }

//       console.log('Processing order item:', {
//         orderId: orderRaw._id,
//         productId: item.productId?._id,
//         quantityIndex: item.quantityIndex,
//         packageIndex: item.packageIndex,
//         hasQuantityDetails: !!item.productId?.quantityDetails,
//         quantityDetailsLength: item.productId?.quantityDetails?.length || 0,
//       });

//       const selected = getSelectedPackageForItem(item);

//       console.log('Selected result for order item:', {
//         orderId: orderRaw._id,
//         matchReason: selected?.matchReason,
//         hasPackage: !!selected?.package,
//         selectedQuantity: selected?.quantity,
//       });

//       if (item.productId && item.productId.quantityDetails) {
//         delete item.productId.quantityDetails;
//       }

//       return {
//         ...item,
//         selectedPackage: selected ? selected.package : null,
//         selectedQuantity: selected ? selected.quantity : null,
//         selectedUnitPrice: selected ? selected.unitPrice : item.price,
//         selectedTotalPrice: selected ? selected.totalPrice : item.totalPrice,
//       };
//     }),
//   };

//   res.status(httpStatus.OK).json({
//     status: true,
//     data: processedOrder,
//     message: 'Order fetched successfully',
//   });
// });


const getOrderById = catchAsync(async (req, res) => {
  const {id} = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(httpStatus.BAD_REQUEST).json({status: false, data: null, message: 'Invalid order id'});
  }

  const orderRaw = await Order.findById(id)
    .populate('items.productId', 'name images quantityDetails')
    .populate('deliveryAddress')
    .populate({path: 'userId', select: 'fullName name email phoneNumber phone _id'})
    .lean();

  if (!orderRaw) {
    return res.status(httpStatus.NOT_FOUND).json({status: false, data: null, message: 'Order not found'});
  }

  const allProductIds = new Set();
  orderRaw.items.forEach(item => {
    if (item.productId && item.productId._id) {
      allProductIds.add(item.productId._id.toString());
    }
  });

  console.log('Product IDs in order:', Array.from(allProductIds));

  let productDataMap = {};
  if (allProductIds.size > 0) {
    const objectIds = Array.from(allProductIds).map(id => new mongoose.Types.ObjectId(id));

    console.log(
      'Fetching quantityDetails for order products:',
      objectIds.map(id => id.toString())
    );

    const products = await mongoose
      .model('Products')
      .find({_id: {$in: objectIds}}, 'quantityDetails')
      .lean();

    console.log(
      'Fetched products for order:',
      products.map(p => ({
        id: p._id.toString(),
        hasQD: !!p.quantityDetails,
        qdLength: p.quantityDetails?.length || 0,
      }))
    );

    products.forEach(product => {
      productDataMap[product._id.toString()] = product.quantityDetails || [];
    });

    console.log('Product data map created for order with', Object.keys(productDataMap).length, 'products');
  }

  let orderRating = null;
  try {
    const rating = await Rating.findOne({
      orderId: id,
      userId: orderRaw.userId._id || orderRaw.userId
    }).lean();

    if (rating) {
      console.log(`Found rating for order ${id}:`, {
        rating: rating.rating,
        hasReview: !!rating.review
      });
      orderRating = rating;
    } else {
      console.log(`No rating found for order ${id}`);
    }
  } catch (error) {
    console.log('Rating model not found or error fetching rating:', error.message);
  }

  const processedOrder = {
    ...orderRaw,
    items: orderRaw.items.map(item => {
      if (item.productId && item.productId._id) {
        const productId = item.productId._id.toString();
        const quantityDetails = productDataMap[productId];

        if (quantityDetails && quantityDetails.length > 0) {
          console.log(` Using fetched quantityDetails for product ${productId} (${quantityDetails.length} entries)`);
          item.productId.quantityDetails = quantityDetails;
        } else {
          console.log(`No quantityDetails found for product ${productId}`);
          item.productId.quantityDetails = [];
        }
      }

      console.log('Processing order item:', {
        orderId: orderRaw._id,
        productId: item.productId?._id,
        quantityIndex: item.quantityIndex,
        packageIndex: item.packageIndex,
        hasQuantityDetails: !!item.productId?.quantityDetails,
        quantityDetailsLength: item.productId?.quantityDetails?.length || 0,
      });

      const selected = getSelectedPackageForItem(item);

      console.log('Selected result for order item:', {
        orderId: orderRaw._id,
        matchReason: selected?.matchReason,
        hasPackage: !!selected?.package,
        selectedQuantity: selected?.quantity,
      });

      if (item.productId && item.productId.quantityDetails) {
        delete item.productId.quantityDetails;
      }

      return {
        ...item,
        selectedPackage: selected ? selected.package : null,
        selectedQuantity: selected ? selected.quantity : null,
        selectedUnitPrice: selected ? selected.unitPrice : item.price,
        selectedTotalPrice: selected ? selected.totalPrice : item.totalPrice,
      };
    }),
    rating: orderRating ? {
      _id: orderRating._id,
      rating: orderRating.rating,
      review: orderRating.message,
      createdAt: orderRating.createdAt,
      updatedAt: orderRating.updatedAt
    } : null,
    hasRating: !!orderRating
  };

  res.status(httpStatus.OK).json({
    status: true,
    data: processedOrder,
    message: 'Order fetched successfully',
  });
});

const updateOrder = catchAsync(async (req, res) => {
  const {orderId} = req.params;
  const updateData = req.body;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Invalid order ID',
    });
  }

  const allowedFields = ['status', 'paymentStatus', 'trackingId'];
  const filteredUpdateData = {};

  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredUpdateData[key] = updateData[key];
    }
  });

  if (filteredUpdateData.status) {
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(filteredUpdateData.status)) {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: false,
        message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`,
      });
    }
  }

  if (filteredUpdateData.paymentStatus) {
    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validPaymentStatuses.includes(filteredUpdateData.paymentStatus)) {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: false,
        message: `Invalid payment status. Valid statuses are: ${validPaymentStatuses.join(', ')}`,
      });
    }
  }
  if (filteredUpdateData.trackingId !== undefined) {
    const t = String(filteredUpdateData.trackingId).trim();
    if (t === '') {
      return res.status(httpStatus.BAD_REQUEST).json({status: false, message: 'trackingId cannot be empty'});
    }
    const ok = /^[A-Za-z0-9\-\_\.]{1,100}$/.test(t);
    if (!ok) {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: false,
        message: 'Invalid trackingId — only letters, numbers, -, _, . allowed (max 100 chars)',
      });
    }
    filteredUpdateData.trackingId = t;
  }

  if (Object.keys(filteredUpdateData).length === 0) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'No valid fields provided for update',
    });
  }

  filteredUpdateData.updatedAt = new Date();

  const updatedOrder = await Order.findByIdAndUpdate(orderId, filteredUpdateData, {
    new: true,
    runValidators: true,
  })
    .populate({path: 'userId', select: 'fullName email phoneNumber'})
    .populate('items.productId', 'name images')
    .populate('deliveryAddress');

  if (!updatedOrder) {
    return res.status(httpStatus.NOT_FOUND).json({
      status: false,
      message: 'Order not found',
    });
  }

  res.status(httpStatus.OK).json({
    status: true,
    data: updatedOrder,
    message: 'Order updated successfully',
  });
});

module.exports = {
  createOrder,
  applyCoupon,
  verifyPayment,
  getAllOrders,
  getOrdersByUser,
  getOrderById,
  updateOrder,
};
