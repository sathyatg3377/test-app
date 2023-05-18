var _ = require('lodash');
var moment = require('moment');
var Sequelize = require("sequelize");
var crypto = require('crypto');
var nodemailer = require('nodemailer')
var sibTransport = require('nodemailer-sendinblue-transport') 
const Email = require('email-templates');
const Op = Sequelize.Op

var {paginationSettings, dateTimeFormat, selectListSettings, cryptoAlgorithm, checkoutType, itemTypes} = require('../shared/constants');
const constants = require('../shared/constants');

var formatDate = (data, format) => {
    if(_.isNil(data))
        return '';
    else {
        return moment(data).format(format);
    }
}

var createdUpdatedDateFormat = data => {
    return {
        datetime: formatDate(data, dateTimeFormat.createdUpdatedDatetime),
        formatted: formatDate(data, dateTimeFormat.createdUpdatedFormatted)
    }
}

var queryRequest = queries => {
    const search = _.isNil(queries.search) ? '': queries.search;
    const sort = _.isNil(queries.sort) ? 'id': _.isEmpty(queries.sort) ? paginationSettings.sortColumn : queries.sort;
    const limit = _.isNil(queries.limit) ? paginationSettings.pageSize : _.isEmpty(queries.limit) ? paginationSettings.pageSize : _.parseInt(queries.limit);
    const offset = _.isNil(queries.offset) ? paginationSettings.offset : _.isEmpty(queries.offset) ? paginationSettings.offset : _.parseInt(queries.offset);
    const order = _.isNil(queries.order) ? paginationSettings.sortDirection : _.isEmpty(queries.order) ? paginationSettings.sortDirection : queries.order;
    return {
        search: search,
        sort: sort,
        limit: limit,
        offset: offset,
        order: order
    }
}
var queryRequest1 = queries1 => {
  const searchCompany = _.isNil(queries1.searchCompany) ? '': queries1.searchCompany;
  const searchStatus = _.isNil(queries1.searchStatus) ? '': queries1.searchStatus;
  const searchLocation = _.isNil(queries1.searchLocation) ? '': queries1.searchLocation;
  const searchFrom = _.isNil(queries1.searchFrom) ? '': queries1.searchFrom;
  const searchTo = _.isNil(queries1.searchTo) ? '': queries1.searchTo;
  const sort = _.isNil(queries1.sort) ? 'id': _.isEmpty(queries1.sort) ? paginationSettings.sortColumn : queries1.sort;
  const limit = _.isNil(queries1.limit) ? paginationSettings.pageSize : _.isEmpty(queries1.limit) ? paginationSettings.pageSize : _.parseInt(queries1.limit);
  const offset = _.isNil(queries1.offset) ? paginationSettings.offset : _.isEmpty(queries1.offset) ? paginationSettings.offset : _.parseInt(queries1.offset);
  const order = _.isNil(queries1.order) ? paginationSettings.sortDirection : _.isEmpty(queries1.order) ? paginationSettings.sortDirection : queries1.order;
  return {
    searchCompany: searchCompany,
    searchStatus: searchStatus,
    searchLocation: searchLocation,
      searchFrom: searchFrom,
      searchTo: searchTo,
      sort: sort,
      limit: limit,
      offset: offset,
      order: order
  }
}
function getAvailableActions(assocaitesModels) {
    var availableActions = { update: true, delete: true};
    var isAssociated = _.some(assocaitesModels, x => x > 0);
    if (isAssociated) {
        availableActions.delete = false;
    }
    return availableActions
}

function getUser(model) {
    let manager = {};
    if (!_.isNil(model.user)) {
      manager.id = model.user.id
      manager.first_name = model.user.first_name
      manager.last_name = model.user.last_name
      manager.name = `${model.user.first_name} ${model.user.last_name}`
    }
    return manager;
  }

async function getSelectList(model, req, isUser) {
    const page = _.parseInt(req.query.page);
    const search = _.isNil(req.query.search) ? '' : req.query.search;
    const limit = selectListSettings.limit
    
    let attributes = []
    let  where = _.eq(model.name, 'group') ? {name: {
      [Op.like]: '%'+ search+'%'
    }, firm_id: req.userInfo.firmId} : {name: {
      [Op.like]: '%'+ search+'%'
    }, deleted_at: {[Op.eq]: null}, firm_id: req.userInfo.firmId}

    if (_.eq(model.name, 'ticketStatus')) {
      where = {name: {
        [Op.like]: '%'+ search+'%'
      }, deleted_at: {[Op.eq]: null}}
    }

    if (_.eq(model.name, 'asset')) {
      if(_.isNil(req.query.type))
      {
        where = {name: {
          [Op.like]: '%'+ search+'%'
        }, deleted_at: {[Op.eq]: null}, firm_id: req.userInfo.firmId}
      }
      else{
        where =  {name: { [Op.like]: '%'+ search+'%' },
                  assigned_to:{ [Op.eq]: null},
                  assigned_type:{ [Op.eq]: null},
                  deleted_at: {[Op.eq]: null}, 
                  firm_id: req.userInfo.firmId}

     
    }
     }

    let order = 'name'
    switch(model.name) {
      case 'user':
          attributes = ['id', 'first_name', 'last_name', 'username','email']  
          where = {username: {
            [Op.like]: '%'+ search+'%'
          }, deleted_at: {[Op.eq]: null}, firm_id: req.userInfo.firmId}
          order = 'username'
          break;
      case 'statusLabel':
      case 'depreciation':
      case 'customFieldset':
      case 'ticketIssue':
      case 'talentGroup':

      case 'severity':
      case 'group':
          attributes = ['id', ['name', 'text']]
          break;
      case 'ticketStatus':
        attributes = ['id', ['name', 'text'], 'type']
        break;
      case 'category':
        attributes = ['id', ['name', 'text'], 'category_type']
        break;
        default:
          attributes = selectListSettings.attributes
          break;
    }

    let result = await model.findAndCountAll({
        attributes: attributes,
        where: where,
        order: [
            [order, 'asc']
        ],
      });
      var response = []
      if (!_.isNil(result)) {
          _.map(result.rows, row => {
            response.push({id: row.id,
                text: _.isNil(isUser) ? row.dataValues.text : `${row.first_name} (${row.email})`,
                image: _.isNil(row.image) ? '' : row.image,
                category_type: _.eq(model.name, 'category') ? row.category_type: '',
                type: _.eq(model.name, 'ticketStatus') ? row.type: ''
            })
        })
      }
  const pageCount = _.ceil(result.count/limit);
  return { 
    total_count: result.count,
    page_count: pageCount,
    page: page,
    items: response,
    pagination: {
      more: page < pageCount ? true : false,
      per_page: limit
    }
  };
}

function getRelationalObject(relationalObject) {
    return _.isNil(relationalObject) ? {} : {id: relationalObject.id, name: relationalObject.name}
}

async function checkRequest(where, fields, model) {
  var errorMessages = await mandatoryCheck(fields)
  if (_.isEmpty(errorMessages) && !_.isEmpty(where)) {
    const isExists = await uniqueCheck(model, where)
    errorMessages = isExists ? constants.errorMessages.nameExists : ''
  }
  return errorMessages
}

async function mandatoryCheck(fields) {
  let errorMessages = ''
  _.map(fields, field => {
    // if (field.isMandatory && _.eq(field.type, constants.types.string) && _.isEmpty(field.name)) {
    if (field.isMandatory && _.isEmpty(field.name)) {
        errorMessages = concatErrormessages(field.mandatoryError, errorMessages)
    // } else if (field.isMandatory && _.eq(field.type, constants.types.int) && _.eq(field.name, '0')) {
    //   errorMessages = concatErrormessages(field.mandatoryError, errorMessages)
    }
    if (_.eq(field.type, 'int')) {
      if (!Number(field.name)) {
        errorMessages = concatErrormessages(field.lengthError, errorMessages)  
      } 
    }
    if (_.size(field.name) > field.length) {
      errorMessages = concatErrormessages(field.lengthError, errorMessages)
    }
  })
  return errorMessages
}

function concatErrormessages(message, errorMessage) {
  if (_.isEmpty(errorMessage)) {
    errorMessage = `${message}`
  } else {
    errorMessage = `${errorMessage}\n ${message}`
  }
  return errorMessage
}

async function uniqueCheck(model, where) {
  let isExists = false;
  let result = await model.findAndCountAll({
    where: where
  });

  if (_.size(result.rows) > 0)  
    isExists = true;
  return isExists
}

async function lengthCheck(lenCheckRequest) {
  let isExists = false;
  let result = await model.findAndCountAll({
    where: where
  });
  if (_.size(result.rows) > 0)  
    isExists = true;
  return isExists
}

async function encrypt(request) {
    const key = crypto.scryptSync(request.password, process.env.JWT_SECRET, 24);// crypto.randomBytes(32);
    const iv = Buffer.alloc(16, 0); 
    var cipher = crypto.createCipheriv('aes-192-cbc', key, iv)
    let encrypted = '';
    cipher.on('readable', () => { 
        let chunk; 
        while (null !== (chunk = cipher.read())) { 
          encrypted += chunk.toString('base64'); 
        } 
    }); 
    cipher.on('end', () => { 
      request.password = encrypted; 
    }); 
    cipher.end(); 
}

async function getUserInfo(user, userId) {
  let userInfo = await user.findOne({attributes: ['id', 'first_name', 'last_name', 'username'], where: {id: userId}})
  if (_.isNil(userInfo)) {
    userInfo = {}
  } else {
    userInfo.name = `${userInfo.first_name} ${userInfo.last_name}`
  }
  return userInfo
}

async function getItemType(req) {
  let type = {assigned_type: '', assigned_to: ''}
  const checkout_to_type = req.checkout_to_type
  if (_.eq(checkout_to_type, checkoutType.user)) {
    type.assigned_type = itemTypes.user
    type.assigned_to = req.assigned_user
  } else if (_.eq(checkout_to_type, checkoutType.asset)) {
    type.assigned_type = itemTypes.asset
    type.assigned_to = req.assigned_asset
  } else {
    type.assigned_type = itemTypes.location
    type.assigned_to = req.assigned_location
  }
  return type
}

function addCondition(query, where, queryObject) {
  if (!_.isNil(query)) {
    where.push(queryObject)
  }
  return where
}

async function sendMail(email, template, mailTemplateValues) {
  await sendTokenEmail(email, template, mailTemplateValues)
}

async function sendTokenEmail(to, templateName, mailTemplateValues) {
  // transport = nodemailer.createTransport(sibTransport({
  //   apiKey: process.env.EMAIL_KEY
  // }))
  const email = new Email({
    message: {
      from: process.env.EMAIL_USER,
    },
    preview: process.env.PREVIEW_EMAIL === 'true',
    send: process.env.SEND_EMAIL === 'true',
    //transport: transport
    transport: {
      // host: process.env.MAIL_HOST,
      // port: process.env.MAIL_PORT,
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    },
  })

  email
    .send({
      template: templateName,
      message: {
        to: to,
      },
      locals: mailTemplateValues,
    })
    .then((res) => {
      console.log('res.originalMessage', res.originalMessage)
    })
    .catch(err => {
      console.log(err)
    })
 }

async function getAdminSetting(setting, attributes) {
  let result = await setting.findOne({
    attributes: attributes
  });
  return result
}

async function updateAdminSetting(setting, req) {
  const id = _.parseInt(req.params.id)
  req.body.user_id = req.userInfo.userId;

  let result = await setting.update(req.body, {where: {id: id}});

  return result
}

function addFields(name, nameFieldLength, isMandatory, type, mandatoryError, lengthError) {
  return {
    name: name, 
    length: nameFieldLength,
    isMandatory: isMandatory,
    type: type, 
    mandatoryError: mandatoryError, 
    lengthError: lengthError
  }
}

async function getUserStatus(user, userId) {
  const response = await user.findOne({
    attributes: ['id', 'talent_group_id', 'user_type', 'availability_status'],
    where: {id: userId}
  })
  return response
}

module.exports = {
    formatDate: formatDate,
    createdUpdatedDateFormat: createdUpdatedDateFormat,
    queryRequest: queryRequest,
    queryRequest1: queryRequest1,
    getAvailableActions: getAvailableActions,
    getUser: getUser,
    getSelectList: getSelectList,
    getRelationalObject: getRelationalObject,
    encrypt: encrypt,
    uniqueCheck: uniqueCheck,
    getItemType: getItemType,
    getUserInfo: getUserInfo,
    addCondition: addCondition,
    getAdminSetting: getAdminSetting,
    updateAdminSetting: updateAdminSetting,
    mandatoryCheck: mandatoryCheck,
    checkRequest: checkRequest,
    addFields: addFields,
    getUserStatus: getUserStatus,
    sendMail: sendMail
};