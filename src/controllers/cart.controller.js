const Cart = require('../models/cart.model');
const upsertCartItem = async (req, res) => {
  const userId = req.user._id;
  const {productId, quantityIndex, packageIndex, quantity} = req.body;
  if (!productId || quantityIndex == null || packageIndex == null || quantity == null) {
    return res.status(400).json({status: false, message: 'All fields are required'});
  }

  const cart = await Cart.findOne({userId});
  if (!cart) {
    if (quantity === 0) {
      return res.json({status: true, data: null, message: 'Nothing to remove'});
    }
    const newCart = await Cart.create({
      userId,
      items: [{productId, quantityIndex, packageIndex, quantity}],
    });
    return res.json({status: true, data: newCart, message: 'Cart created'});
  }

  const idx = cart.items.findIndex(
    item =>
      item.productId.toString() === productId &&
      item.quantityIndex === quantityIndex &&
      item.packageIndex === packageIndex
  );

  if (quantity === 0) {
    if (idx > -1) {
      cart.items.splice(idx, 1);
      await cart.save();
    }
    return res.json({status: true, data: cart, message: 'Item removed'});
  }

  if (idx > -1) {
    cart.items[idx].quantity = quantity;
  } else {
    cart.items.push({productId, quantityIndex, packageIndex, quantity});
  }

  await cart.save();
  return res.json({status: true, data: cart, message: 'Cart updated'});
};

const getCart = async (req, res) => {
  const {userId} = req.query;
  if (!userId) return res.status(400).json({status: false, message: 'userId required'});

  const cart = await Cart.findOne({userId})
    .populate('items.productId', '-__v')
    .lean();
  if (!cart) return res.status(404).json({status: false, message: 'Cart not found'});

  return res.json({status: true, data: cart, message: 'Cart fetched'});
};

module.exports = {
  getCart,
  upsertCartItem,
};
