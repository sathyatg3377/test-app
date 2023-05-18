var express = require('express');
var router = express.Router();
var Sequelize = require("sequelize");
const models = require('../../db/models/index');
var _ = require('lodash');
const constants = require('../../shared/constants');
const { errorHandler } = require('../../shared/error-handler');
const { sum } = require('lodash');

router.get('/', errorHandler(async function (req, res, next) {

    const company = models.company;
    const licenseNotifications = models.licenseNotifications;
    const firmId = req.userInfo.firmId;
    const licenseExpiryDiff = await licenseNotifications.findOne({
        raw:true,
        attributes: ['no_of_days'
        ], where: { firm_id: req.userInfo.firmId }
    });

    //console.log("licenseExpiryDifflicenseExpiryDiff:",licenseExpiryDiff.no_of_days);
    let result = await company.findOne({
        attributes: ['id',
            [Sequelize.literal('(SELECT COUNT(*) FROM `accessories` where firm_id=' + firmId + ' and deleted_at is null)'), 'accessoriesCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `assets` where firm_id=' + firmId + ' and deleted_at is null)'), 'assetsCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `consumables` where firm_id=' + firmId + ' and deleted_at is null)'), 'consumablesCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `licenses` where firm_id=' + firmId + ' and deleted_at is null)'), 'licensesCount'],
            [Sequelize.literal('(SELECT COUNT(*) from `licenses` where firm_id=' + firmId + ' and deleted_at is null and datediff(expiration_date,curdate())<0)'),'licenseExpiredCount'],
            [Sequelize.literal('(SELECT COUNT(*) from `licenses` where firm_id=' + firmId + ' and deleted_at is null and datediff(expiration_date,curdate()) >0 and datediff(expiration_date,curdate())< '+licenseExpiryDiff.no_of_days+')'),'LicensesGoingToExpired'],
        ], where: { firm_id: req.userInfo.firmId }
    });
    var response = {}
    if (!_.isNil(result)) {
        response = {
            accessoriesCount: result.dataValues.accessoriesCount,
            assetsCount: result.dataValues.assetsCount,
            consumablesCount: result.dataValues.consumablesCount,
            licensesCount: result.dataValues.licensesCount,
            licenseExpiredCount:result.dataValues.licenseExpiredCount,
            LicensesGoingToExpired:result.dataValues.LicensesGoingToExpired,
        }
    }

    res.json(response);
}))
router.get('/assets', errorHandler(async function (req, res, next) {
    const asset = models.asset;
       const firmId = req.userInfo.firmId
    let result = await asset.findOne({
        attributes: ['id',
            [Sequelize.literal('(SELECT SUM(purchase_cost) FROM `assets` where firm_id=' + firmId + ' and deleted_at is null)'), 'TotalAssetCost'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `assets` where firm_id=' + firmId + ' and deleted_at is null)'), 'assetsCount'],
                   ], where: { firm_id: req.userInfo.firmId }
    });
    var response = {}
    if (!_.isNil(result)) {
        response = {
            TotalAssetCost: result.dataValues.TotalAssetCost,
            assetsCount: result.dataValues.assetsCount,
                  }
    }

    res.json(response);
}))

// router.get('/chart/licenses', errorHandler(async function (req, res, next) {
//     const licenseSeat = models.licenseSeat;
//     const firmId = req.userInfo.firmId
//     let result = await licenseSeat.findOne({
//         attributes: ['id',
//             [Sequelize.literal('(SELECT COUNT(*) FROM `license_seats` where firm_id=' + firmId + ' and deleted_at is null)'), 'TotalCount'],
//             [Sequelize.literal('(SELECT COUNT(*) FROM `license_seats` where firm_id=' + firmId + ' and assigned_to is null)'), 'AvailabilityCount']

//         ], where: { firm_id: req.userInfo.firmId }
//     });
//     var response = {}
//     if (!_.isNil(result)) {
//         response = {

//             TotalSeats: result.dataValues.TotalCount,
//             AvailableSeats: result.dataValues.AvailabilityCount,
//             AssignedSeats: ( result.dataValues.TotalCount)-(result.dataValues.AvailabilityCount)

//         }
//     }

//     res.json(response);
// }))
// router.get('/chart/users', errorHandler(async function (req, res, next) {
//     const user = models.user;
//     const firmId = req.userInfo.firmId
//     let result = await user.findOne({
//         attributes: ['id',
//             [Sequelize.literal('(SELECT COUNT(*) FROM `users` where firm_id=' + firmId + ' and `users`.`user_type`=' + 1 + ')'), 'TotalTechnician'],
//             [Sequelize.literal('(SELECT COUNT(*) FROM `users` where firm_id=' + firmId + ' and `users`.`user_type`=' + 2 + ')'), 'TotalManager'],
//             [Sequelize.literal('(SELECT COUNT(*) FROM `users` where firm_id=' + firmId + ' and user_type is null)'), 'TotalEndUser']

//         ], where: { firm_id: req.userInfo.firmId }
//     });
//     var response = {}
//     if (!_.isNil(result)) {
//         response = {

//             Technician: result.dataValues.TotalTechnician,
//             Manager: result.dataValues.TotalManager,
//             User: result.dataValues.TotalEndUser

//         }
//     }

//     res.json(response);
// }))
router.get('/chart', errorHandler(async function (req, res, next) {
 
    const asset = models.asset;
    const statusLabel = models.statusLabel;

    const statusLabels = await statusLabel.findAll()
    let deployedId, deployableId
    let deployedStatusLabel = _.find(statusLabels, label => label.archived === true)
    if (!_.isNil(deployedStatusLabel)) {
        deployedId = deployedStatusLabel.id
    }
    let deployableStatusLabel = _.find(statusLabels, label => label.deployable === true)
    if (!_.isNil(deployableStatusLabel))
        deployableId = deployableStatusLabel.id

    let result = await asset.findOne({
        attributes: ['id',
            [Sequelize.literal('(SELECT COUNT(*) FROM `assets` where `assets`.`status_id`)'), 'assetsCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `assets` where `assets`.`status_id`=' + deployedId + ')'), 'deployedCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `assets` where `assets`.`status_id`=' + deployableId + ')'), 'deployableCount'],
        ], where: { firm_id: req.userInfo.firmId }
    });
    var response = {}
    if (!_.isNil(result)) {
        response = {
            deployedCount: result.dataValues.deployedCount,
            deployableCount: result.dataValues.deployableCount,
            undeployedCount: result.dataValues.assetsCount - (result.dataValues.deployedCount + result.dataValues.deployableCount)
        }
    }

    res.json(response);
}))



router.get('/chart/tickets', errorHandler(async function (req, res, next) {
    const ticket = models.ticket;
    const ticketStatus = models.ticketStatus;

    const ticket_Status = await ticketStatus.findAll();
    console.log("in tickets chart")
    let openId, inProgressId, closeId, escalateId, holdId, sistetTicketId, reassignId;

    // openId=ticket_Status.name
    let openStatus = _.find(ticket_Status, function (status) { return status.name == "Open" });
    if (!_.isNil(openStatus)) {
        openId = openStatus.id
    }
    let inProgressStatus = _.find(ticket_Status, function (status) { return status.name == "Inprogress" })
    if (!_.isNil(inProgressStatus)) {
        inProgressId = inProgressStatus.id
    }

    let closeStatus = _.find(ticket_Status, function (status) { return status.name == "Close" })
    if (!_.isNil(closeStatus)) {
        closeId = closeStatus.id
    }

    let escalateStatus = _.find(ticket_Status, function (status) { return status.name == "Escalate" })
    if (!_.isNil(escalateStatus)) {
        escalateId = escalateStatus.id
    }

    let holdStatus = _.find(ticket_Status, function (status) { return status.name == "Hold" })
    if (!_.isNil(holdStatus))
        holdId = holdStatus.id

    let sisterTicketStatus = _.find(ticket_Status, function (status) { return status.name == "Sister Ticket" })
    if (!_.isNil(sisterTicketStatus))
        sistetTicketId = sisterTicketStatus.id

    let reassignStatus = _.find(ticket_Status, function (status) { return status.name == "Reassign" })
    if (!_.isNil(reassignStatus))
        reassignId = reassignStatus.id
    console.log("cjadfh");
    let result = await ticket.findOne({
        attributes: ['id',
            [Sequelize.literal('(SELECT COUNT(*) FROM `tickets` where `tickets`.`status_id`)'), 'ticketsCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `tickets` where `tickets`.`status_id`=' + openId + ')'), 'openCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `tickets` where `tickets`.`status_id`=' + inProgressId + ')'), 'inProgressCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `tickets` where `tickets`.`status_id`=' + closeId + ')'), 'closeCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `tickets` where `tickets`.`status_id`=' + escalateId + ')'), 'escalateCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `tickets` where `tickets`.`status_id`=' + holdId + ')'), 'holdCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `tickets` where `tickets`.`status_id`=' + sistetTicketId + ')'), 'sisterTicketCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM `tickets` where `tickets`.`status_id`=' + reassignId + ')'), 'reassignCount'],
        ], where: { firm_id: req.userInfo.firmId }
    });
    var response = {}
    if (!_.isNil(result)) {
        response = {
            openCount: result.dataValues.openCount,
            inProgressCount: result.dataValues.inProgressCount,
            closeCount: result.dataValues.closeCount,
            escalateCount: result.dataValues.escalateCount,
            sisterTicketCount: result.dataValues.sisterTicketCount,
            reassignCount: result.dataValues.reassignCount,
            holdCount: result.dataValues.holdCount
        }
    }

    res.json(response);
}))
module.exports = router;
