const rateLimit = require("express-rate-limit");
const RedisStore = require('rate-limit-redis');


const redis = require('../database/redis');

const globalRateLimit = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 1000, // limit each IP to 50 requests per window Ms
    skipFailedRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
})

module.exports = {
    globalRateLimit
}