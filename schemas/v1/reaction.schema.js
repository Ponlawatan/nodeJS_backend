const mongoose = require("mongoose");

// กำหนด schema สำหรับ reactions
const ReactionSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reactionType: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  businessId: { type: String },
});

ReactionSchema.index({ postId: 1, userId: 1 });

const Reaction = mongoose.model("Reaction", ReactionSchema);

module.exports = Reaction;
