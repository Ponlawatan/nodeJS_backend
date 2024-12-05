const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const passport = require("passport");
const bodyParser = require("body-parser");
const { OAuth2Client } = require("google-auth-library");

require("../middlewares/passport/passport-local");
//require('../middlewares/passport/passport-jwt');
require("../middlewares/passport/passport-google");
require("../middlewares/passport/passport-line");

require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

const redis = require("../app");

const sendEmail = require("../modules/email/sendVerifyEmail");

const User = require("../schemas/v1/user.schema");
const user = require("../schemas/v1/user.schema");
const regularUserData = require("../schemas/v1/userData/regularUserData.schema");
const organizationUserData = require("../schemas/v1/userData/organizationUserData.schema");
const contactInfoSchema = require("../schemas/v1/contact.schema");
const addressSchema = require("../schemas/v1/address.schema");

const register = async (req, res) => {
  if (!req.body) {
    res
      .status(400)
      .send({ status: "error", message: "Body can not be empty!" });
    return;
  }

  if (!req.body.name) {
    res
      .status(400)
      .send({ status: "error", message: "Name can not be empty!" });
    return;
  }

  if (!req.body.email) {
    res
      .status(400)
      .send({ status: "error", message: "Email can not be empty!" });
    return;
  }

  if (!req.body.password) {
    res
      .status(400)
      .send({ status: "error", message: "Password can not be empty!" });
    return;
  }

  const businessId = req.headers["businessid"];
  if (!businessId) {
    res
      .status(400)
      .send({ status: "error", message: "Business ID can not be empty!" });
    return;
  }

  try {
    let findUser = await user.findOne({
      "user.email": req.body.email,
      businessId: businessId,
    });

    let rawPassword = req.body.password;
    let hashedPassword = await bcrypt.hash(rawPassword, 10);

    let generatedUserId = uuidv4();

    let email = req.body.email;

    let userType = req.body.userType ? req.body.userType : "regular";
    let userData = req.body.userData ? req.body.userData : {};

    if (!findUser) {
      let userDataDocument;
      let userTypeDataValue =
        userType === "regular" ? "RegularUserData" : "OrganizationUserData";

      if (userType === "regular") {
        userDataDocument = new regularUserData(userData);
      } else if (userType === "Organization") {
        userDataDocument = new organizationUserData(userData);
      }
      await userDataDocument.save(); // บันทึก userData

      new user({
        user: {
          name: req.body.name,
          email: req.body.email,
          password: hashedPassword,
        },
        userType: userType,
        userData: userDataDocument._id,
        userTypeData: userTypeDataValue,
        businessId: businessId,
      })
        .save()
        .then(async (user) => {
          let activationToken = crypto.randomBytes(32).toString("hex");
          let refKey = crypto.randomBytes(2).toString("hex").toUpperCase();

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

          await sendEmail(email, "Verify Email For Healworld.me", link);

          res.status(201).send({
            status: "success",
            message: "Successfully Registered! Please confirm email address.",
            data: {
              ...user.toObject(),
              userId: user._id,
            },
          });
        })
        .catch((err) =>
          res.status(500).send({
            status: "error",
            message:
              err.message || "Some error occurred while registering user.",
          })
        );
    } else {
      res.status(409).send({
        status: "error",
        message: "User already existed. Please Login instead",
      });
    }
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .send({ status: "error", message: "Internal server error." });
  }
};

const login = async (req, res, next) => {
  console.log("login function");

  if (!req.headers["device-fingerprint"]) {
    return res
      .status(401)
      .send({ status: "error", message: "Device fingerprint is required!" });
  }

  const deviceFingerprint = req.headers["device-fingerprint"];
  const businessId = req.headers["businessid"];

  if (!businessId) {
    return res
      .status(400)
      .send({ status: "error", message: "Business ID is required!" });
  }

  passport.authenticate(
    "local",
    { session: false },
    async (err, foundUser, info) => {
      console.log(`login : ${foundUser}`);
      if (err) return next(err);

      if (foundUser) {
        console.log("login : found user");

        const loggedInDevices = foundUser.loggedInDevices || [];
        if (loggedInDevices.length >= 50) {
          return res
            .status(403)
            .send({ status: "error", message: "Login limit exceeded." });
        }

        const foundUserEmail = foundUser.user.email;
        const foundUserId = foundUser.userId;

        const accessToken = jwt.sign(
          {
            userId: foundUserId,
            name: foundUser.user.name,
            email: foundUserEmail,
            businessId: businessId,
          },
          process.env.JWT_ACCESS_TOKEN_SECRET,
          { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
        );
        const refreshToken = jwt.sign(
          {
            userId: foundUserId,
            name: foundUser.user.name,
            email: foundUserEmail,
            businessId: businessId,
          },
          process.env.JWT_REFRESH_TOKEN_SECRET,
          { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
        );
        await redis.sAdd(
          `Device_Fingerprint_${foundUserId}`,
          deviceFingerprint
        );

        redis.set(`Last_Login_${foundUserId}_${deviceFingerprint}`, Date.now());

        let length = 6,
          charset = "0123456789",
          refreshTokenOTP = "";
        for (let i = 0, n = charset.length; i < length; ++i) {
          refreshTokenOTP += charset.charAt(Math.floor(Math.random() * n));
        }

        redis.set(
          `Last_Refresh_Token_OTP_${foundUserId}_${deviceFingerprint}`,
          refreshTokenOTP
        );
        redis.set(
          `Last_Refresh_Token_${foundUserId}_${deviceFingerprint}`,
          refreshToken
        );
        redis.set(
          `Last_Access_Token_${foundUserId}_${deviceFingerprint}`,
          accessToken
        );

        const deviceIndex = loggedInDevices.findIndex(
          (device) => device.deviceFingerprint === deviceFingerprint
        );

        if (deviceIndex === -1) {
          await User.updateOne(
            { _id: foundUser._id },
            {
              $push: {
                loggedInDevices: {
                  deviceFingerprint: deviceFingerprint,
                  lastLogin: Date.now(),
                },
              },
            }
          );
        } else {
          loggedInDevices[deviceIndex].lastLogin = Date.now();
          await User.updateOne(
            { _id: foundUser._id },
            { $set: { loggedInDevices: loggedInDevices } }
          );
        }

        res.status(200).send({
          status: "success",
          message: "Successfully Login",
          data: {
            userId: foundUser._id,
            user: {
              name: foundUser.user.name,
              email: foundUserEmail,
              phone: foundUser.user.phone,
              activated: foundUser.user.activated,
              verified: {
                email: foundUser.user.verified.email,
                phone: foundUser.user.verified.phone,
              },
            },
            imageURL: foundUser.user.imageURL,
            tokens: {
              accessToken: accessToken,
              refreshToken: refreshToken,
              refreshTokenOTP: refreshTokenOTP,
            },
          },
        });
      } else {
        console.log("login error");
        return res
          .status(info.statusCode)
          .send({ status: "error", message: info.message });
      }
    }
  )(req, res, next);
};

const logout = async (req, res, next) => {
  console.log("logout function");

  if (!req.headers["device-fingerprint"]) {
    return res
      .status(401)
      .send({ status: "error", message: "Device fingerprint is required!" });
  }

  const deviceFingerprint = req.headers["device-fingerprint"];
  const businessId = req.headers["businessid"];

  if (!businessId) {
    return res
      .status(400)
      .send({ status: "error", message: "Business ID is required!" });
  }

  const userId = req.user.userId; // assuming req.user contains authenticated user data

  try {
    // Find user by userId
    const foundUser = await User.findById(userId);

    if (!foundUser) {
      return res
        .status(404)
        .send({ status: "error", message: "User not found" });
    }

    // Remove device from loggedInDevices
    const updatedDevices = foundUser.loggedInDevices.filter(
      (device) => device.deviceFingerprint !== deviceFingerprint
    );

    // Update user with filtered devices
    await User.updateOne(
      { _id: foundUser._id },
      { $set: { loggedInDevices: updatedDevices } }
    );

    // Remove related data from Redis
    await redis.sRem(`Device_Fingerprint_${userId}`, deviceFingerprint);
    await redis.del(`Last_Login_${userId}_${deviceFingerprint}`);
    await redis.del(`Last_Refresh_Token_OTP_${userId}_${deviceFingerprint}`);
    await redis.del(`Last_Refresh_Token_${userId}_${deviceFingerprint}`);
    await redis.del(`Last_Access_Token_${userId}_${deviceFingerprint}`);

    res.status(200).send({
      status: "success",
      message: "Successfully Logged Out",
    });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  //console.log('req.user', req.user);

  const accessToken = jwt.sign(
    {
      userId: req.user.userId,
      name: req.user.name,
      email: req.user.email,
      businessId: req.user.businessId,
    },
    process.env.JWT_ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
  );
  redis.set(
    `Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`,
    accessToken
  );

  //const foundUser = await user.findOneAndUpdate({ userId: req.user.userId }, { 'user.token': accessToken }, { useFindAndModify: false, new: true });

  return res.status(200).send({
    status: "success",
    message: "New access token has been generated",
    data: {
      user: {
        userId: req.user.userId,
        name: req.user.name,
        email: req.user.email,
        businessId: req.user.businessId,
      },
      tokens: {
        accessToken: accessToken,
        //refreshToken: foundUser.user.token
      },
    },
  });
};

const googleCallback = async (req, res, next) => {
  res
    .status(200)
    .send({ status: "success", message: req.authInfo, user: req.user });
};

/*User.findOne({ 'socials.google.userId': profile.id }).then(existingUser => {

    if (existingUser) {
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
    
})  */

const googleFlutterLogin = async (req, res) => {
  //return res.status(200).send({ status: 'success', message: 'Line Authenticated', user: req.user })
  let macAddressRegex = new RegExp(
    /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})|([0-9a-fA-F]{4}.[0-9a-fA-F]{4}.[0-9a-fA-F]{4})$/
  );

  if (!req.headers["mac-address"])
    return res
      .status(401)
      .send({ status: "error", message: "MAC address is required!" });

  if (!req.headers["hardware-id"])
    return res
      .status(401)
      .send({ status: "error", message: "Hardware ID is required!" });

  if (macAddressRegex.test(req.headers["mac-address"]) === false)
    return res
      .status(401)
      .send({ status: "error", message: "MAC address is invalid!" });

  const hardwareId = req.headers["hardware-id"];

  const { token } = req.body;
  console.log("token = " + token);
  console.log("CLIENT_ID = " + CLIENT_ID);
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    console.log("....... about to payload");
    const payload = ticket.getPayload();

    console.log("payload = " + JSON.stringify(payload, null, 2));

    let newUserId = uuidv4();
    let foundUser;
    let email = payload["email"];

    user.findOne({ "user.email": email }).then((existingUser) => {
      if (existingUser) {
        console.log(existingUser);
        if (existingUser.user.activated === false) {
          let activationToken = crypto.randomBytes(32).toString("hex");
          let refKey = crypto.randomBytes(2).toString("hex").toUpperCase();
          redis.hSet(
            email,
            {
              token: activationToken,
              ref: refKey,
            },
            { EX: 600 }
          );
          redis.expire(email, 600);

          const link = `${process.env.BASE_URL}/api/v1/accounts/verify/email?email=${email}&ref=${refKey}&token=${activationToken}`;

          sendEmail(email, "Verify Email For Healworld.me", link);

          //return res.status(406).send(null, false, { statusCode: 406, message: 'Email has not been activated. Email activation has been sent to your email. Please activate your email first.' })

          return res.status(406).send({
            message:
              "Email has not been activated. Email activation has been sent to your email. Please activate your email first.",
          });
        } else {
          const foundUser = existingUser;
          const foundUserEmail = foundUser.user.email;
          const foundUserId = foundUser.userId;

          //? JWT
          const accessToken = jwt.sign(
            {
              userId: foundUserId,
              name: foundUser.user.name,
              email: foundUserEmail,
            },
            process.env.JWT_ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
          );
          const refreshToken = jwt.sign(
            {
              userId: foundUserId,
              name: foundUser.user.name,
              email: foundUserEmail,
            },
            process.env.JWT_REFRESH_TOKEN_SECRET,
            { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
          );
          redis.sAdd(`Mac_Address_${foundUserId}`, req.headers["mac-address"]);
          redis.sAdd(`Hardware_ID_${foundUserId}`, req.headers["hardware-id"]);

          //? Add Last Login Date to Redis
          redis.set(`Last_Login_${foundUserId}_${hardwareId}`, Date.now());

          //? Add Refresh Token OTP to Redis

          let length = 6,
            charset = "0123456789",
            refreshTokenOTP = "";
          for (let i = 0, n = charset.length; i < length; ++i) {
            refreshTokenOTP += charset.charAt(Math.floor(Math.random() * n));
          }

          redis.set(
            `Last_Refresh_Token_OTP_${foundUserId}_${hardwareId}`,
            refreshTokenOTP
          );
          redis.set(
            `Last_Refresh_Token_${foundUserId}_${hardwareId}`,
            refreshToken
          );
          redis.set(
            `Last_Access_Token_${foundUserId}_${hardwareId}`,
            accessToken
          );

          res.status(200).send({
            status: "success",
            message: "Successfully Login",
            data: {
              userId: foundUser._id,
              user: {
                name: foundUser.user.name,
                email: foundUserEmail,
                phone: foundUser.user.phone,
                activated: foundUser.user.activated,
                verified: {
                  email: foundUser.user.verified.email,
                  phone: foundUser.user.verified.phone,
                },
              },
              imageURL: foundUser.user.imageURL,
              tokens: {
                accessToken: accessToken,
                refreshToken: refreshToken,
                refreshTokenOTP: refreshTokenOTP,
              },
            },
          });
        }
      } else {
        
        let userType = req.body.userType ? req.body.userType : "regular";
        let userData = req.body.userData ? req.body.userData : {};

        let userDataDocument;
        let userTypeDataValue =
          userType === "regular" ? "RegularUserData" : "OrganizationUserData";

        if (userType === "regular") {
          userDataDocument = new regularUserData(userData);
        } else if (userType === "Organization") {
          userDataDocument = new organizationUserData(userData);
        }
        userDataDocument.save(); // บันทึก userData

        
        new user({
          user: {
            name: payload["name"],
            email: payload["email"],
            password: uuidv4(),
          },
          userType: "regular",
          userData: userDataDocument._id,
          userTypeData: userTypeDataValue,
          businessId: "1",
        })
          .save()
          .then(async (user) => {
            let activationToken = crypto.randomBytes(32).toString("hex");
            let refKey = crypto.randomBytes(2).toString("hex").toUpperCase();

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

            await sendEmail(email, "Verify Email For Healworld.me", link);

            res.status(201).send({
              status: "success",
              message: "Successfully Registered! Please confirm email address.",
              data: {
                ...user.toObject(),
                userId: user._id,
              },
            });
          })
          .catch((err) =>
            res.status(500).send({
              status: "error",
              message:
                err.message || "Some error occurred while registering user.",
            })
          );
      }
    });
  } catch (error) {
    console.log(error);
    res.status(401).send("Invalid token");
  }
};

const lineCallback = async (req, res) => {
  //console.log('Request Profile',req.user)
  res
    .status(200)
    .send({ status: "success", message: "Line Authenticated", user: req.user });
};

module.exports = {
  register,
  login,
  logout,
  refresh,
  googleCallback,
  lineCallback,
  googleFlutterLogin,
};
