const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const redis = require('../../app');

require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

const User = require("../../schemas/v1/user.schema");


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3111/api/v1/auth/google/callback",
    scope: ['profile'],
},
    function (accessToken, refreshToken, profile, cb) {

        User.findOne({ 'socials.google.userId': profile.id }).then(existingUser => {

            if (existingUser) {
                console.log(`login with Google and found user : ${existingUser}`);
                return cb(null, existingUser, { status: 'success', message: 'Existing user authenticated via Google.'});
            } else {
                
                new User({
                    userId: uuidv4(),
                    user: {
                        name: profile.displayName,
                        email: profile._json.email,
                        verified: {
                            email: profile._json.email_verified
                        },
                        activated: true
                    },
                    socials: {
                        google: {
                            userId: profile.id,
                            name: profile.displayName,
                            email: profile._json.email,
                            imageUrl: profile._json.picture
                        }
                    } 
                }).save().then(async newUser => {

                    return cb(null, newUser, { message: 'New user authenticated via Google.'});
                })
            }
            
        })
        
    }
));