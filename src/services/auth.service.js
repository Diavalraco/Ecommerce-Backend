const {User} = require('../models');

async function createUser(userObj) {
  return User.create(userObj);
}
async function getUserByFirebaseUId(uid) {
  return User.findOne({firebaseUid: uid});
}

const updateUserById = async (id, updateBody) => {
  const user = await User.findByIdAndUpdate(id, updateBody, {new: true});
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};

module.exports = {
  createUser,
  getUserByFirebaseUId,
  updateUserById,
};
