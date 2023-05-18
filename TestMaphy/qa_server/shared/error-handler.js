var _ = require('lodash')

const errorHandler = func => (req, res, next) => {
    Promise.resolve(func(req, res, next)).catch((err) => {
    next(err)
    })
}

module.exports = {
    errorHandler: errorHandler
}