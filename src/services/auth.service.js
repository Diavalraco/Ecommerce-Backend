const {User} = require('../models');

async function createUser(userObj) {
  return User.create(userObj);
}
async function getUserByFirebaseUId(uid) {
  return User.findOne({firebaseUid: uid});
}

module.exports = {
  createUser,
  getUserByFirebaseUId,
};
