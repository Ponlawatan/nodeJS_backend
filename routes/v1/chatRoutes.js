module.exports = function (io) {
  const express = require("express");
  const { ChatRoom, Message} = require("../../schemas/v1/chat.schema");
  const Activity = require("../../schemas/v1/activity.schema");
  const User = require("../../schemas/v1/user.schema");
  const Post = require("../../schemas/v1/post.Schema");
  const Reaction = require("../../schemas/v1/reaction.schema");

  const bodyParser = require("body-parser");
  const mongoose = require("mongoose");
  const path = require("path");
  const multer = require("multer");
  const processFiles = require("../../modules/multer/multer");
  const upload = multer({ processFiles });
  const { v4: uuidv4 } = require("uuid");
  const jwt = require("jsonwebtoken");
  const { OSSStorage, deleteFolder } = require("../../modules/storage/oss");
  const { verifyAPIKey } = require("../../middlewares/auth");

  require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

  const router = express.Router(); // ประกาศ_router
  const app = express();
  app.use(bodyParser.json());

  // เพิ่ม Socket.IO ให้กับ Endpoint ส่งข้อความ
  router.post("/messages", upload.array("image", 3), async (req, res) => {
    try {
      const { chatRoomId, senderId, type, content, order } = req.body;
      const businessId = req.headers["businessid"];

      if (!senderId) {
        return res
          .status(400)
          .json({ success: false, error: "senderId is required" });
      }

      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, error: "businessId is required" });
      }

      let images = [];
      let messageContent = content;

      if (req.files && req.files.length) {
        const imageOrder = req.body.imageOrder
          ? JSON.parse(req.body.imageOrder)
          : {};
        const uploadPromises = req.files.map(async (file, index) => {
          const order = imageOrder[file.originalname] || index;
          const uniqueTimestamp = Date.now();
          return OSSStorage.put(
            `chat/${chatRoomId}/${senderId}/message-${order}-${uniqueTimestamp}.jpg`,
            Buffer.from(file.buffer)
          ).then((image) => ({
            order,
            fileName: image.url,
          }));
        });

        try {
          images = await Promise.all(uploadPromises);
          messageContent = images.map((img) => img.fileName).join(",");
        } catch (uploadError) {
          return res
            .status(500)
            .json({ success: false, error: "Error uploading files" });
        }
      }

      //messageOrder = messageNum +1

      const message = await createMessage(
        chatRoomId,
        senderId,
        images.length > 0 ? "image" : type,
        messageContent,
        order,
        businessId, // เพิ่ม businessId
      );

      const sender = await User.findById(senderId).populate({
        path: "userData",
        model: "RegularUserData",
        select: "profileImage",
      });

      const transformedMessage = {
        _id: message._id,
        chatRoom: message.chatRoom,
        sender: {
          userId: sender._id,
          name: sender.user.name,
          profileImage: sender.userData ? sender.userData.profileImage : null,
        },
        type: message.type,
        content: message.content,
        status: message.status,
        order: message.order,
        timestamp: message.timestamp,
        // messageOrder: message.messageOrder,
        __v: message.__v,
      };

      io.to(chatRoomId).emit("message", transformedMessage);
      // console.log(`${message.messageOrder}`)
      res.status(201).json({ success: true, message: transformedMessage });
    } catch (error) {
      console.log(error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post("/upload-video", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "No video file uploaded" });
      }

      const uniqueTimestamp = Date.now();
      const fileName = `chat/uploads/video-${uniqueTimestamp}.mp4`;
      const result = await OSSStorage.put(fileName, req.file.buffer);

      res.status(200).json({ success: true, videoUrl: result.url });
    } catch (error) {
      console.error("Video upload error:", error);
      res
        .status(500)
        .json({ success: false, error: "Error uploading video file" });
    }
  });

  router.post("/upload", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "No file uploaded" });
      }

      const uniqueTimestamp = Date.now();
      const fileName = `chat/uploads/image-${uniqueTimestamp}.jpg`;

      const result = await OSSStorage.put(fileName, req.file.buffer);

      res.status(200).json({ success: true, imageUrl: result.url });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ success: false, error: "Error uploading file" });
    }
  });

  // ฟังก์ชันในการสร้าง Message
  const createMessage = async (
    chatRoomId,
    senderId,
    type,
    content,
    order,
    businessId,
  ) => {

  //  // First, find the chat room and get its current messageNum
  //  const chatRoom = await ChatRoom.findById(chatRoomId);
  //  if (!chatRoom) {
  //    throw new Error('Chat room not found');
  //  }
 
   // Increment the messageNum
  //  chatRoom.messageNum += 1;
  //  await chatRoom.save();

    const message = new Message({
      chatRoom: chatRoomId,
      sender: senderId,
      type,
      content,
      order,
      businessId, // เพิ่ม businessId

    });
    await message.save();
    return message;
  };

  const createChatRoom = async (
    name,
    type,
    participants,
    businessId,
    activityId = null
  ) => {
    const chatRoomData = { name, type, participants, businessId };

    if (type === "group" && activityId) {
      chatRoomData.activityId = activityId;
    }

    const chatRoom = new ChatRoom(chatRoomData);
    await chatRoom.save();
    return chatRoom;
  };

  router.post("/chatrooms", async (req, res) => {
    try {
      const { name, type, participants, activityId } = req.body;
      const businessId = req.headers["businessid"];

      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, error: "businessId is required" });
      }

      const chatRoom = await createChatRoom(
        name,
        type,
        participants,
        businessId, // เพิ่ม businessId
        activityId
      );
      res.status(201).json({ success: true, chatRoom });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ดึงห้องแชททั้งหมดที่ผู้ใช้เข้าร่วม
  router.get("/chatrooms", async (req, res) => {
    try {
      const chatRooms = await ChatRoom.find({
        participants: req.query.userId,
      }).populate("lastMessage");
      res.json({ success: true, chatRooms });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ดึงรายละเอียดห้องแชทโดย ID
  router.get("/chatrooms/:chatRoomId", async (req, res) => {
    try {
      const chatRoom = await ChatRoom.findById(req.params.chatRoomId).populate(
        "lastMessage"
      );
      res.json({ success: true, chatRoom });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

    //ดึงข้อมูล Messages ใน Chat
  router.get("/messages", async (req, res) => {
    try {
      const { chatRoomId, startTime, before, limit } = req.query;
      const businessId = req.headers["businessid"];
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, error: "businessId is required" });
      }

      const query = { chatRoom: chatRoomId, businessId }; // เพิ่ม businessId ลงใน query
      const options = {
        sort: { timestamp: -1 }, // ดึงข้อความใหม่สุดก่อน
      };

      if (startTime) {
        query.timestamp = before
          ? { $lte: new Date(startTime) }
          : { $gte: new Date(startTime) };
        options.sort = before ? { timestamp: -1 } : { timestamp: 1 };
      }

      if (limit && parseInt(limit) > 0) {
        options.limit = parseInt(limit);
      } else {
        options.limit = 30;
      }

      const messages = await Message.find(query, null, options)
        .populate({
          path: "sender",
          select: "user.name userData",
          populate: {
            path: "userData",
            model: "RegularUserData",
            select: "profileImage",
          },
        })
        .populate({
          path: "reactions.userId",
          select: "user.name userData",
          populate: {
            path: "userData",
            model: "RegularUserData",
            select: "profileImage",
          },
        });

      //ดึงค่า messageOrder มาเป็น lastReadMessage



      // เรียงลำดับข้อความจากเก่ามาใหม่
      messages.reverse();

      // Transform the messages to the desired format
      const transformedMessages = messages.map((message) => ({
        _id: message._id,
        chatRoom: message.chatRoom,
        sender: {
          userId: message.sender?._id || null,
          name: message.sender?.user.name || "Unknown",
          profileImage: message.sender?.userData?.profileImage || null,
        },
        type: message.type,
        content: message.content,
        status: message.status,
        order: message.order,
        timestamp: message.timestamp,
        reactions: (message.reactions || []).map((reaction) => ({
          userId: reaction.userId?._id || null,
          name: reaction.userId?.user.name || "Unknown",
          profileImage: reaction.userId?.userData?.profileImage || null,
          reactionType: reaction.reactionType,
          reactionValue: reaction.reactionValue,
        })),
        __v: message.__v,
      }));

      
    //   const lastestMessageOrder = messages.length > 0 ? messages[messages.length - 1].messageOrder : 0;

    //   if(lastestMessageOrder != 0){
      
    //   await ChatRoom.findOneAndUpdate(
    //     { _id: chatRoomId, participants: req.query.userId },
    //     { $set: { "participants.$.lastReadMessage": lastestMessageOrder,
    //      } },
    //     { new: true }
    //   );
    //   console.log(`LastestMessageOrder: ${lastestMessageOrder}`);
    // }
      res.json({ success: true, messages: transformedMessages });
    } catch (error) {
      console.log(error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  });


  router.post("/messages/:messageId/reactions", async (req, res) => {
    try {
      const { userId, reactionType, reactionValue, chatRoomId } = req.body;
      const { messageId } = req.params;

      // หา message ที่ต้องการ
      const message = await Message.findById(messageId);
      if (!message) {
        return res
          .status(404)
          .json({ success: false, error: "Message not found" });
      }

      // หา chatRoom ที่เกี่ยวข้องกับ chatRoomId ที่ส่งมา
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        return res
          .status(404)
          .json({ success: false, error: "Chat room not found" });
      }

      // ตรวจสอบว่าผู้ใช้เป็นผู้เข้าร่วมในห้องแชทหรือไม่
      const isParticipant = chatRoom.participants.some((participant) =>
        participant.equals(new mongoose.Types.ObjectId(userId))
      );
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          error: "User is not a participant in the chat room",
        });
      }

      // ตรวจสอบว่า reaction ที่ส่งมาเป็น reaction เดิมหรือไม่
      const existingReactionIndex = message.reactions.findIndex(
        (reaction) =>
          reaction.userId.toString() === userId &&
          reaction.reactionType === reactionType &&
          reaction.reactionValue === reactionValue
      );

      // ถ้าเป็น reaction เดิม ให้ลบ (toggle)
      if (existingReactionIndex !== -1) {
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        // เพิ่ม reaction ใหม่
        message.reactions.push({ userId, reactionType, reactionValue });
      }

      await message.save();
      res.status(200).json({ success: true, message });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // เพิ่มผู้เข้าร่วมในห้องแชท
  router.put("/chatrooms/:chatRoomId/participants", async (req, res) => {
    try {
      const chatRoom = await ChatRoom.findById(req.params.chatRoomId);
      const newParticipants = req.body.participants;

      // กรองผู้เข้าร่วมที่มีอยู่แล้ว
      const uniqueNewParticipants = newParticipants.filter(
        (participant) => !chatRoom.participants.includes(participant)
      );

      chatRoom.participants.push(...uniqueNewParticipants);
      await chatRoom.save();

      for (const participant of uniqueNewParticipants) {
        const messageContent = `${participant} joined the group`;
        const systemMessage = await createMessage(
          chatRoom._id,
          null,
          "system",
          messageContent,
          Date.now()
        );

        // ส่งข้อความระบบไปยังห้องแชท
        io.to(chatRoom._id).emit("message", systemMessage);
      }

      res.json({ success: true, chatRoom });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ลบผู้เข้าร่วมจากห้องแชท
  router.delete("/chatrooms/:chatRoomId/participants", async (req, res) => {
    try {
      const chatRoom = await ChatRoom.findById(req.params.chatRoomId);
      const removedParticipants = req.body.participants;

      chatRoom.participants = chatRoom.participants.filter(
        (participant) => !removedParticipants.includes(participant)
      );
      await chatRoom.save();

      for (const participant of removedParticipants) {
        const messageContent = `${participant} left the group`;
        const systemMessage = await createMessage(
          chatRoom._id,
          null,
          "system",
          messageContent,
          Date.now()
        );

        // ส่งข้อความระบบไปยังห้องแชท
        io.to(chatRoom._id).emit("message", systemMessage);
      }

      res.json({ success: true, chatRoom });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  const createChatRoomsForExistingActivities = async (req, res) => {
    try {
      const activities = await Activity.find({}); // ดึงข้อมูล activity ทั้งหมด
      const businessId = req.headers["businessid"];

      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, error: "businessId is required" });
      }

      for (const activity of activities) {
        console.log(activity);
        // ตรวจสอบว่ามี chatRoom ที่เชื่อมโยงกับ activity นี้หรือไม่
        const existingChatRoom = await ChatRoom.findOne({
          activityId: activity._id,
          businessId: businessId,
        });
        console.log(existingChatRoom);
        if (!existingChatRoom) {
          // สร้าง chat room สำหรับ activity นี้
          const chatRoom = new ChatRoom({
            name: `Chat for ${activity.name}`,
            type: "group",
            participants: [],
            activityId: activity._id,
            businessId: businessId, // เพิ่ม businessId
          });

          await chatRoom.save();
          console.log(`Created chat room for activity ${activity.name}`);
        }
      }

      res.status(200).json({
        success: true,
        message: "Chat rooms created for all existing activities",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  router.post(
    "/create-chatrooms-for-existing-activities",
    createChatRoomsForExistingActivities
  );

  router.post("/update-activity-chatroom", async (req, res) => {
    try {
      // ดึง activity ทั้งหมดจากฐานข้อมูล
      const activities = await Activity.find({});

      // วนลูปผ่าน activity แต่ละอัน
      for (const activity of activities) {
        // ตรวจสอบว่ามี chatRoom ที่เชื่อมโยงกับ activity นี้หรือไม่
        const chatRoom = await ChatRoom.findOne({ activityId: activity._id });

        if (chatRoom) {
          // อัปเดต activity ให้มี chatRoomId
          activity.chatRoomId = chatRoom._id;
          await activity.save();
          console.log(
            `Updated activity ${activity.name} with chatRoomId ${chatRoom._id}`
          );
        }
      }

      res.status(200).json({
        success: true,
        message: "Activities updated with chatRoomIds",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post("/update-all-chatroom-participants", async (req, res) => {
    try {
      const activities = await Activity.find({}).populate(
        "participants.userId"
      );

      for (const activity of activities) {
        // ดึงข้อมูล ChatRoom ที่เชื่อมโยงกับ activity นี้
        const chatRoom = await ChatRoom.findOne({ activityId: activity._id });

        if (chatRoom) {
          // เพิ่ม participants ของ activity ลงใน chatRoom
          const participants = activity.participants.map(
            (participant) => participant.userId._id
          );

          chatRoom.participants = Array.from(
            new Set([...chatRoom.participants, ...participants])
          );
          await chatRoom.save();
        }
      }

      res.status(200).json({
        success: true,
        message: "All ChatRooms updated with participants from Activities",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post(
    "/sticker-sets",
    verifyAPIKey,
    upload.array("images", 50),
    async (req, res) => {
      try {
        const {
          businessId,
          setNumber,
          nameTH,
          nameEN,
          descriptionTH,
          descriptionEN,
          price,
          starPoint,
          tags,
          amount,
          status,
          type,
        } = req.body;

        // ตรวจสอบว่ามีไฟล์อัปโหลดหรือไม่
        if (!req.files || req.files.length === 0) {
          return res
            .status(400)
            .json({ success: false, error: "No sticker images uploaded" });
        }

        // อัปโหลดไฟล์ไปยัง OSS และเก็บ URL
        const uploadPromises = req.files.map(async (file, index) => {
          const uniqueTimestamp = Date.now();
          const fileName = `stickers/${businessId}/${setNumber}/sticker-${index}-${uniqueTimestamp}.jpg`;
          const result = await OSSStorage.put(fileName, file.buffer);
          return result.url;
        });

        const stickerUrls = await Promise.all(uploadPromises);

        const newStickerSet = new StickerSet({
          businessId,
          setNumber,
          nameTH,
          nameEN,
          descriptionTH,
          descriptionEN,
          price,
          starPoint,
          tags: tags ? tags.split(",") : [],
          amount: stickerUrls.length,
          status,
          type,
          stickerUrls,
        });

        await newStickerSet.save();
        res.status(201).json({ success: true, stickerSet: newStickerSet });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
    }
  );

  // อัปเดตชุดสติ๊กเกอร์
  router.put(
    "/sticker-sets/:id",
    verifyAPIKey,
    upload.array("stickerImages", 50),
    async (req, res) => {
      try {
        const {
          businessId,
          setNumber,
          nameTH,
          nameEN,
          descriptionTH,
          descriptionEN,
          price,
          starPoint,
          tags,
          status,
          type,
        } = req.body;
        const existingStickerSet = await StickerSet.findById(req.params.id);
        if (!existingStickerSet) {
          return res
            .status(404)
            .json({ success: false, error: "Sticker set not found" });
        }

        let stickerUrls = existingStickerSet.stickerUrls;

        // ถ้ามีไฟล์ใหม่อัปโหลดเข้ามา
        if (req.files && req.files.length > 0) {
          const uploadPromises = req.files.map(async (file, index) => {
            const uniqueTimestamp = Date.now();
            const fileName = `stickers/${businessId}/${setNumber}/sticker-${
              stickerUrls.length + index
            }-${uniqueTimestamp}.jpg`;
            const result = await OSSStorage.put(fileName, file.buffer);
            return result.url;
          });

          const newStickerUrls = await Promise.all(uploadPromises);
          stickerUrls = [...stickerUrls, ...newStickerUrls];
        }

        const updatedStickerSet = await StickerSet.findByIdAndUpdate(
          req.params.id,
          {
            businessId,
            setNumber,
            nameTH,
            nameEN,
            descriptionTH,
            descriptionEN,
            price,
            starPoint,
            tags: tags ? tags.split(",") : existingStickerSet.tags,
            amount: stickerUrls.length,
            status,
            type,
            stickerUrls,
          },
          { new: true, runValidators: true }
        );

        res.status(200).json({ success: true, stickerSet: updatedStickerSet });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
    }
  );

  // Get all sticker
  router.get("/sticker-sets", verifyAPIKey, async (req, res) => {
    try {
      const businessId = req.headers["businessid"];
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, error: "businessId is required" });
      }

      const stickerSets = await StickerSet.find({ businessId });
      res.status(200).json({ success: true, stickerSets });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Get a sticker by ID
  router.get("/sticker-sets/:id", verifyAPIKey, async (req, res) => {
    try {
      const stickerSet = await StickerSet.findById(req.params.id);
      if (!stickerSet) {
        return res
          .status(404)
          .json({ success: false, error: "Sticker set not found" });
      }
      res.status(200).json({ success: true, stickerSet });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Delete a sticker
  router.delete("/sticker-sets/:id", verifyAPIKey, async (req, res) => {
    try {
      const deletedStickerSet = await StickerSet.findByIdAndDelete(
        req.params.id
      );
      if (!deletedStickerSet) {
        return res
          .status(404)
          .json({ success: false, error: "Sticker set not found" });
      }
      res
        .status(200)
        .json({ success: true, message: "Sticker set deleted successfully" });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
};
