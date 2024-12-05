const jwt = require("jsonwebtoken");
const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;
const JWT_REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_TOKEN_SECRET;
const SUPER_ADMIN_API_KEY = process.env.SUPER_ADMIN_API_KEY;
const redis = require("../app");

const { TokenExpiredError } = jwt;

const accessTokenCatchError = (err, res) => {
  if (err instanceof TokenExpiredError) {
    return res
      .status(401)
      .send({ message: "UNAUTHORIZED! Access Token was expired!" });
  }
  return res.status(401).send({ message: "UNAUTHORIZED!" });
};

const refreshTokenCatchError = (err, res) => {
  if (err instanceof TokenExpiredError) {
    return res
      .status(401)
      .send({ message: "UNAUTHORIZED! Refresh Token was expired!" });
  }
  return res.status(401).send({ message: "UNAUTHORIZED!" });
};

const verifyAccessToken = async (req, res, next) => {
  const role = req.headers["role"];

  if (role != "superadmin") {
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

    if (!req.headers["authorization"])
      return res.status(401).send({
        status: "error",
        message: "TOKEN is required for authentication",
      });
    const accessToken = req.headers["authorization"].replace("Bearer ", "");

    jwt.verify(accessToken, JWT_ACCESS_TOKEN_SECRET, async (err, decoded) => {
      if (err) {
        return accessTokenCatchError(err, res);
      } else {
        let MacAddressIsMember = await redis.sIsMember(
          `Mac_Address_${decoded.userId}`,
          req.headers["mac-address"]
        );
        let hardwareIdIsMember = await redis.sIsMember(
          `Hardware_ID_${decoded.userId}`,
          req.headers["hardware-id"]
        );

        if (!MacAddressIsMember && !hardwareIdIsMember) {
          return res.status(401).send({
            status: "error",
            message: "Both Mac Address AND Hardware ID does not exist!",
          });
        } else if (!MacAddressIsMember) {
          return res
            .status(401)
            .send({ status: "error", message: "Mac Address does not exist!" });
        } else if (!hardwareIdIsMember) {
          return res
            .status(401)
            .send({ status: "error", message: "Hardware ID does not exist!" });
        }
        const lastAccessToken = await redis.get(
          `Last_Access_Token_${decoded.userId}_${req.headers["hardware-id"]}`
        );
        if (lastAccessToken !== accessToken) {
          return res
            .status(401)
            .send({ status: "error", message: `Incorrect Access Token!` });
        }
      }
      req.user = decoded;
      return next();
    });
  } else {
    const superAdminApiKey = req.headers["x-super-admin-api-key"];
    if (
      superAdminApiKey &&
      superAdminApiKey === process.env.SUPER_ADMIN_API_KEY
    ) {
      console.log("you are in super admin mode : (from verifyAccessToken)");
      return next();
    } else {
      return res
        .status(403)
        .json({ message: "Unauthorized: Invalid API key for super admin" });
    }
  }
};

const verifyRefreshToken = (req, res, next) => {
  if (!req.headers["authorization"])
    return res.status(401).send({
      status: "error",
      message: "TOKEN is required for authentication",
    });

  const refreshToken = req.headers["authorization"].replace("Bearer ", "");
  const hardwareID = req.headers["hardware-id"];

  jwt.verify(refreshToken, JWT_REFRESH_TOKEN_SECRET, async (err, decoded) => {
    if (err) {
      return refreshTokenCatchError(err, res);
    } else {
      let savedRefreshToken = await redis.get(
        `Last_Refresh_Token_${decoded.userId}_${hardwareID}`,
        refreshToken
      );

      if (savedRefreshToken !== refreshToken) {
        return res
          .status(401)
          .send({ status: "error", message: "Incorrect Refresh Token!" });
      }

      req.user = decoded;
      return next();
    }
  });
};
const verifyAPIKey = (req, res, next) => {
  const apiKey = req.headers["authorization"];
  if (!apiKey) {
    return res
      .status(401)
      .json({ success: false, error: "API Key is required" });
  }
  // ตรวจสอบ API Key (ในที่นี้ใช้ค่าตายตัว ควรเปลี่ยนเป็นการตรวจสอบจากฐานข้อมูลหรือ env ในการใช้งานจริง)
  if (apiKey !== SUPER_ADMIN_API_KEY) {
    return res.status(403).json({ success: false, error: "Invalid API Key" });
  }
  next();
};

module.exports = { verifyAccessToken, verifyRefreshToken, verifyAPIKey };
