const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

const User = require("../../schemas/v1/user.schema");


passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_ACCESS_TOKEN_SECRET,
}, async function (jwt_payload, cb) {

    return User.findOne({ userId: jwt_payload.userId }).then(existingUser => {

        if (existingUser) {

            if (Date.now() >= jwt_payload.exp) {
                return cb(null, existingUser);
            } else {
                return cb(null, false, { message: 'JWT Token Invalid or Expired'})
            }

            
        } else {
            return cb(null, false, { message: 'User Not Found.'})
        }

        
    }).catch(error => {
        return cb(error);
    })
}
    

));