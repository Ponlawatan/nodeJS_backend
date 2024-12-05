const bcrypt = require("bcrypt");
const crypto = require("crypto");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

const redis = require("../../app");

const sendEmail = require("../../modules/email/sendVerifyEmail");

const User = require("../../schemas/v1/user.schema");

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
      passReqToCallback: true, // เพิ่ม passReqToCallback เพื่อให้สามารถเข้าถึง request object
      session: false,
    },
    async (req, email, password, cb) => {
      const businessId = req.headers["businessid"];
      if (!businessId) {
        console.log("400 : Business ID is required!");
        return cb(null, false, {
          statusCode: 400,
          message: "Business ID is required!",
        });
      }

      return await User.findOne({ "user.email": email, businessId: businessId })
        .then(async (existingUser) => {
          if (existingUser) {
            if (!existingUser.user.password) {
              console.log("403 : Incorrect credentials (1)");
              return cb(null, false, {
                statusCode: 403,
                message: "Incorrect credentials.",
              });
            }

            if (!(await bcrypt.compare(password, existingUser.user.password))) {
              console.log("403 : Incorrect credentials (2)");
              return cb(null, false, {
                statusCode: 403,
                message: "Incorrect credentials.",
              });
            } else {
              if (existingUser.user.activated === false) {
                let activationToken = crypto.randomBytes(32).toString("hex");
                let refKey = crypto
                  .randomBytes(2)
                  .toString("hex")
                  .toUpperCase();

                await redis.hSet(
                  email,
                  {
                    token: activationToken,
                    ref: refKey,
                  },
                  { EX: 600 }
                );
                await redis.expire(email, 600);

                const link = `${process.env.BASE_URL}/api/v1/accounts/verify/email?email=${email}&ref=${refKey}&token=${activationToken}`;
                console.log("link =", link);
                await sendEmail(email, "Verify Email For JaideePOS", link);
                
                console.log("406 : Email has not been activated.");
                return cb(null, false, {
                  statusCode: 406,
                  message:
                    "Email has not been activated. Email activation has been sent to your email. Please activate your email first.",
                });

                //return res.status(406).send({ message: 'Email has not been activated. Email activation has been sent to your email. Please activate your email first.' });
              } else {
                let checkResetPassword = await redis.get(
                  `${email}-resetPassword`
                );

                if (checkResetPassword) {
                  return cb(null, false, {
                    statusCode: 200,
                    message: "Please change your password.",
                  });
                }

                return cb(null, existingUser);
                /*
                        else {
                            return cb(null, false, { statusCode: 200, message:  'Successfully logged In', user: {
                                userId: existingUser.userId, name: existingUser.user.name, email: existingUser.user.email, token: existingUser.user.token
                            }})
                            
                        }
                        */
              }
            }
          } else {
            console.log("404 : User not found.");
            return cb(null, false, {
              statusCode: 404,
              message: "User not found.",
            });
          }
        })
        .catch((error) => {
          console.log("Catched Error");
          cb(error);
        });
    }
  )
);
