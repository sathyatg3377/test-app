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
let audit=models.audit;



// router.put('/:id', async function (req, res, next) {  
//   console.log("put")
// req.body.updated_by = req.userInfo.userId;
// const id = _.parseInt(req.params.id);
// req.body.status="replied";
//   let result = await contactus.update(req.body, { where: { id: id } })
//     .then(function (result) {
//       return { success: true, message: "Updated successfully" }
//     }).catch(function (err) {
//       return { success: false, message: 'error' }
//     });

//   res.result = result;

// next()
// });


router.get('/', async function(req, res, next) {
    const queries = req.query;
   
   const {search, sort, limit, offset, order} = util.queryRequest(queries);

    let where = [{id: {
      [Op.like]: '%'+ search+'%'
    }
  }]
    let result = await audit.findAndCountAll({
          attributes: ['id', 'asset_tag','auditor_name','description','status_id','location','gps_coordinates','present_location','created_at','updated_at'],
         
      where: where,
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
  });


  //Create customer feedback
  router.post('/', async function(req, res, next) {
    req.body.auditor_name = req.userInfo.email
    //  if(req.body.status_id = "Audited")(
    //   req.body.status_id="1"
    //  )
    //  else(req.body.status_id = "Not Audited")(
    //   req.body.status_id="2"
    //  )
   // req.body.status_id = "Audited"
      let response = await audit.create(req.body)
      .then(function (result) {
        return {success:true,message:"Created successfully"}
      }).catch(function (err) {
        return {status: 'error',success:false}
      });
      res.result = response;
    
      next()
  }); 

 

  function formatResponse(row) {
    return  {
        id: row.id,
        asset_tag:row.asset_tag,
        auditor_name:row.auditor_name,
        description:row.description,

        status_id:row.status_id,

        location:row.location,

        gps_coordinates:row.gps_coordinates,
        present_location:row.present_location,
        created_at: util.createdUpdatedDateFormat(row.created_at),
        updated_at: util.createdUpdatedDateFormat(row.updated_at)


    }
  }

  module.exports = router;