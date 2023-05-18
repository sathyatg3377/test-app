var express = require('express');
var router = express.Router();
var Sequelize = require("sequelize");
var sequelize = require('../../db/conn');
const Op = Sequelize.Op;
const models = require('../../db/models/index');
var _ = require('lodash');
var util = require('../../utils/index');
const constants = require('../../shared/constants');
var {errorHandler} = require('../../shared/error-handler')
let ticket = models.ticket;
let user = models.user;
    ticket.belongsTo(user, {foreignKey: 'assigned_to'});
    ticket.belongsTo(user, {foreignKey: 'created_by', as: 'creator'});
    ticket.belongsTo(user, {foreignKey: 'escalated_by', as: 'escalator'});

  router.get('/', errorHandler(async function(req, res, next) {
      const queries = req.query;
      let {sort, limit, offset, order} = util.queryRequest(queries);
      const isManager = _.eq(req.userInfo.userType, constants.userType.manager) ? true : false
      let ticketIds = []
      let ticketStatuses = await util.getSelectList(models.ticketStatus, req)
      ticketStatuses = ticketStatuses.items;
      let isEscalatedStatus = false;
      const statusId = _.parseInt(req.query.status_id)
      let escalatedBy = {[Op.eq]: null}
      let escalatedStatus = ticketStatuses.find(x => x.text === constants.ticketStatusName.escalate)
      if (_.eq(statusId, escalatedStatus.id)) {
        isEscalatedStatus = true
      }
      if (isManager) {
        const talentGroupTickets = await ticket.findAll({
          attributes: ['id'], 
          where: {talent_group_id: req.userInfo.talentGroupId}
        })
        ticketIds = _.map(talentGroupTickets, tick => {return tick.id})
        if (isEscalatedStatus || _.eq(statusId, 0)) {
          escalatedBy = {[Op.ne]: 0}
        }
      } else {
        if (isEscalatedStatus || _.eq(statusId, 0)) {
          escalatedBy = {[Op.eq]: req.userInfo.userId}
        }
      }
      if (_.eq(sort, 'created_at.formatted'))
        sort = 'created_at'
      
      const talentGroup = models.talentGroup
      const ticketIssue = models.ticketIssue
      ticket.belongsTo(talentGroup, {foreignKey: 'talent_group_id'});
      ticket.belongsTo(ticketIssue, {foreignKey: 'issue_id'});

      let where = []
      if (isEscalatedStatus) {
        //where = {escalated_by: escalatedBy} 
        //esclate tab fix
        where.push({escalated_by: escalatedBy})
        where.push({talent_group_id: req.userInfo.talentGroupId})
        where.push({status_id: _.eq(statusId, 0) ? {[Op.ne]: 0} : statusId})
        where.push({firm_id: req.userInfo.firmId})
      } 
      else 
      {
        //For my tickets
        if(_.eq(statusId,99)){
          where.push({created_by: req.userInfo.userId});
          where.push({firm_id: req.userInfo.firmId}) ;
        }
        else{
        where.push({
          [Op.or]: [
              {
                assigned_to: {[Op.eq]: req.userInfo.userId}
              },
              {
                created_by: req.userInfo.userId
              },
              {
                id: {[Op.in]: ticketIds}     
              },
              {
                escalated_by: escalatedBy
              }
          ]
        })
        where.push({talent_group_id: req.userInfo.talentGroupId})
        where.push({status_id: _.eq(statusId, 0) ? {[Op.ne]: 0} : statusId})
        where.push({firm_id: req.userInfo.firmId})
      }
    }
      let result = await ticket.findAndCountAll({
            attributes: ['id', 'description', 'details', 'asset_tag', 'others', 'issue_id', 'talent_group_id', 'created_at', 'updated_at', 'created_by', 'status_id',
            //[Sequelize.literal('(SELECT CASE WHEN status_id=1 THEN (SELET "'+getStatus(1)+'") WHEN status_id=2 THEN (SELECT "'+getStatus(2)+'") WHEN status_id=3 then (SELECT "'+getStatus(3)+'") WHEN status_id=4 then (SELECT "'+getStatus(4)+'") WHEN status_id=5 then (SELECT "'+getStatus(5)+'")) END)'), 'assignedLocation']
            //[Sequelize.literal('(SELECT '+getStatus(`ticket`.`status_id`)+'")'), 'ticket_status']
          ],
          include:[{model: user, attributes: ['id','first_name','last_name']},
          {model: talentGroup, attributes: ['id','name']},
          {model: ticketIssue, attributes: ['id','name']},
          {model: user, as: 'creator', attributes: ['id', 'first_name', 'last_name']},
          {model: user, as: 'escalator', attributes: ['id', 'first_name', 'last_name']},
        ],
            where: where,
            order: Sequelize.literal(`${sort} ${order}`),
            limit: limit,
            offset: offset
          });
          var response = []
          if (!_.isNil(result)) {
              _.map(result.rows, row => {
                response.push(formatResponse(row, ticketStatuses))
            })
          }
      
      res.json({ total: result.count, rows: response });
    }))

  router.get('/ticketstatus', errorHandler(async function(req, res, next) {
      let ticketStatus = models.ticketStatus
      const ticketStatuses = await util.getSelectList(ticketStatus, req);
      const userType = _.isNil(req.query.userType) ? 0 : _.parseInt(req.query.userType)
      switch(userType) {
        case constants.userType.techinician:
          ticketStatuses.items = _.filter(ticketStatuses.items, item => item.type === req.query.userType)
          break;
        case  constants.userType.manager:
          ticketStatuses.items = _.filter(ticketStatuses.items, item => item.type === constants.userType.techinician.toString() || item.type === req.query.userType)
          break;
        default:
          ticketStatuses.items = ticketStatuses.items
          break
      }
      ticketStatuses.total_count = _.size(ticketStatuses.items)
      res.json(ticketStatuses)
  }))

  router.get('/:id', errorHandler(async function(req, res, next) {
      const id = _.parseInt(req.params.id);
      const talentGroup = models.talentGroup
      const ticketIssue = models.ticketIssue
      ticket.belongsTo(talentGroup, {foreignKey: 'talent_group_id'});
      ticket.belongsTo(ticketIssue, {foreignKey: 'issue_id'});

      let result = await ticket.findOne({
          attributes: ['id', 'asset_tag', 'description', 'details', 'status_id', 'issue_id', 'talent_group_id', 'others', 'created_at', 'updated_at','created_by'],
          include:[
              {model: user, attributes: ['id','first_name','last_name']},
              {model: talentGroup, attributes: ['id','name']},
              {model: ticketIssue, attributes: ['id','name']},
              {model: user, as: 'creator', attributes: ['id', 'first_name', 'last_name']}
          ],
          where: {id: id}
      });
      let ticketStatuses = await util.getSelectList(models.ticketStatus, req)
      ticketStatuses = ticketStatuses.items
      const response = _.isNil(result) ? {} : formatResponse(result, ticketStatuses);
      res.json(response);
  }))
  
  router.get('/:talentGroupId/users', errorHandler(async function(req, res, next) {
    const technicialUsers = await user.findAll({
      attributes: ['id', 'first_name', 'last_name'], 
      where: {talent_group_id: req.params.talentGroupId, 
          user_type: constants.userType.techinician}
      })
    let response = []
    if (!_.isEmpty(technicialUsers)) {
      _.map(technicialUsers, technicialUsers => {
        response.push({
          id: technicialUsers.id, 
          firstName: technicialUsers.first_name, 
          lastName: technicialUsers.last_name
        })
      })
    }
    res.json(response)
  }))

router.post('/', errorHandler(async function(req, res, next) {
  ticketStatus = models.ticketStatus
  let ticketStatuses = await util.getSelectList(ticketStatus, req)
  ticketStatuses = ticketStatuses.items
  const result = await createTicket(req, res, ticketStatuses)
  next()
}))

router.post('/:id/sister', errorHandler(async function(req, res, next) {
  ticketStatus = models.ticketStatus
  let ticketStatuses = await util.getSelectList(ticketStatus, req)
  ticketStatuses = ticketStatuses.items
  const response = await createTicket(req, res, ticketStatuses, req.params.id)
  const sisterStatus = _.find(ticketStatuses, x => x.text === constants.ticketStatusName.sisterTicket)
  await ticket.update({sister_ticket_id: req.params.id, status_id: sisterStatus.id, user_id: req.userInfo.userId, updated_at: new Date()}, {where: {id: req.params.id}})
  next()
}))

async function createTicket(req, res, ticketStatuses) {
  let {ticketIssue, talentGroup, ticketStatus} = models

  req.body.user_id = req.userInfo.userId
  req.body.created_by = req.userInfo.userId
  const userInfo = await util.getUserInfo(user, req.userInfo.userId)
  const id = req.body.issue_id
  const talentGroupResponse = await ticketIssue.findOne({where: {id: id}})
  const talentGroupId = talentGroupResponse.talent_group_id
  req.body.talent_group_id = talentGroupId
  
  const userResponse = await user.findAndCountAll({
    attributes: ['id'
      //[Sequelize.literal('(select count(*) as count from `tickets`  where `tickets`.`assigned_to`=`user`.`id` and `tickets`.`status_id`='+ticketStatus.id+')'), 'assignedCount']
    ], 
    where: {
      talent_group_id: talentGroupId,
      availability_status: constants.userAvailabilityStatus.available,
      user_type: constants.userType.techinician
    }
  })
  req.body.status_id = _.find(ticketStatuses, x => x.text === constants.ticketStatusName.open).id

  if (!_.isNil(userResponse) && !_.isEmpty(userResponse.rows)) {
    if (_.eq(_.size(userResponse.rows), 1)) {
      req.body.assigned_to = _.head(userResponse.rows).id
    } else {
      let userIds = _.map(userResponse.rows, x => x.id)

      const assignedUsers = await ticket.findAll({
        where: {assigned_to: {[Op.in]: userIds}},
      })
      _.map(userIds, id => {
        if (_.isNil(req.body.assigned_to)) {
          const isAssigned = _.some(assignedUsers, usr => usr.assigned_to === id)
          if (!isAssigned) req.body.assigned_to = id
        }
      })
      if (_.isNil(req.body.assigned_to)) {
        let ticketClosedByDate = await ticket.findAll({
          where: {assigned_to: {[Op.in]: userIds}},
          status_id: _.find(ticketStatuses, x => x.text === constants.ticketStatusName.closed).id,
          order: [['updatedAt', 'ASC']],
          limit: 1
        })
        if (_.isEmpty(ticketClosedByDate)) {
          req.body.assigned_to = _.head(userResponse.rows).id
        } else {
          req.body.assigned_to = _.head(ticketClosedByDate).assigned_to
        }
      }
    }
    req.body.status_id = _.find(ticketStatuses, x => x.text === constants.ticketStatusName.inprogress).id
  }

  req.body.details = JSON.stringify([{user: userInfo.name, detail: req.body.detail, date: new Date()}])
  let ticketId = 0
  req.body.firm_id = req.userInfo.firmId
  if (_.isNil(req.body.assigned_to)) {
    let result = await ticket.create(req.body)
    res.result = result
  } else {
    const response = await sequelize.transaction(t => {
        return ticket.create(req.body, {transaction: t}).then(result => {
        ticketId = result.id
        return user.update({availability_status: constants.userAvailabilityStatus.busy}, {where: {id: req.body.assigned_to}}, {transaction: t});
      });
    }).then(function (result) {
      return {status: 'ok', id: ticketId}
    }).catch(function (err) {
      return {status: 'error'}
    });
    res.result = response;
  }
  return res
}

router.put('/:id', errorHandler(async function(req, res, next) {
  let {ticketStatus} = models
    const id = _.parseInt(req.params.id)
    req.body.user_id = req.userInfo.userId    
    const ticketResponse = await ticket.findOne({
        attributes: ['details', 'talent_group_id', 'issue_id'],
        where: {id: id, firm_id: req.userInfo.firmId}
    })
    const userInfo= await util.getUserInfo(user, req.userInfo.userId)
    let ticketStatuses = await util.getSelectList(ticketStatus, req)
    ticketStatuses = ticketStatuses.items

    let status = _.find(ticketStatuses, x => x.id == req.body.status_id)
    let ticketDetails = JSON.parse(ticketResponse.details)
    ticketDetails.push({
      user: userInfo.name, 
      detail: req.body.detail, 
      date: new Date(),
      status: status.text
    })
    let details = JSON.stringify(ticketDetails)
    if (_.eq(status.text, constants.ticketStatusName.closed) || 
      _.eq(status.text, constants.ticketStatusName.escalate)) {
        let ticketRequest = {
          status_id: req.body.status_id,
          details: details,
          user_id: req.userInfo.userId,
          updated_at: new Date()
        }

      if (_.eq(status.text, constants.ticketStatusName.escalate)) {
        const talentGroupManager = await user.findOne({
          attributes: ['id'], 
          where: {talent_group_id: req.userInfo.talentGroupId, user_type: constants.userType.manager}
        })
        ticketRequest.assigned_to = talentGroupManager.id
        ticketRequest.escalated_by = req.userInfo.userId
      }


      let openStatus = _.find(ticketStatuses, x => x.text == constants.ticketStatusName.open)

      const openTicket = await ticket.findAll({
        attributes: ['id', 'talent_group_id', 'assigned_to'],
        where: {
          talent_group_id: req.userInfo.talentGroupId,
          status_id: openStatus.id,
          firm_id: req.userInfo.firmId,
          id: {[Op.ne]: id}
        },
        order: [['created_at', 'asc']],
        limit: 1
      })
      
      const userStatus = !_.isEmpty(openTicket) ? constants.userAvailabilityStatus.busy : constants.userAvailabilityStatus.available
      let assignTicket = {}
      if (!_.isEmpty(openTicket)) {
        ticketDetails = _.isNil(ticketResponse.details) ? [] : JSON.parse(ticketResponse.details)
        ticketDetails.push({
          user: userInfo.name, 
          detail: req.body.detail, 
          date: new Date(),
          status: ticketStatus.text, 
        })
        details = JSON.stringify(ticketDetails)

        assignTicket = {
          status_id: _.find(ticketStatuses, x => x.text === constants.ticketStatusName.inprogress).id,
          details: details,
          user_id: req.userInfo.userId,
          updated_at: new Date(),
          assigned_to: req.userInfo.userId
        }
      }
      const response = await sequelize.transaction(t => {
          return ticket.update(ticketRequest, {where: {id: req.params.id}}, {transaction: t}).then(result => {
          ticketId = result.id
          return user.update({availability_status: userStatus}, {where: {id: req.userInfo.userId}}, {transaction: t});
        });
      }).then(function (result) {
        return {status: 'ok', id: ticketId}
      }).catch(function (err) {
        return {status: 'error'}
      });
      if (!_.isEmpty(openTicket)) {
        await ticket.update(assignTicket, {where: {id: _.head(openTicket).id}})
      }
      res.result = response
    } else if (_.eq(status.text, constants.ticketStatusName.reAssign)) {
      ticketRequest = {
        status_id: _.find(ticketStatuses, x => x.text == constants.ticketStatusName.open).id,
        assigned_to: req.body.assigned_to,
        details: details,
        user_id: req.userInfo.userId,
        updated_at: new Date()
      }

      const response = await sequelize.transaction(t => {
          return ticket.update(ticketRequest, {where: {id: req.params.id}}, {transaction: t}).then(result => {
          ticketId = result.id
          return user.update({availability_status: constants.userAvailabilityStatus.busy}, {where: {id: req.body.assigned_to}}, {transaction: t});
        });
      }).then(function (result) {
        return {status: 'ok', id: ticketId}
      }).catch(function (err) {
        return {status: 'error'}
      });
      res.result = response;
    }

    next()
}))

function getStatus(statusId, ticketStatuses) {
    const status = _.find(ticketStatuses, x => _.eq(x.id, statusId))
    return status.text
}

function getUserInfo(userInfo) {
  let user = {}
  if (!_.isNil(userInfo)) {
    return `${userInfo.first_name} ${_.isNil(user.last_name) ? '' : user.last_name}`
  }
}

function formatResponse(row, ticketStatuses) {
  return  {
      id: row.id,
      asset_tag: row.asset_tag,
      description: row.description,
      details: _.isNil(row.details) ? [] : JSON.parse(row.details),
      asset_tag: row.asset_tag,
      status: getStatus(row.status_id, ticketStatuses),
      userName: getUserInfo(row.creator),
      createdBy: row.created_by,
      escalatedBy: getUserInfo(row.escalator),
      assigned: getUserInfo(row.user),
      others: row.others,
      ticketIssue: _.isNil(row.ticketIssue) ? {} : {id: row.ticketIssue.id, name: row.ticketIssue.name},
      talentGroup: {id: row.talentGroup.id, name: row.talentGroup.name},
      created_at: util.createdUpdatedDateFormat(row.created_at),
      updated_at: util.createdUpdatedDateFormat(row.updated_at)
  }
}

module.exports = router;
