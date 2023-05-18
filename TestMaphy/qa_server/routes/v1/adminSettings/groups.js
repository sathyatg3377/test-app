var express = require('express');
var router = express.Router();
var Sequelize = require("sequelize");
const Op = Sequelize.Op;
const models = require('../../../db/models/index');
var _ = require('lodash');
var util = require('../../../utils/index');
var {errorHandler} = require('../../../shared/error-handler')

router.get('/', errorHandler(async function(req, res, next) {
    const group = models.group;
    const queries = req.query;
    const {search, sort, limit, offset, order} = util.queryRequest(queries);

    let result = await group.findAndCountAll({
          attributes: ['id', 'name', 'permissions', 'created_at', 'updated_at',
          [Sequelize.literal('(SELECT COUNT(`users_groups`.`group_id`) FROM `users_groups` WHERE `users_groups`.`group_id` = `group`.`id`)'), 'usersCount']
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
  }))

  router.get('/selectList', errorHandler(async function(req, res, next) {
    const group = models.group;
    const response = await util.getSelectList(group, req)
    res.json(response);  
  }))

  router.get('/:id', errorHandler(async function(req, res, next) {
    const group = models.group;

    const id = _.parseInt(req.params.id);
    let result = await group.findOne({
        attributes: ['id', 'name', 'permissions', 'created_at', 'updated_at',
        [Sequelize.literal('(SELECT COUNT(`users_groups`.`group_id`) FROM `users_groups` WHERE `users_groups`.`group_id` = `group`.`id`)'), 'usersCount']
    ],
      where: {id: id}
    });
    const response = _.isNil(result) ? {} : formatResponse(result);
    res.json(response);
  }))

  router.post('/', errorHandler(async function(req, res, next) {
    const group = models.group;
    var permissions = req.body.permissions;
    req.body.permissions = JSON.stringify(permissions)
    let result = await group.create(req.body);
    res.result = result;
    next()
  }))

  router.put('/:id', errorHandler(async function(req, res, next) {
    const group = models.group;
    const id = _.parseInt(req.params.id)
    var permissions = req.body.permissions;
    req.body.permissions = JSON.stringify(permissions)
    let result = await group.update(req.body, {where: {id: id}});
  
    res.result = result;
    next()
  }))

router.delete('/:id', errorHandler(async function(req, res, next) {
    const group = models.group;
    const id = _.parseInt(req.params.id)
    let result = await group.destroy({where: {id: id}});
    res.result = result;
    next()
}))

function formatResponse(group) {
  return  {
      id: group.id,
      name: group.name,
      permissions: JSON.parse(group.permissions),
      available_actions: util.getAvailableActions([
        group.dataValues.usersCount
      ]),
      created_at: util.createdUpdatedDateFormat(group.created_at),
      updated_at: util.createdUpdatedDateFormat(group.updated_at),
      users_count: group.dataValues.usersCount
  }
}

module.exports = router;
