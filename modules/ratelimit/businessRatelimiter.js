const rateLimit = require("express-rate-limit");
const RedisStore = require('rate-limit-redis');


const redis = require('../database/redis');

const createBusinessRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 1000, // limit each IP to 5 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});

const addRoleToBusinessRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 1000, // limit each IP to 10 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});

const addEmployeeToBusinessRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 1000, // limit each IP to 10 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});

const removeEmployeeFromBusinessRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 1000, // limit each IP to 5 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});

const getBusinessRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 1000, // limit each IP to 5 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});

const getBusinessesRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 1000, // limit each IP to 5 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});

const deleteBusinessRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 1000, // limit each IP to 3 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});

const deleteBusinessesRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 1000, // limit each IP to 3 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});

module.exports = {
    createBusinessRateLimiter, addRoleToBusinessRateLimiter, addEmployeeToBusinessRateLimiter, removeEmployeeFromBusinessRateLimiter, getBusinessRateLimiter, getBusinessesRateLimiter, deleteBusinessRateLimiter, deleteBusinessesRateLimiter
}