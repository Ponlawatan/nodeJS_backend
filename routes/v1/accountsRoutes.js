const express = require('express');
const router = express.Router();

//test update gitlab
const { getAccountRateLimiter, getAccountsRateLimiter, deleteAccountRateLimiter, deleteAccountsRateLimiter } = require('../../modules/ratelimit/accountRatelimiter');

const { changePassword, resetPassword, sendEmailVerification, sendPhoneVerification, verifyEmail, verifyPhone, verifyPhoneTemp, deactivateAccount, unverifyEmail, unverifyPhone, verifyRefreshTokenOTP, getOneAccount, getAllAccounts, deleteOneAccount, deleteAllAccounts , updateBusinessesByUserId} = require('../../controllers/accountsControllers');

const { verifyAccessToken, verifyRefreshToken } = require('../../middlewares/auth');

//? Change Password
router.patch("/password/change/:user", changePassword);

//? Reset Password
router.post("/password/reset/:email", resetPassword);

//? Send Email Verification
router.post("/verification/email/:email", verifyAccessToken, sendEmailVerification);

//? Send Phone Verification
router.post("/verification/phone/:phone", verifyAccessToken, sendPhoneVerification);

//? Verify Email
router.get("/verify/email", verifyEmail);

//? Verify Phone
router.post("/verify/phone", verifyAccessToken, verifyPhone);
router.post("/verify/phonetemp", verifyAccessToken, verifyPhoneTemp);

//? Deactivate Account
router.patch("/deactivate/:user", verifyAccessToken, deactivateAccount);

//? Unverify Email
router.patch("/unverify/email/:user", verifyAccessToken, unverifyEmail);

//? Unverify Phone
router.patch("/unverify/phone/:user", verifyAccessToken, unverifyPhone);

//? Verify Password
router.post("/refreshtokenotp/verify", verifyRefreshToken, verifyRefreshTokenOTP);

//? Get One Account
router.get("/:user", [getAccountRateLimiter, verifyAccessToken], getOneAccount);

router.get("/", [getAccountsRateLimiter, verifyAccessToken], getAllAccounts);

router.delete("/:user", [deleteAccountRateLimiter, verifyAccessToken], deleteOneAccount);

router.delete("/", [deleteAccountsRateLimiter, verifyAccessToken], deleteAllAccounts);

router.post("/udb0",  [deleteAccountsRateLimiter, verifyAccessToken], updateBusinessesByUserId);

module.exports = router;