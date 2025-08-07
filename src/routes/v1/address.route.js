const express = require('express');
const addressController = require('../../controllers/address.controller');
const firebaseAuth = require('../../middlewares/firebaseAuth');

const router = express.Router();

router.use(firebaseAuth('user'));

router.post('/', addressController.createAddress);

router.get('/', addressController.getAllAddresses);

router.get('/:addressId', addressController.getAddressById);

router.patch('/:addressId', addressController.updateAddress);
router.delete('/:addressId', addressController.deleteAddress);

router.patch('/:addressId/default', addressController.setDefaultAddress);

module.exports = router;