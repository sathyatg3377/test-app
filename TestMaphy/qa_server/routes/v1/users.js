var express = require('express');
var router = express.Router();
var Sequelize = require("sequelize");
var sequelize = require('../../db/conn');
var bcrypt = require('bcryptjs')
var speakeasy = require('speakeasy');
var qrcode = require('qrcode');
var jwt = require('jsonwebtoken')
var otpGenerator = require('otp-generator')
const Op = Sequelize.Op;
const models = require('../../db/models/index');
var _ = require('lodash');
var util = require('../../utils/index');
const constants = require('../../shared/constants');
const user = models.user;
user.belongsTo(user, { foreignKey: 'manager_id', as: 'manager' });
const { errorHandler } = require('../../shared/error-handler');
const { IncomingWebhook } = require('@slack/webhook');

// Read a url from the environment variables
const url = process.env.SLACK_WEBHOOK_URL;

// Initialize
const webhook = new IncomingWebhook(url);

router.get('/', errorHandler(async function (req, res, next) {
  const location = models.location;
  const department = models.department;
  const company = models.company;
  const userGroups = models.userGroups;
  const group = models.group;
  const talentGroup = models.talentGroup;
  user.belongsTo(location, { foreignKey: 'location_id' });
  user.belongsTo(talentGroup, { foreignKey: 'talent_group_id' });
  user.belongsTo(department, { foreignKey: 'department_id' });
  user.belongsTo(company, { foreignKey: 'company_id' });
  user.hasMany(userGroups, { foreignKey: 'user_id' })
  userGroups.belongsTo(group, { foreignKey: 'group_id' })
  const queries = req.query;
  const isDeleteRequest = _.isNil(queries.deleted) || _.isEmpty(queries.deleted) ? false : queries
  const { search, sort, limit, offset, order } = util.queryRequest(queries);
  let where = [{
    email: {
      [Op.like]: '%' + search + '%'
    },
    deleted_at: isDeleteRequest ? {
      [Op.ne]: null
    } : { [Op.eq]: null }
  }, { firm_id: req.userInfo.firmId }]
  util.addCondition(queries.company_id, where, { company_id: queries.company_id })
  //util.addCondition(queries.category_id, where, {manufacturer_id: queries.category_id})
  util.addCondition(queries.department_id, where, { department_id: queries.department_id })
  util.addCondition(queries.location_id, where, { location_id: queries.location_id })

  let result = await user.findAndCountAll({
    attributes: [
      'id', 'location_id', 'first_name', 'avatar', 'last_name', 'username', 'permissions', 'employee_num', 'jobtitle', 'phone', 'website', 'address', 'city', 'state', 'country', 'zip', 'email', 'notes', 'activated', 'two_factor_enrolled', 'last_login', 'deleted_at', 'created_at', 'updated_at', 'talent_group_id', 'user_type',
      [Sequelize.literal('(SELECT COUNT(*) FROM `assets` WHERE `assigned_to` = user.`id` and `assets`.`deleted_at` is null)'), 'assetsCount'],
      [Sequelize.literal('(SELECT COUNT(*) FROM `license_seats` WHERE `license_seats`.`assigned_to` = user.`id` and `license_seats`.`deleted_at` is null)'), 'licensesCount'],
      [Sequelize.literal('(SELECT COUNT(*) FROM `accessories_users` WHERE `accessories_users`.`assigned_to` = user.`id`)'), 'accessoriesCount'],
      [Sequelize.literal('(SELECT COUNT(*) FROM `consumables_users` WHERE `consumables_users`.`assigned_to` = user.`id`)'), 'consumablesCount']
    ],
    where: where,
    include: [
      { model: location, attributes: ['id', 'name'] },
      { model: department, attributes: ['id', 'name'] },
      { model: company, attributes: ['id', 'name'] },
      { model: talentGroup, attributes: ['id', 'name'] },
      { model: user, as: 'manager', attributes: ['id', 'first_name', 'last_name'] },
      { model: userGroups, attributes: ['user_id', 'group_id'], include: [{ model: group, attributes: ['id', 'name'] }] }
    ],
    order: [
      [sort, order]
    ],
    limit: limit,
    offset: offset
  });

  var response = []
  if (!_.isNil(result)) {
    _.map(result.rows, row => {
      response.push(formatResponse(row))
    })
  }

  res.json({ total: result.count, rows: response });
}))

router.get('/selectList', errorHandler(async function (req, res, next) {
  const response = await util.getSelectList(user, req, true)
  res.json(response);
}))

router.get('/:id', errorHandler(async function (req, res, next) {
  const location = models.location;
  const department = models.department;
  const company = models.company;
  const userGroups = models.userGroups;
  const group = models.group;
  user.belongsTo(location, { foreignKey: 'location_id' });
  user.belongsTo(department, { foreignKey: 'department_id' });
  user.belongsTo(company, { foreignKey: 'company_id' });
  //user.belongsTo(user, {foreignKey: 'manager_id', as: 'manager'});
  user.hasMany(userGroups, { foreignKey: 'user_id' })
  userGroups.belongsTo(group, { foreignKey: 'group_id' })
  const queries = req.query;
  const { search, sort, limit, offset, order } = util.queryRequest(queries);

  let result = await user.findOne({
    attributes: [
      'id', 'first_name', 'avatar', 'last_name', 'username', 'employee_num', 'permissions', 'jobtitle', 'phone', 'website', 'address', 'city', 'state', 'country', 'zip', 'email', 'notes', 'activated', 'two_factor_enrolled', 'last_login', 'deleted_at', 'created_at', 'updated_at',
      [Sequelize.literal('(SELECT COUNT(*) FROM `assets` WHERE `assets`.`user_id` = user.`id`)'), 'assetsCount'],
      [Sequelize.literal('(SELECT COUNT(*) FROM `licenses` WHERE `licenses`.`user_id` = user.`id`)'), 'licensesCount'],
      [Sequelize.literal('(SELECT COUNT(*) FROM `accessories` WHERE `accessories`.`user_id` = user.`id`)'), 'accessoriesCount'],
      [Sequelize.literal('(SELECT COUNT(*) FROM `consumables` WHERE `consumables`.`user_id` = user.`id`)'), 'consumablesCount']
    ],
    include: [
      { model: location, attributes: ['id', 'name'] },
      { model: department, attributes: ['id', 'name'] },
      { model: company, attributes: ['id', 'name'] },
      //{model: user, as: 'manager', attributes: ['id', 'first_name', 'last_name']},
      { model: userGroups, attributes: ['user_id', 'group_id'], include: [{ model: group, attributes: ['id', 'name'] }] }
    ],
    where: { id: req.params.id },
    order: [
      [sort, order]
    ],
    limit: limit,
    offset: offset
  });

  var response = {}
  if (!_.isNil(result)) {
    response = formatResponse(result)
  }

  res.json(response);

}))

router.get('/:id/status', errorHandler(async (req, res) => {
  let userResponse = await util.getUserStatus(user, req.params.id)
  let response = {}
  if (!_.isNil(userResponse)) {
    if (_.isNil(userResponse.availability_status)) {
      userResponse.availability_status = constants.userAvailabilityStatus.unavailable
    }
    const userStatus = _.eq(userResponse.availability_status, constants.userAvailabilityStatus.unavailable) ? false : true
    response = { id: userResponse.id, userType: userResponse.user_type, availabilityStatus: userStatus }
  }
  res.send(response)
}))

router.post('/', errorHandler(async function (req, res, next) {
  const userGroups = models.userGroups;
  req.body.permissions = JSON.stringify(req.body.permissions);
  const first_name = req.body.first_name;
  const isExists = await util.uniqueCheck(user, { email: req.body.email, firm_id: req.userInfo.firmId })
  if (isExists)
    res.json({ message: constants.errorMessages.emailExists })
  else {
    const saltRounds = 10;
    const password = otpGenerator.generate(6, { alphabets: true, upperCase: false, specialChars: false });
    const bcryptResponse = await bcrypt.hash(password, saltRounds)
    req.body.password = bcryptResponse
    var request = req.body;
    let userId = 0
    const response = await sequelize.transaction(t => {
      return user.create(request, { transaction: t }).then(result => {
        userId = result.id
        var groups = []

        // _.map(req.body.groups, groupId => {
        groups.push({ user_id: userId, group_id: req.body.group_id });
        // })

        return userGroups.bulkCreate(groups, { transaction: t });
      });
    }).then(function (result) {
      return { status: 'ok', id: userId }
    }).catch(function (err) {
      return { status: 'error' }
    });
    // await util.sendMail(password, req.body.email);
    await util.sendMail(req.body.email, constants.emailTemplates.usercredentials, { password, name: first_name })

    res.result = response;
    next()
  }
}))

router.post('/login', errorHandler(async function (req, res, next) {
  const userRequest = req.body
  const userGroups = models.userGroups;
  const group = models.group;
  //const active_users = 1;
  user.hasMany(userGroups, { foreignKey: 'user_id' })
  userGroups.belongsTo(group, { foreignKey: 'group_id' })
  //await util.encrypt(userRequest)
  const userResponse = await user.findOne({
    attributes: ['id', 'first_name', 'last_name', 'two_factor_enrolled', 'two_factor_optin', 'username', 'password', 'email', 'permissions', 'availability_status', 'user_type', 'talent_group_id', 'firm_id'
    ],
    include: {
      model: userGroups, attributes: ['group_id'], include: {
        model: group,
        attributes: ['permissions']
      }
    },
    where: { email: userRequest.email, activated: 1 }
  })
  let accessToken = {},
    success = false,
    message = 'Invalid Email or Password',
    isSuperuser = false,
    scanCode = '',
    permissions = []
  let result = {}
  if (_.isNil(userResponse)) {
    //   await user.update({active_users:1}, {where: {id: userResponse.id}})

    result = { success, message }
  } else {
    const isPasswordMatching = await bcrypt.compare(req.body.password, userResponse.password)
    if (isPasswordMatching) {
      const secret = process.env.JWT_SECRET
      if (!_.isNil(userResponse.userGroups) && _.size(userResponse.userGroups) > 0 && !_.isNil(_.head(userResponse.userGroups).group)) {
        permissions = JSON.parse(_.head(userResponse.userGroups).group.permissions)
      }
      if (!_.isNil(permissions))
        isSuperuser = _.isNil(permissions.superuser) || _.eq(permissions.superuser, '0') ? false : true
      accessToken = jwt.sign({
        userId: userResponse.id,
        username: userResponse.username,
        firstName: userResponse.first_name,
        lastName: userResponse.last_name,
        email: userResponse.email,
        isSuperuser: isSuperuser,
        talentGroupId: userResponse.talent_group_id,
        availabilityStatus: userResponse.availability_status,
        userType: userResponse.user_type,
        firmId: userResponse.firm_id
      }, secret, { expiresIn: '8h' })
      success = true
      message = ''
      if (userResponse.two_factor_optin && !userResponse.two_factor_enrolled) {
        const qrSecret = speakeasy.generateSecret({ length: 20 })
        await user.update({ two_factor_secret: qrSecret.base32 }, { where: { id: userResponse.id } })

        scanCode = await qrcode.toDataURL(qrSecret.otpauth_url)
      }
    }
    result = { success, accessToken, message, isSuperuser, permissions, scanCode, twoFactorOptin: userResponse.two_factor_optin, twoFactorEnrolled: userResponse.two_factor_enrolled }
  }
  res.result = result;
  next()
}))

router.post('/totpSetup/:id', errorHandler(async function (req, res, next) {
  var userToken = req.body.token
  var id = req.params.id
  const userResponse = await user.findOne({
    attributes: ['id', 'two_factor_secret'],
    where: { id: id }
  })

  var token = speakeasy.totp({
    secret: userResponse.two_factor_secret,
    encoding: 'base32'
  });
  res.json({ token: token })
}))

router.put('/verify/:id', errorHandler(async function (req, res, next) {
  var userToken = req.body.token
  var id = req.params.id
  const userResponse = await user.findOne({
    attributes: ['id', 'two_factor_secret'],
    where: { id: id }
  })

  var verified = speakeasy.time.verify({
    secret: userResponse.two_factor_secret,
    encoding: 'base32',
    token: userToken
  });
  await user.update({ two_factor_enrolled: verified }, { where: { id: id } })
  res.result = { verified }
  next()
}))

router.post('/generateOtp', errorHandler(async function (req, res, next) {
  const email = req.body.email
  const firmId = req.body.firmId
  let userResponse = await user.findOne({ where: { email: email, firm_id: firmId } })
  if (!_.isNil(userResponse)) {
    const otp = otpGenerator.generate(6, { alphabets: false, upperCase: false, specialChars: false });
    userResponse = await user.update({ password_otp: otp }, { where: { email: email, firm_id: firmId } })
    await util.sendMail(email, constants.emailTemplates.forgetPassword, { otp, name: 'name' })
    res.result = { otp: otp }
  } else {
    res.json({ message: constants.errorMessages.emailNotExists })
  }
  next()
}))


router.post('/maintenanceEmail', errorHandler(async function (req, res, next) {
   const email = ['devops@maphyasset.com', 'qa@maphyasset.com', 'deepak.v@rsctec.com', 'ar@rsctec.com', 'sathya@rsctec.com', 'tgnarayanan@rsctec.com', 'Sathishraj.b@rsctec.com', 'vinothkumarb654@gmail.com', 'ganesan.s@rsctec.com', 'gvs@rsctec,com'];
   const firmId = req.body.firmId
  const startDate = req.body.startDate
  const endDate = req.body.endDate
  let userResponse = await user.findOne({ where: { email: email, firm_id: firmId } })
  if (!_.isNil(userResponse)) {
    await util.sendMail(email, constants.emailTemplates.maintenanceMail, { startDate, endDate })
    res.result = { startDate: startDate, endDate: endDate };
  }
  else {
    res.json({ message: constants.errorMessages.emailNotExists })
  }
  next()
}))

router.post('/slack', errorHandler(async function (req, res, next) {
  //const name = req.body.name
  // req.body.email = req.userInfo.email
  //   const email = req.body.email
  const message = req.body.message
  // let result = await webhook.send(name, message);
  let result = await webhook.send(message);

  res.result = result;
  next()
}))

router.put('/changePassword', errorHandler(async function (req, res, next) {

  const firmId = req.body.firmId;
  const saltRounds = 10;
  const password = await bcrypt.hash(req.body.newPassword, saltRounds);
  const userResponse = await user.findOne({
    attributes: ['password'],
    where: { id: req.userInfo.userId, activated: 1 }
  });
  const isPasswordMatching = await bcrypt.compare(req.body.oldPassword, userResponse.password)
  if (isPasswordMatching) {
    const response1 = await user.update({ password: password }, { where: { id: req.userInfo.userId, firm_id: firmId } });
    res.result = response1;

  } else {
    res.json({ message: constants.errorMessages.invalidOldpassword })
  }
  next();
}));

router.put('/:id', errorHandler(async function (req, res, next) {
  const userGroups = models.userGroups;
  const id = _.parseInt(req.params.id)
  const isExists = await util.uniqueCheck(user, { email: req.body.email, firm_id: req.userInfo.firmId, id: { [Op.ne]: req.params.id } })
  if (isExists)
    res.json({ message: constants.errorMessages.emailExists })
  else {
    if (!_.isNil(req.body.permissions))
      req.body.permissions = JSON.stringify(req.body.permissions);
    var request = req.body;
    const result = await sequelize.transaction(t => {
      return user.update(request, { where: { id: id } }, { transaction: t }).then(result => {
        return userGroups.destroy({ where: { user_id: id } }, { transaction: t }).then(result => {
          var groups = []
          //_.map(req.body.groups, groupId => {
          groups.push({ user_id: id, group_id: req.body.group_id });
          //})
          return userGroups.bulkCreate(groups, { transaction: t });
        })
      });
    }).then(function (result) {
      return { status: 'ok' }
    }).catch(function (err) {
      return { status: 'error' }
    });


    res.result = result;
    next()
  }
}))

router.put('/password/update', errorHandler(async function (req, res, next) {
  const email = req.body.email
  const otp = req.body.otp
  const firmId = req.body.firmId
  const saltRounds = 10;
  const bcryptResponse = await bcrypt.hash(req.body.password, saltRounds)
  let userResponse = await user.findOne({ where: { email: email, firm_id: firmId, password_otp: otp } })

  if (_.isNil(userResponse)) {
    res.json({ message: constants.errorMessages.invalidOtp })
  } else {
    const userResponse = await user.update({ password: bcryptResponse, password_otp: null }, { where: { email: email, firm_id: firmId } })
    res.result = userResponse
  }
  next()
}))

router.put('/restore/:id', errorHandler(async function (req, res, next) {
  const id = _.parseInt(req.params.id)
  const request = {
    deleted_at: null,
    user_id: req.userInfo.userId
  }
  let result = await user.update(request, { where: { id: id } });

  res.result = result;
  next()
}))

router.put('/status/:id', errorHandler(async function (req, res, next) {
  let { ticket, ticketStatus } = models
  const id = _.parseInt(req.params.id)
  let ticketStatuses = await util.getSelectList(ticketStatus, req)
  ticketStatuses = ticketStatuses.items
  req.body.availability_status = _.eq(req.body.availability_status, 0) ? constants.userAvailabilityStatus.unavailable : req.body.availability_status
  const userInfo = await util.getUserInfo(user, req.userInfo.userId)

  let ticketResponses = await ticket.findAll({
    attributes: ['id', 'details', 'assigned_to', 'user_id'],
    where: { assigned_to: req.userInfo.userId, firm_id: req.userInfo.firmId ,
    status_id: _.eq(req.body.availability_status, constants.userAvailabilityStatus.unavailable) ?
      constants.ticketStatusName.inprogress : constants.ticketStatusName.hold}
  });

  let ticketRequest = {}

  if (_.isEmpty(ticketResponses)) {
    if (_.eq(req.body.availability_status, constants.userAvailabilityStatus.unavailable)) {
      let result = await user.update({
        user_id: req.userInfo.user_id,
        availability_status: req.body.availability_status
      },
        { where: { id: req.userInfo.userId } })
      res.result = result
    } else {
      const status = _.find(ticketStatuses, x => x.text == constants.ticketStatusName.inprogress)
      const openStatus = _.find(ticketStatuses, x => x.text == constants.ticketStatusName.open)
      let ticketResponse = await ticket.findOne({
        attributes: ['id', 'details', 'assigned_to', 'user_id'],
        where: {
          status_id: openStatus.id,
          talent_group_id: req.userInfo.talentGroupId,
          firm_id: req.userInfo.firmId
        },
        order: [['createdAt', 'ASC']]
      })
      if (!_.isNil(ticketResponse)) {
        let ticketDetails = JSON.parse(ticketResponse.details)
        ticketDetails.push({
          user: userInfo.name,
          detail: constants.ticketStatusName.inprogress,
          status: constants.ticketStatusName.inprogress,
          date: new Date()
        })
        const details = JSON.stringify(ticketDetails)
        ticketRequest = {
          id: ticketResponse.id,
          status_id: status.id,
          assigned_to: req.userInfo.userId,
          details: details,
          user_id: req.userInfo.userId,
          updated_at: new Date()
        }
        if (!_.isNil(ticketRequest) && !_.isNil(ticketRequest.id)) {
          res.result = await updateTicketAndUserStatus(ticketRequest, id, req.body.availability_status, ticket)
        }
      }
      else{
        let result = await user.update({
          user_id: req.userInfo.user_id,
          availability_status: req.body.availability_status
        },
          { where: { id: req.userInfo.userId } })
          res.result = result
        //res.result={sucess:true, message:"Updated Succesfully"};
      }
    }
  } else {
    for (const ticketResponse of ticketResponses) {
      let ticketDetails = _.isEmpty(ticketResponse) ? [] : JSON.parse(ticketResponse.details)
      const status = _.eq(req.body.availability_status, constants.userAvailabilityStatus.unavailable) ?
        constants.ticketStatusName.hold : constants.ticketStatusName.inprogress

      ticketDetails.push({
        user: userInfo.name,
        detail: status,
        status: status,
        date: new Date()
      })
      ticketRequest = {
        id: ticketResponse.id,
        status_id: _.find(ticketStatuses, x => x.text == status).id,
        details: JSON.stringify(ticketDetails),
        user_id: req.userInfo.userId,
        updated_at: new Date()
      }
      if (!_.isNil(ticketRequest) && !_.isNil(ticketRequest.id)) {
        res.result = await updateTicketAndUserStatus(ticketRequest, id, req.body.availability_status, ticket)
      }
    }
  }
  //res.result = response
  next()
}))

async function updateTicketAndUserStatus(ticketRequest, id, availabilityStatus, ticket) {
  const response = await sequelize.transaction(t => {
    return ticket.update(ticketRequest, { where: { id: ticketRequest.id } }, { transaction: t }).then(result => {
      return user.update({
        availability_status:
          _.eq(availabilityStatus, constants.userAvailabilityStatus.available) ?
            constants.userAvailabilityStatus.busy : constants.userAvailabilityStatus.unavailable
      },
        { where: { id: id } }, { transaction: t });
    });
  }).then(function (result) {
    return { status: 'ok', id: id }
  }).catch(function (err) {
    return { status: 'error' }
  });
  return response
}

router.delete('/:id', errorHandler(async function (req, res, next) {
  //    const userGroups = models.userGroups;
  const id = _.parseInt(req.params.id)
  var datetime = new Date();
  const userRequest = {
    deleted_at: datetime,
    user_id: req.userInfo.userId
  }
  let result = await user.update(userRequest, { where: { id: id } });
  // const response = await sequelize.transaction(t => {
  //   return userGroups.destroy({where: {user_id: id}}, {transaction: t}).then(result => {
  //     return user.destroy({where: {id: id}}, {transaction: t})
  //   });
  // }).then(function (result) {
  //   return {status: 'ok'}
  // }).catch(function (err) {
  //   return {status: 'error'}
  // });


  res.result = result;
  next()
}))

function bindUserGroups(user) {
  var userGroups = []
  var total = _.size(user.dataValues.userGroups)
  if (total > 0) {
    _.map(user.dataValues.userGroups, group => {
      total = total + 1
      if (!_.isNil(group.dataValues) && !_.isNil(group.dataValues.group) && !_.isNil(group.dataValues.group.dataValues))
        userGroups.push(util.getRelationalObject(group.dataValues.group.dataValues))
    })
  }
  return { total: total, rows: userGroups }
}

function getManager(user) {
  return _.isNil(user) ? {} : {
    id: user.id,
    name: `${user.first_name} ${user.last_name}`
  }
}

function formatResponse(user) {
  return {
    id: user.id,
    avatar: user.avatar,
    name: `${user.first_name} ${user.last_name}`,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    employee_num: user.employee_num,
    manager: getManager(user.dataValues.manager),
    jobtitle: user.jobtitle,
    phone: user.phone,
    website: user.website,
    address: user.address,
    city: user.city,
    state: user.state,
    country: user.country,
    zip: user.zip,
    email: user.email,
    talent_group_id: user.talent_group_id,
    user_type: user.user_type,
    talentGroup: util.getRelationalObject(user.dataValues.talentGroup),
    department: util.getRelationalObject(user.dataValues.department),
    location: util.getRelationalObject(user.dataValues.location),
    notes: user.notes,
    activated: user.activated,
    two_factor_activated: user.two_factor_activated,
    two_factor_enrolled: user.two_factor_enrolled,
    assets_count: user.dataValues.assetsCount,
    licenses_count: user.dataValues.licensesCount,
    accessories_count: user.dataValues.accessoriesCount,
    consumables_count: user.dataValues.consumablesCount,
    company: util.getRelationalObject(user.dataValues.company),
    created_at: util.createdUpdatedDateFormat(user.created_at),
    updated_at: util.createdUpdatedDateFormat(user.updated_at),
    last_login: util.createdUpdatedDateFormat(user.last_login),
    deleted_at: util.createdUpdatedDateFormat(user.deleted_at),
    available_actions: {
      "update": true,
      "delete": true,
      "clone": true,
      "restore": false
    },
    groups: bindUserGroups(user),
    permissions: _.isNil(user.permissions) ? {} : JSON.parse(user.permissions),
  }
}

module.exports = router;
