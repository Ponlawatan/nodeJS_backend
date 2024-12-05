const mongoose = require("mongoose");
const { Schema } = mongoose;

// Chat Room Schema
const chatRoomSchema = new Schema({
  businessId: { type: String },
  name: { type: String, required: true }, // ชื่อห้องหรือชื่อระหว่างผู้ใช้
  type: { type: String, enum: ["private", "group"], required: true }, // ประเภทของห้องแชท ('private' สำหรับคนต่อคน, 'group' สำหรับกลุ่ม)
  participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
  // participants: [{
  //   userId: { type: Schema.Types.ObjectId, ref: "User" },
  //   lastReadMessage: {type: Number, default: 0 },
  // }], // รายชื่อผู้เข้าร่วมห้อง
  status: { type: String, enum: ["active", "inactive"], default: "active" }, // สถานะห้องแชท
  createdAt: { type: Date, default: Date.now }, // วันที่สร้างห้องแชท
  updatedAt: { type: Date, default: Date.now }, // วันที่แก้ไขล่าสุด
  lastMessage: { type: Schema.Types.ObjectId, ref: "Message" }, // ข้อความล่าสุดในห้องแชท
  // lastMessageTime: { type: Date, default: Date.now },
  activityId: {
    type: Schema.Types.ObjectId,
    ref: "Activity",
    required: function () {
      return this.type === "group";
    },
  }, // อ้างอิงถึง activity สำหรับห้องกลุ่มเท่านั้น
  // messageNum: {type: Number, default: 0 } //จำนวนข้อความทั้งหมดในห้องแชท
});

chatRoomSchema.index({ name: 1 });
chatRoomSchema.index({ type: 1 });
chatRoomSchema.index({ participants: 1 });

const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);

// Message Schema
const messageSchema = new Schema({
  businessId: { type: String },
  chatRoom: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true },
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["text", "image", "video", "file", "other", "system" , "join" , "leave", "sticker"],
    required: true,
  },
  content: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["sent", "received", "read"], default: "sent" },
  timestamp: { type: Date, default: Date.now },
  order: { type: Number, required: true },
  reactions: [
    {
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      reactionType: { type: String, required: true }, // เช่น 'like', 'love', 'haha'
      reactionValue: { type: Schema.Types.Mixed, required: true }, // สามารถเป็น object หรือ string
    },
  ],
  extraStatus: {
    statusType: { type: String }, // เช่น 'premium', 'special'
    statusValue: { type: Schema.Types.Mixed }, // สามารถเป็น object หรือ string
  },
  // messageOrder: { type: Number, default: 0} //
});

messageSchema.index({ chatRoom: 1, timestamp: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ type: 1 });

const Message = mongoose.model("Message", messageSchema);



const stickerSetSchema = new Schema({
  businessId: { type: String, required: true,enum: ['1', '2'] },
  setNumber: { type: Number, required: true },
  nameTH: { type: String, required: true },
  nameEN: { type: String, required: true },
  descriptionTH: { type: String },
  descriptionEN: { type: String },
  price: { type: Number, required: true },
  starPoint: { type: Number, required: true },
  tags: [{ type: String }],
  amount: { type: Number, required: true },
  status: { type: String, default: 'normal' },
  type: { type: String, default: 'image' }
});

stickerSetSchema.index({ businessId: 1, setNumber: 1 });
stickerSetSchema.index({ nameTH: 'text', nameEN: 'text', tags: 'text' });

const StickerSet = mongoose.model("StickerSet", stickerSetSchema);

// const ChatLastSeenSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   chatRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
//   lastSeenTimestamp: { type: Date, default: Date.now },
// });

// ChatLastSeenSchema.index({ userId: 1, chatRoomId: 1 });

// const ChatLastSeen = mongoose.model('ChatLastSeen', ChatLastSeenSchema);

// Exporting the models
module.exports = {
  ChatRoom,
  Message,
  // ChatLastSeen,
};
