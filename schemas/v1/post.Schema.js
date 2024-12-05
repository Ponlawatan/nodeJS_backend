const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  category: { type: String, default: "" },
  audience: {
    type: String,
    enum: ["public", "private", "onlyme"],
    default: "public",
  },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
  point: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, count: Number, time: Date }],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, maxLength: 100 },
  description: { type: String, maxLength: 1024, default: "" },
  image: [{ order: Number, fileName: String }],
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
  location: { type: { type: String, enum: ["Point"] }, coordinates: { type: [Number] } },
  locationName: { type: String, default: "" },
  favourite: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" } }],
  shared: [
    { userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, audience: { type: String, default: "public" } },
  ],
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  businessId: { type: String },
});

module.exports = mongoose.model("post", PostSchema);
