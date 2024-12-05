const express = require("express");
const router = express.Router();
const passport = require("passport");

const {
  registerRateLimiter,
  loginRateLimiter,
} = require("../../modules/ratelimit/authRatelimiter");

const {
  register,
  login,
  logout,
  refresh,
  dashboard,
  googleCallback,
  lineCallback,
  googleFlutterLogin,
} = require("../../controllers/authControllers");

const {
  verifyAccessToken,
  verifyRefreshToken,
} = require("../../middlewares/auth");

//? Register
router.post("/register", registerRateLimiter, register);

//? Login
router.post("/login", loginRateLimiter, login);

//? Logout
router.post("/logout", loginRateLimiter, logout);

router.post("/refresh", verifyRefreshToken, refresh);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleCallback
);

router.post("/google", loginRateLimiter, googleFlutterLogin);

router.get("/line", passport.authenticate("line", { session: false }));

router.get(
  "/line/callback",
  passport.authenticate("line", { session: false }),
  lineCallback
);

module.exports = router;
