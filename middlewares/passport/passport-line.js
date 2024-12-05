const passport = require('passport');
const LineStrategy = require('passport-line').Strategy;
const { v4: uuidv4 } = require('uuid');

const redis = require('../../app');

require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

const User = require("../../schemas/v1/user.schema");


passport.use(new LineStrategy({
    channelID: process.env.LINE_CHANNEL_ID,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    callbackURL: "http://localhost:3111/api/v1/auth/line/callback",
    session: false,
    scope: ['profile', 'openid', 'email'],
    botPrompt: 'normal',
    uiLocales: 'en-US',
},
    function (accessToken, refreshToken, profile, cb) {

        
        User.findOne({ 'socials.line.userId': profile.id}).then(existingUser => {

            if (existingUser) {

                User.findOneAndUpdate({ 'socials.line.userId': profile.id}, {
                    name: profile.displayName,
                    email: profile.email ? profile.email : undefined,
                    socials: {
                        line: {
                            userId: profile.id,
                            name: profile.displayName,
                            email: profile.email ? profile.email : undefined,
                            imageUrl: profile.pictureUrl ? profile.pictureUrl : undefined
                        }
                    }
                }, { useFindAndModify: false, new: true }).then(async updatedExistingUser => {
                    return cb(null, updatedExistingUser, { status: 'success', message: 'Existing user authenticated via Line.'});
                })
                
            } else {
                
                new User({
                    userId: uuidv4(),
                    user: {
                        name: profile.displayName,
                        email: profile.email ? profile.email : undefined,
                        verified: {
                            email: true
                        },
                        activated: true
                    },
                    socials: {
                        line: {
                            userId: profile.id,
                            name: profile.displayName,
                            email: profile.email ? profile.email : undefined,
                            imageUrl: profile.pictureUrl ? profile.pictureUrl : undefined
                        }
                    }
                }).save().then(async newUser => {

                    return cb(null, newUser, {  status: 'success', message: 'New user authenticated via Line.'});

                })

            }

        })

    }
));