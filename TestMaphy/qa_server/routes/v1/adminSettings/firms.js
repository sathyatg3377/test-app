var express = require('express');
var router = express.Router();
var Sequelize = require("sequelize");
const Op = Sequelize.Op;
const models = require('../../../db/models/index');
var _ = require('lodash');
var util = require('../../../utils/index');
const constants = require('../../../shared/constants');
var {errorHandler} = require('../../../shared/error-handler')

var multer  = require('multer');
//const branding = require('../../../db/models/branding');
var imagepath=process.env.logopath;
var upload = multer({ dest: './public/data/uploads/' });
let branding = models.branding

router.put('/uploadLogo', upload.single('uploaded_file'), errorHandler(async function (req, res,next) {
    let branding = models.branding;
    const firm_id = _.parseInt(req.userInfo.firmId);
     var image_filename=req.file.filename;
     console.log("i f:",image_filename);
     req.body.created_by = req.userInfo.userId;
     req.body.updated_by = req.userInfo.userId;
     req.body.firm_id = req.userInfo.firmId;
     req.body.image=image_filename;
   //  let response = await branding.update(req.body)
     let response = await branding.update(req.body, { where: { firm_id: firm_id } })

     .then(function (result) {
       return{success:true,message:"Logo has been updated successfully"}
     }).catch(function (err) {
       return{success:false,message:'error'}
     });
     res.result = response;
     next();
     
}))
router.get('/getBrandingDetails', async function (req, res, next) {
  const queries = req.query;
  const { search, sort, limit, offset, order } = util.queryRequest(queries);
  let where = [{firm_id:req.userInfo.firmId }];
  let result = await branding.findAndCountAll({
      attributes: ['id',  'brandtype', 'site_name', 'image', 'created_by','updated_by'],
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

// router.get('/getBrandingDetails', async function(req, res, next) {
//   let result = await branding.findAll({
//        attributes: ['id', 'site_name','image' ] ,
//    where:  {firm_id: req.userInfo.firmId}
//      });
//      var response = []
//      if (!_.isNil(result)) {
//          _.map(result.rows, row => {
//            response.push(formatResponse(row))
//        })
//      }

//  res.json({ rows: response });
// });

function formatResponse(row) {
  var image=imagepath+row.image;
  // var image=row.image;
 return  {
     id: row.id,
     brandtype:row.brandtype,
     site_name:row.site_name,
     image:image,
    // created_at: util.createdUpdatedDateFormat(row.created_at),
     //updated_at: util.createdUpdatedDateFormat(row.updated_at),
    created_by:row.created_by,
    updated_by:row.updated_by,
   // firm_id:row.firm_id
    
 }
}

module.exports = router;