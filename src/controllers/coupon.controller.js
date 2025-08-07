const Coupon = require('../models/coupon.model');
const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');

const getAllCoupons = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', status, sort = 'new_to_old'} = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (search.trim()) {
    const s = search.trim();
    query.$or = [{code: {$regex: s, $options: 'i'}}, {discountType: {$regex: s, $options: 'i'}}];
  }

  if (status && status !== 'all') {
    query.status = status;
  }

  const sortOption = sort === 'old_to_new' ? {createdAt: 1} : {createdAt: -1};

  const [coupons, totalCount] = await Promise.all([
    Coupon.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum),

    Coupon.countDocuments(query),
  ]);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: coupons,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

const getCouponById = catchAsync(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    return res.status(httpStatus.NOT_FOUND).json({status: false, message: 'Coupon not found'});
  }
  res.status(httpStatus.OK).json({status: true, data: coupon});
});

const createCoupon = catchAsync(async (req, res) => {
  const {code, discountValue, discountType, maxDiscount, minOrderValue} = req.body;

  const payload = {
    code,
    discountValue,
    discountType,
    maxDiscount,
    minOrderValue,
  };

  const created = await Coupon.create(payload);
  res.status(httpStatus.CREATED).json({
    status: true,
    message: 'Coupon created successfully',
    data: created,
  });
});

const updateCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    return res.status(httpStatus.NOT_FOUND).json({status: false, message: 'Coupon not found'});
  }

  const fields = ['code', 'discountValue', 'discountType', 'maxDiscount', 'minOrderValue', 'usageCount', 'status'];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      coupon[f] = req.body[f];
    }
  });

  await coupon.save();
  res.status(httpStatus.OK).json({
    status: true,
    message: 'Coupon updated successfully',
    data: coupon,
  });
});

const deleteCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    return res.status(httpStatus.NOT_FOUND).json({status: false, message: 'Coupon not found'});
  }
  await coupon.deleteOne();
  res.status(httpStatus.OK).json({
    status: true,
    message: 'Coupon deleted successfully',
    data: coupon,
  });
});


const getPublicCoupons = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', sort = 'new_to_old', discountType} = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {status: 'active'};

  if (search.trim()) {
    const s = search.trim();
    query.$or = [{code: {$regex: s, $options: 'i'}}, {discountType: {$regex: s, $options: 'i'}}];
  }

  if (discountType) {
    query.discountType = discountType;
  }

  const sortOption = sort === 'old_to_new' ? {createdAt: 1} : {createdAt: -1};

  const [coupons, totalCount] = await Promise.all([
    Coupon.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum),
    Coupon.countDocuments(query),
  ]);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: coupons,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

module.exports = {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getPublicCoupons,
};
