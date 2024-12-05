const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const participantSchema = new Schema({
  businessId: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: String,
  profileImage: String,
  paymentStatus: {
    type: String,
    enum: ["paid", "unpaid"],
    default: "unpaid",
  },
  attendanceStatus: {
    type: String,
    enum: ["interested", "requested", "joined", "banned"],
    default: "interested",
  },
  joinRequestTime: Date,
  postEventStatus: {
    type: String,
    enum: ["no show", "showed up", "good", "excellent"],
    default: "showed up",
  },
});

const activitySchema = new Schema({
  businessId: { type: String },
  parentId: { type: String, default: null },
  creator: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    profileImage: String,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  location: {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
    name: String,
    description: String,
  },
  activityTime: {
    start: Date,
    end: Date,
  },
  chatRoomId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatRoom" },
  category: { type: String, default: "healworld" },
  cost: { type: Number, default: 0 },
  certificate: {
    provided: { type: Boolean, default: false },
    hours: { type: Number, default: 0 },
    name: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  certificateRequest: [
    {
      realNameTH: String,
      realNameEN: String,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      requestTime: Date,
    },
  ],
  name: String,
  description: String,
  image: [{ order: Number, fileName: String }],
  points: Number,
  participantLimit: { type: Number, default: 10 },
  requireRequestToJoin: { type: Boolean, default: true },
  participants: [participantSchema],
  notes: { type: String, default: "" },
  announcements: [
    {
      message: String,
      date: { type: Date, default: Date.now },
    },
  ],
  reports: [
    {
      message: String,
      value: String,
      type: String,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  ],
  status: {
    type: { type: String, default: "normal" },
    value1: { type: String, default: "" },
    value2: { type: String, default: "" },
  },
  privacy: {
    visibility: {
      type: String,
      enum: ["public", "private", "group-specific"],
      default: "public",
    },
    visibleToGroups: [String],
    visibleToTags: [String],
  },
  tags: [String],
});

const Activity = mongoose.model("Activity", activitySchema);
module.exports = Activity;
