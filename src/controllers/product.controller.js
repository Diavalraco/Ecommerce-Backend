const Products = require('../models/products.model');
const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');
const path = require('path');
const {uploadImage, deleteImage, extractKey} = require('../config/r2');
// const {cloudinary, deleteImage, extractPublicId} = require('../config/cloudinary');
const fs = require('fs');

const getAllProducts = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    status,
    sort = 'new_to_old',
    category,
    published,
    popular,
    featured,
  } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (search.trim()) {
    const s = search.trim();
    query.$or = [{name: {$regex: s, $options: 'i'}}, {description: {$regex: s, $options: 'i'}}];
  }
  if (status && status !== 'all') query.status = status;
  if (category) query.categories = category;
  if (published === 'true') query.isPublished = true;
  if (popular === 'true') query.isPopular = true;
  if (featured === 'true') query.isFeatured = true;

  const sortOption = sort === 'old_to_new' ? {createdAt: 1} : {createdAt: -1};

  const [products, totalCount] = await Promise.all([
    Products.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum),
    Products.countDocuments(query),
  ]);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: products,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

const getProductById = catchAsync(async (req, res) => {
  const product = await Products.findById(req.params.id);
  if (!product) {
    return res.status(httpStatus.NOT_FOUND).json({status: false, message: 'Product not found'});
  }
  res.status(httpStatus.OK).json({status: true, data: product});
});

function parseIds(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === 'string' && field.trim()) {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return field.split(',').map(id => id.trim());
  }
  return [];
}

const createProduct = catchAsync(async (req, res) => {
  const {
    name,
    description = null,
    categories = [],
    quantityDetails = [],
    metadata = [],
    order = 100,
    isPublished = false,
    isPopular = false,
    isFeatured = false,
    status = 'active',
  } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: '`name` is required and must be a non-empty string',
    });
  }

  const categoryIds = parseIds(categories);
  const quantityArray = parseIds(quantityDetails);
  const metadataArray = parseIds(metadata);

  let imageUrls = [];
  const newImageKeys = [];
  if (req.files?.images) {
    for (let i = 0; i < req.files.images.length; i++) {
      const file = req.files.images[i];
      const ext = path.extname(file.originalname);
      const key = `products/images/${Date.now()}_${i}${ext}`;
      const {url} = await uploadImage({
        buffer: file.buffer,
        key,
        contentType: file.mimetype,
      });
      imageUrls.push(url);
      newImageKeys.push(key);
    }
  }

  let videoUrl = null;
  let newVideoKey = null;
  if (req.files?.productVideo?.[0]) {
    const file = req.files.productVideo[0];
    const ext = path.extname(file.originalname);
    const key = `products/videos/${Date.now()}${ext}`;
    const {url} = await uploadImage({
      buffer: file.buffer,
      key,
      contentType: file.mimetype,
    });
    videoUrl = url;
    newVideoKey = key;
  }

  try {
    const payload = {
      name: name.trim(),
      description,
      categories: categoryIds,
      images: imageUrls,
      productVideo: videoUrl,
      quantityDetails: quantityArray,
      metadata: metadataArray,
      order: parseInt(order, 10),
      isPublished: isPublished === 'true' || isPublished === true,
      isPopular: isPopular === 'true' || isPopular === true,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      status,
    };

    const created = await Products.create(payload);
    return res.status(httpStatus.CREATED).json({
      status: true,
      message: 'Product created successfully',
      data: created,
    });
  } catch (err) {
    for (const key of newImageKeys) {
      await deleteImage(key);
    }
    if (newVideoKey) {
      await deleteImage(newVideoKey);
    }
    throw err;
  }
});

const updateProduct = catchAsync(async (req, res) => {
  const product = await Products.findById(req.params.id);
  if (!product) {
    return res.status(httpStatus.NOT_FOUND).json({
      status: false,
      message: 'Product not found',
    });
  }

  const {
    name,
    description,
    categories,
    quantityDetails,
    metadata,
    order,
    isPublished,
    isPopular,
    isFeatured,
    status,
  } = req.body;

  if (name !== undefined) product.name = name.trim();
  if (description !== undefined) product.description = description;
  if (order !== undefined) product.order = parseInt(order, 10);
  if (isPublished !== undefined) product.isPublished = isPublished === 'true';
  if (isPopular !== undefined) product.isPopular = isPopular === 'true';
  if (isFeatured !== undefined) product.isFeatured = isFeatured === 'true';
  if (status !== undefined) product.status = status;

  const catIds = parseIds(categories);
  if (categories !== undefined) product.categories = catIds;

  const qtyArr = parseIds(quantityDetails);
  if (quantityDetails !== undefined) product.quantityDetails = qtyArr;

  const metaArr = parseIds(metadata);
  if (metadata !== undefined) product.metadata = metaArr;

  let newImageKeys = [];
  if (req.files?.images) {
    for (const url of product.images) {
      const key = extractKey(url);
      if (key) await deleteImage(key);
    }
    const urls = [];
    for (let i = 0; i < req.files.images.length; i++) {
      const file = req.files.images[i];
      const ext = path.extname(file.originalname);
      const key = `products/images/${Date.now()}_${i}${ext}`;
      const {url} = await uploadImage({
        buffer: file.buffer,
        key,
        contentType: file.mimetype,
      });
      urls.push(url);
      newImageKeys.push(key);
    }
    product.images = urls;
  }

  let newVideoKey = null;
  if (req.files?.productVideo?.[0]) {
    if (product.productVideo) {
      const oldKey = extractKey(product.productVideo);
      if (oldKey) await deleteImage(oldKey);
    }
    const file = req.files.productVideo[0];
    const ext = path.extname(file.originalname);
    const key = `products/videos/${Date.now()}${ext}`;
    const {url} = await uploadImage({
      buffer: file.buffer,
      key,
      contentType: file.mimetype,
    });
    product.productVideo = url;
    newVideoKey = key;
  }

  try {
    await product.save();
    return res.status(httpStatus.OK).json({
      status: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (err) {
    for (const key of newImageKeys) {
      await deleteImage(key);
    }
    if (newVideoKey) {
      await deleteImage(newVideoKey);
    }
    throw err;
  }
});

const deleteProduct = catchAsync(async (req, res) => {
  const product = await Products.findById(req.params.id);
  if (!product) {
    return res.status(httpStatus.NOT_FOUND).json({
      status: false,
      message: 'Product not found',
    });
  }

  for (const url of product.images) {
    const key = extractKey(url);
    if (key) await deleteImage(key);
  }
  if (product.productVideo) {
    const key = extractKey(product.productVideo);
    if (key) await deleteImage(key);
  }

  await product.deleteOne();
  return res.status(httpStatus.OK).json({
    status: true,
    message: 'Product deleted successfully',
    data: product,
  });
});

const toggleProductStatus = catchAsync(async (req, res) => {
  const product = await Products.findById(req.params.id);
  if (!product) {
    return res.status(httpStatus.NOT_FOUND).json({status: false, message: 'Product not found'});
  }
  product.status = product.status === 'active' ? 'inactive' : 'active';
  await product.save();
  res.status(httpStatus.OK).json({
    status: true,
    message: `Product is now ${product.status}`,
    data: product,
  });
});

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
};
