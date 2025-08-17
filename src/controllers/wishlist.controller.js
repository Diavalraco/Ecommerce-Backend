const Wishlist = require('../models/wishlist.model');

const toggleWishlistItem = async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({status: false, message: 'Product ID is required'});
  }

  const wishlist = await Wishlist.findOne({userId});
  
  if (!wishlist) {
    const newWishlist = await Wishlist.create({
      userId,
      items: [{productId}],
    });
    return res.json({status: true, data: newWishlist, message: 'Added to wishlist'});
  }

  const idx = wishlist.items.findIndex(
    item => item.productId.toString() === productId
  );

  if (idx > -1) {
    wishlist.items.splice(idx, 1);
    await wishlist.save();
    return res.json({status: true, data: wishlist, message: 'Removed from wishlist'});
  } else {
    wishlist.items.push({productId});
    await wishlist.save();
    return res.json({status: true, data: wishlist, message: 'Added to wishlist'});
  }
};

const getWishlist = async (req, res) => {
    const userId = req.user.id;
  if (!userId) return res.status(400).json({status: false, message: 'userId required'});

  const wishlist = await Wishlist.findOne({userId})
    .populate('items.productId', '-__v')
    .lean();
  
  if (!wishlist) return res.status(404).json({status: false, message: 'Wishlist not found'});

  return res.json({status: true, data: wishlist, message: 'Wishlist fetched'});
};

module.exports = {
  getWishlist,
  toggleWishlistItem,
};