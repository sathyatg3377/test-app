var createError = require('http-errors');
var express = require('express');
var path = require('path');
var process = require('process')
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var jwt = require('jsonwebtoken')
var helmet = require('helmet')
var winstonLogger = require('./logger')
var winston = require('winston')
var expressWinston = require('express-winston')
var swaggerJsDoc = require('swagger-jsdoc')
var swaggerUi = require('swagger-ui-express')
require('dotenv').config()
var _ = require('lodash')
var cors = require('cors');

var indexRouter = require('./routes/index');
//var usersRouter = require('./routes/users');

var app = express();
app.use(cors());

app.use(expressWinston.logger({
    transports: [
        //new winston.transports.Console()
        new winston.transports.File({ filename: 'combined.log' })
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.json()
    ),
    meta: true, // optional: control whether you want to log the meta data about the request (default to true)
    msg: "HTTP {{req.method}} {{req.url}}", // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
    expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
    colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
    ignoreRoute: function(req, res) { return false; } // optional: allows to skip some log messages based on request and/or response
}));

//view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(function(req, res, next) {
    const urls = req.url.split('/')
    let url = ''
    if (_.includes(req.url, '/api-docs')) {
        url = 'api-docs'
    }
    if (_.eq(url, 'api-docs') ||
        _.eq(req.url, '/api/v1/users/login') ||
        _.eq(req.url, '/api/v1/users/generateotp') ||
        _.eq(req.url, '/api/v1/users/password/update') ||
        _.eq(req.url, '/api/v1/register/firms') ||
        _.eq(req.url, '/api/v1/contactus')) {
        next()
    } else {
        let authorization = ''
        if (_.includes(req.headers.referer, '/api-docs')) {
            authorization = process.env.TOKEN
        } else {
            authorization = req.headers['authorization']
        }
        var token = _.split(authorization, ' ')[1]
        if (token == null) return res.sendStatus(401)

        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) return res.sendStatus(403)
            req.userInfo = user
            if (_.eq(req.method, 'POST') || _.eq(req.method, 'PUT')) {
                req.body.firm_id = req.userInfo.firmId
            }
        })
        next()
    }
})

const swaggerOptions = {
    swaggerDefinition: {
        info: {
            title: 'Maphy API',
            description: 'Maphy route description'
        },
        "basePath": "/api/v1/",
    },
    apis: ['./routes/v1/*.js', './routes/v1/*/*.js']
}

const swaggerDocs = swaggerJsDoc(swaggerOptions)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs))

app.use('/api/v1/', indexRouter);
app.use('/api/v1/companies', require('./routes/v1/settings/companies'))
app.use('/api/v1/models', require('./routes/v1/settings/models'))
app.use('/api/v1/manufacturers', require('./routes/v1/settings/manufacturers'))
app.use('/api/v1/statuslabels', require('./routes/v1/settings/statusLabels'))
app.use('/api/v1/categories', require('./routes/v1/settings/categories'))
app.use('/api/v1/depreciations', require('./routes/v1/settings/depreciations'))
app.use('/api/v1/locations', require('./routes/v1/settings/locations'))
app.use('/api/v1/departments', require('./routes/v1/settings/departments'))
app.use('/api/v1/suppliers', require('./routes/v1/settings/suppliers'))
app.use('/api/v1/customfields', require('./routes/v1/settings/customFields'))
    //app.use('/api/v1/assets', require('./routes/v1/settings/assets'))
app.use('/api/v1/customFieldsets', require('./routes/v1/settings/customFieldsets'))
app.use('/api/v1/customFieldCustomFieldsets', require('./routes/v1/settings/customFieldCustomFieldsets'))
app.use('/api/v1/groups', require('./routes/v1/adminSettings/groups'))
app.use('/api/v1/licenses', require('./routes/v1/licenses'))
app.use('/api/v1/accessories', require('./routes/v1/accessories'))
app.use('/api/v1/consumables', require('./routes/v1/consumables'))
app.use('/api/v1/components', require('./routes/v1/components'))
app.use('/api/v1/kits', require('./routes/v1/kits'))
app.use('/api/v1/users', require('./routes/v1/users'))
app.use('/api/v1/hardware', require('./routes/v1/assets/hardware'))
app.use('/api/v1/maintenances', require('./routes/v1/maintenances'))
app.use('/api/v1/reports', require('./routes/v1/reports/'))
app.use('/api/v1/tickets', require('./routes/v1/tickets'))
app.use('/api/v1/admin', require('./routes/v1/admin'))
app.use('/api/v1/dashboard', require('./routes/v1/dashboard'))
app.use('/api/v1/talentGroups', require('./routes/v1/adminSettings/talentGroups'))
app.use('/api/v1/ticketIssues', require('./routes/v1/adminSettings/ticketIssues'))
app.use('/api/v1/severity', require('./routes/v1/adminSettings/severity'))
app.use('/api/v1/firms', require('./routes/v1/adminSettings/firms'))
app.use('/api/v1/labels', require('./routes/v1/adminSettings/labels'))
app.use('/api/v1/register/firms', require('./routes/v1/register/firm'))
app.use('/api/v1/contactus', require('./routes/v1/contactus'))
app.use('/api/v1/audit', require('./routes/v1/audit'))

app.use('/api/v1/workstatus', require('./routes/v1/workstatus'))
app.use('/api/v1/licenseNotifications', require('./routes/v1/adminSettings/licenseNotifications'))

app.use(function(req, res, next) {
    switch (req.method) {
        case 'POST':
            if (!_.eq(req.url, '/api/v1/users/login')) {
                var message = 'Created successfully'
                if (!_.isEmpty(res.result.error)) {
                    res.result = { message: res.result.error, success: false }
                } else {
                    res.result = { id: res.result.id, message: message, success: true }
                }
            }
            break;
        case 'PUT':
            var message = 'Updated successfully'
            var success = true
            if (!_.isEmpty(res.result.error)) {
                message = res.result.error
                success = false
            }
            const originalUrl = req.originalUrl
            if (!_.isNil(originalUrl)) {
                paths = _.split(originalUrl, '/')
                const isRestoreExists = _.some(paths, path => path === 'restore')
                message = isRestoreExists ? 'Restored successfully' : message
            }
            res.result = { message: message, success: success }
            break;
        case 'DELETE':
            res.result = { message: 'Deleted successfully', success: true }
            break;
        default:
            break;
    }

    res.send(res.result)
})

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

app.use(helmet())

const unhandledRejections = new Map();
process.on('unhandledRejection', (reason, promise) => {
    unhandledRejections.set(promise, reason);
    winstonLogger.logger.log({ level: 'error', message: reason.stack })
});
process.on('rejectionHandled', (promise) => {
    unhandledRejections.delete(promise);
});

app.use(expressWinston.errorLogger({
    transports: [
        //new winston.transports.Console()
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        //new winston.transports.File({ filename: 'combined.log' })
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.json()
    )
}));

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.json('error');
});

module.exports = app;