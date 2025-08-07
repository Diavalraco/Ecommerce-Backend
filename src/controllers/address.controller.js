const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const Address = require('../models/address.model');
const mongoose = require('mongoose');

const createAddress = catchAsync(async (req, res) => {
  const {address, zipcode, city, state, label, isDefault} = req.body;
  const userId = req.user._id;
  if (!address || !zipcode || !city || !state) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Address, zipcode, city, and state are required');
  }

  const newAddress = await Address.create({
    userId,
    address: address.trim(),
    zipcode: zipcode.trim(),
    city: city.trim(),
    state: state.trim(),
    label: label || 'Other',
    isDefault: isDefault || false,
  });

  res.status(httpStatus.CREATED).json({
    status: true,
    message: 'Address created successfully',
    data: newAddress,
  });
});

const getAllAddresses = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const {page = 1, limit = 10} = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const [addresses, totalCount] = await Promise.all([
    Address.find({userId})
      .sort({isDefault: -1, createdAt: -1})
      .skip(skip)
      .limit(limitNum),
    Address.countDocuments({userId}),
  ]);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: addresses,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

const getAddressById = catchAsync(async (req, res) => {
  const {addressId} = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid address ID');
  }

  const address = await Address.findOne({_id: addressId, userId});

  if (!address) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Address not found');
  }

  res.status(httpStatus.OK).json({
    status: true,
    data: address,
  });
});

const updateAddress = catchAsync(async (req, res) => {
  const {addressId} = req.params;
  const userId = req.user._id;
  const {address, zipcode, city, state, label, isDefault} = req.body;

  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid address ID');
  }

  const existingAddress = await Address.findOne({_id: addressId, userId});
  if (!existingAddress) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Address not found');
  }

  const updateData = {};
  if (address !== undefined) updateData.address = address.trim();
  if (zipcode !== undefined) updateData.zipcode = zipcode.trim();
  if (city !== undefined) updateData.city = city.trim();
  if (state !== undefined) updateData.state = state.trim();
  if (label !== undefined) updateData.label = label;
  if (isDefault !== undefined) updateData.isDefault = isDefault;

  const updatedAddress = await Address.findOneAndUpdate({_id: addressId, userId}, updateData, {
    new: true,
    runValidators: true,
  });

  res.status(httpStatus.OK).json({
    status: true,
    message: 'Address updated successfully',
    data: updatedAddress,
  });
});

const deleteAddress = catchAsync(async (req, res) => {
  const {addressId} = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid address ID');
  }

  const address = await Address.findOne({_id: addressId, userId});
  if (!address) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Address not found');
  }

  await Address.findOneAndDelete({_id: addressId, userId});

  let newDefaultAddress = null;
  if (address.isDefault) {
    const remainingAddresses = await Address.find({userId}).sort({createdAt: -1});
    if (remainingAddresses.length > 0) {
      newDefaultAddress = await Address.findByIdAndUpdate(remainingAddresses[0]._id, {isDefault: true}, {new: true});
    }
  }

  const data = {
    deletedAddress: {
      _id: address._id,
      address: address.address,
      zipcode: address.zipcode,
      city: address.city,
      state: address.state,
      label: address.label,
      isDefault: address.isDefault,
    },
  };

  res.status(httpStatus.OK).json({
    status: true,
    message: 'Address deleted successfully',
    data,
  });
});

const setDefaultAddress = catchAsync(async (req, res) => {
  const {addressId} = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid address ID');
  }

  const address = await Address.findOne({_id: addressId, userId});
  if (!address) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Address not found');
  }

  const updatedAddress = await Address.findOneAndUpdate({_id: addressId, userId}, {isDefault: true}, {new: true});

  res.status(httpStatus.OK).json({
    status: true,
    message: 'Default address updated successfully',
    data: updatedAddress,
  });
});

module.exports = {
  createAddress,
  getAllAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
