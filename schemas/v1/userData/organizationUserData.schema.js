const mongoose = require("mongoose");
//import mongoose from 'mongoose';
const contactInfoSchema = require("../contact.schema");
const addressSchema = require("../address.schema");

const organizationUserData = new mongoose.Schema({
  businessId: { type: String },
  profileImage: {
    type: String,
    nullable: true,
    default: "https://example.com/default-profile-image.png", // รูปภาพโปรไฟล์เริ่มต้น
  },
  imageUrl: [{ type: String }], // รูปภาพทั้งหมด
  contactSocial: [contactInfoSchema],
  birthday: { type: Date },
  address: [
    {
      address: { type: addressSchema },
      addressStatus: { type: String },
      addressName: { type: String },
    },
  ],
  status: [{ value1: { type: String }, value2: { type: String } }],
  level: [
    {
      levelTitle: { type: String },
      levelValue: { type: Number, default: 1 },
      levelName: { type: String, default: "" },
    },
  ],
  prefs: [
    {
      prefId: { type: String },
      prefName: { type: String },
      prefWeight: { type: Number },
    },
  ], //ความชอบ สำหรับการเชื่อมโยง
  badges: [{ badgeId: { type: String }, badgeName: { type: String } }], //เครื่องหมายแสดงสถานะ
  monthlyRank: [
    {
      monthYear: { type: Date },
      point: { type: Number },
      rank: { type: Number },
    },
  ],

  numPost: { type: Number, default: 0, min: 0 }, // จำนวนโพสต์
  numFollower: { type: Number, default: 0, min: 0 },
  numFollowing: { type: Number, default: 0, min: 0 },
  numNotification: { type: Number, default: 0, min: 0 },
  numUnread: { type: Number, default: 0, min: 0 }, // จำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
  numCoin: { type: Number, default: 0 }, // จำนวนคอยน์ - ส่วนตาราง coin transaction จะแยกออกไป
});

const OrganizationUserData = mongoose.model(
  "OrganizationUserData",
  organizationUserData
);
module.exports = OrganizationUserData;
