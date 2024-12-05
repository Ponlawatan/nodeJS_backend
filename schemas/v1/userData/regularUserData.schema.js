const mongoose = require("mongoose");
//import mongoose from 'mongoose';
const contactInfoSchema = require("../contact.schema");
const addressSchema = require("../address.schema");

const regularUserDataSchema = new mongoose.Schema({
  businessId: { type: String },
  gender: {
    type: String,
    enum: ["male", "female", "other", null],
    default: null,
  },
  nationality: { type: String, default: null },
  nationalId: { type: String, default: null },
  profileImage: {
    type: String,
    default: null, // รูปภาพโปรไฟล์เริ่มต้น
  },
  imageUrl: { type: [{ type: String }], default: [] }, // รูปภาพทั้งหมด
  contactSocial: { type: [contactInfoSchema], default: [] },
  birthday: { type: Date, default: null },
  education: {
    type: [
      {
        educationPlaceId: { type: String },
        educationPlaceName: { type: String },
        educationYear: { type: Number },
        educationLevel: { type: String },
      },
    ],
    default: [],
  },
  // ประวัติการศึกษา
  workPlace: {
    type: [
      {
        workPlaceId: { type: String },
        workPlaceYear: { type: Number },
        workPlaceName: { type: String },
        workPlacePosition: { type: String },
      },
    ],
    default: [],
  }, // ประวัติการทำงาน
  address: [
    {
      address: { type: addressSchema },
      addressStatus: { type: String },
      addressName: { type: String },
    },
  ],
  status: [{ value1: { type: String }, value2: { type: String } }],
  level: {
    type: [
      {
        levelTitle: { type: String },
        levelValue: { type: Number, default: 1 },
        levelName: { type: String, default: "" },
      },
    ],
    default: [],
  },
  prefs: {
    type: [
      {
        prefId: { type: String },
        prefName: { type: String },
        prefWeight: { type: Number },
      },
    ],
    default: [],
  }, //ความชอบ สำหรับการเชื่อมโยง
  badges: {
    type: [{ badgeId: { type: String }, badgeName: { type: String } }],
    default: [],
  }, //เครื่องหมายแสดงสถานะ
  monthlyRank: {
    type: [
      {
        monthYear: { type: Date },
        point: { type: Number },
        rank: { type: Number },
      },
    ],
    default: [],
  },

  numPost: { type: Number, default: 0, min: 0 }, // จำนวนโพสต์
  numFollower: { type: Number, default: 0, min: 0 },
  numFollowing: { type: Number, default: 0, min: 0 },
  numNotification: { type: Number, default: 0, min: 0 },
  numUnread: { type: Number, default: 0, min: 0 }, // จำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
  numCoin: { type: Number, default: 0 }, // จำนวนคอยน์ - ส่วนตาราง coin transaction จะแยกออกไป
});

const RegularUserData = mongoose.model(
  "RegularUserData",
  regularUserDataSchema
);
module.exports = RegularUserData;
