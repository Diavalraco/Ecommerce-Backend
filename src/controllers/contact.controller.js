const Contact = require('../models/contact.model');
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');

const createContactQuery = catchAsync(async (req, res) => {
  const {fullname, email, phonenumber, message} = req.body;

  const contact = new Contact({
    fullname,
    email,
    phonenumber,
    message,
  });

  await contact.save();

  res.status(httpStatus.CREATED).json({
    success: true,
    message: 'Contact query submitted successfully',
    data: contact,
  });
});

const getAllContactQueries = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', sort = 'new'} = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {isDeleted: false};
  if (search.trim() !== '') {
    query.fullname = {$regex: search.trim(), $options: 'i'};
  }

  let sortOption = {};
  if (sort === 'old') {
    sortOption = {createdAt: 1};
  } else {
    sortOption = {createdAt: -1};
  }

  const contacts = await Contact.find(query)
    .sort(sortOption)
    .skip(skip)
    .limit(limitNum);

  const totalCount = await Contact.countDocuments(query);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: contacts,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

module.exports = {
  createContactQuery,
  getAllContactQueries,
};
