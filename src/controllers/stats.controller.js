const {User} = require('../models/user.model');
const Order = require('../models/order.model');
const Products = require('../models/products.model');
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');

const getAdminStats = catchAsync(async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({
      isDeleted: false,
    });

    const totalProducts = await Products.countDocuments({
      isDeleted: false,
      status: 'active',
    });

    const orderStats = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {$sum: '$totalAmount'},
          totalSales: {$sum: 1},
        },
      },
    ]);

    const totalRevenue = orderStats.length > 0 ? orderStats[0].totalRevenue : 0;
    const totalSales = orderStats.length > 0 ? orderStats[0].totalSales : 0;

    const stats = {
      totalRevenue: totalRevenue,
      totalSales: totalSales,
      totalUsers: totalUsers,
      totalProducts: totalProducts,
    };

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Admin statistics retrieved successfully',
      data: stats,
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error retrieving admin statistics',
      error: error.message,
    });
  }
});

const getRevenueStats = catchAsync(async (req, res) => {
  try {
    const {period = 'month'} = req.query;

    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case 'week':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        };
        break;
      case 'month':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          },
        };
        break;
      case 'year':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), 0, 1),
          },
        };
        break;
      default:
        dateFilter = {};
    }

    const revenueStats = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {$sum: '$totalAmount'},
          totalOrders: {$sum: 1},
          averageOrderValue: {$avg: '$totalAmount'},
        },
      },
    ]);

    const stats =
      revenueStats.length > 0
        ? revenueStats[0]
        : {
            totalRevenue: 0,
            totalOrders: 0,
            averageOrderValue: 0,
          };

    res.status(httpStatus.OK).json({
      success: true,
      message: `Revenue statistics for ${period} retrieved successfully`,
      data: {
        period,
        ...stats,
      },
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error retrieving revenue statistics',
      error: error.message,
    });
  }
});

const getOrderStatusStats = catchAsync(async (req, res) => {
  try {
    const statusStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: {$sum: 1},
        },
      },
      {
        $sort: {count: -1},
      },
    ]);

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Order status statistics retrieved successfully',
      data: statusStats,
    });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error retrieving order status statistics',
      error: error.message,
    });
  }
});

module.exports = {
  getAdminStats,
  getRevenueStats,
  getOrderStatusStats,
};
