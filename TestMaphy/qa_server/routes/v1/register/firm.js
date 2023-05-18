var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var moment = require('moment');
var Sequelize = require("sequelize");
var sequelize = require('../../../db/conn');
const Op = Sequelize.Op;
const models = require('../../../db/models/index');
var _ = require('lodash');
var util = require('../../../utils/index');
const constants = require('../../../shared/constants');
const { add } = require('winston');

router.get('/', async function(req, res, next) {
    const firm = models.firm;
    const queries = req.query;
    const {search, sort, limit, offset, order} = util.queryRequest(queries);
    const admin = process.env.RSC_ADMIN

    if (_.eq(admin, req.userInfo.username)) {
      let result = await firm.findAndCountAll({
            attributes: ['id', 'name', 'image', 'created_at', 'updated_at', 'activated'
          ],
            where: {name: {
              [Op.like]: '%'+ search+'%'
            }},
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
      } else {
        result = {error: constants.errorMessages.permissionIssue}
        res.status(401).json({result: result})
      }
      next()
  });
  
router.get('/:id', async function(req, res, next) {
    const id = _.parseInt(req.params.id);
    const result = await getFirmById(id)
    const response = _.isNil(result) ? {} : formatResponse(result);
    res.json(response);
  });

router.post('/', async function(req, res, next) {
    const firm = models.firm;
    const user = models.user;
    const userGroups = models.userGroups;
    //const firmId = req.userInfo.userId
    const isExists = await util.uniqueCheck(user, {username: req.body.username})
    if (isExists)
      res.json({errorMessage: constants.errorMessages.userNameExists})
    else {
      const saltRounds = 10;
      const bcryptResponse = await bcrypt.hash(req.body.password, saltRounds);
      req.body.password  = bcryptResponse
      var request = req.body;
      request.activated = 0
      request.phone = req.body.mobile_no
      request.email = req.body.username
      var firmRequest = {
          name: req.body.name,
          activated: 0
      }
      let userId = 0,
        firmId = 0
      const response = await sequelize.transaction(t => {
        return firm.create(firmRequest, {transaction: t}).then(firmRes => {
            firmId = firmRes.id
            request.firm_id = firmId
                return user.create(request, {transaction: t}).then(result => {
                    userId = result.id
                    firmId = result.firm_id
                    var groups = []
                    groups.push({user_id: userId, group_id: 1,firm_id: firmId});
                return userGroups.bulkCreate(groups, {transaction: t});
            })
        });
      }).then(function (result) {
        return {status: 'ok', id: firmId}
      }).catch(function (err) {
        return {status: 'error'}
      });
      res.result = {id: firmId};
//      res.result = response;
      next()
    }
})

router.put('/:id/subscription', async function(req, res, next) {
  const firm = models.firm;
  const firmSubscription = models.firmSubscription;

  const id = req.params.id
  const numberOfDays = req.body.number_of_days
  const today = new Date()
  const result = await getFirmById(id)
  let expirationDate = today
  if (!_.isNil(result.expiration_date)) {
    expirationDate = moment(result.expiration_date, "DD/MM/YYYY")
//    const dayDiff = moment().diff(result.expiration_date, 'day')
//    console.log(dayDiff)
  } else {
    expirationDate = moment(expirationDate, "DD/MM/YYYY")
  }
  expirationDate = moment(expirationDate).add(numberOfDays, 'days')
  //expirationDate = moment(expirationDate).format("DD/MM/YYYY")
  const userId = _.isNil(req.userInfo) ? result.user_id : req.userInfo.userId
  await sequelize.transaction(t => {
    return firm.update({expiration_date: expirationDate, user_id: userId}, {where: {id: id}}, {transaction: t}).then(r => {
      return firmSubscription.create({firm_id: id, user_id: userId, created_at: new Date(), amount: req.body.amount, number_of_days: numberOfDays, expiration_date: expirationDate, description: req.body.description}, { transaction: t });
    });
  }).then(function (result) {
    res.result = {id: id}
  }).catch(function (err) {
    res.result = {error: err.message}
  })

})

router.put('/:id/activate', async function(req, res, next) {
  await statusUpdate(1, req, res)
  next()
})

router.put('/:id/deactivate', async function(req, res, next) {
  await statusUpdate(0, req, res)
  next()
})

async function statusUpdate(status, req, res) {
  const user = models.user
  const firm = models.firm
  const id = _.parseInt(req.params.id)
  const userId = req.userInfo.userId
  await sequelize.transaction(t => {
    return user.update({activated: status, user_id: userId}, {where: {firm_id: id}}, {transaction: t}).then(r => {
      return firm.update({activated: status, user_id: userId}, {where: {id: id}}, { transaction: t });
    });
  }).then(function (result) {
    res.result = {id: id}
  }).catch(function (err) {
    res.result = {error: err.message}
  })

  return res
}

async function getFirmById(id) {
  const firm = models.firm;

  let result = await firm.findOne({
      attributes: ['id', 'name', 'image', 'created_at', 'updated_at', 'activated', 'expiration_date', 'user_id'
  ],
    where: {id: id}
  });
  return result
}

function formatResponse(company) {
  return  {
      id: company.id,
      name: company.name,
      image: company.image,
      created_at: util.createdUpdatedDateFormat(company.created_at),
      updated_at: util.createdUpdatedDateFormat(company.updated_at),
      activated: company.activated
  }
}

module.exports = router;
