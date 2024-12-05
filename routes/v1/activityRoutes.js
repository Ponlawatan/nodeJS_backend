const express = require("express");
const router = express.Router();
const Activity = require("../../schemas/v1/activity.schema");
const User = require("../../schemas/v1/user.schema");
const RegularUserData = require("../../schemas/v1/userData/regularUserData.schema");
const path = require("path");
const multer = require("multer");
const processFiles = require("../../modules/multer/multer");
const upload = multer({ processFiles });
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { OSSStorage, deleteFolder } = require("../../modules/storage/oss");
const { ChatRoom, Message } = require("../../schemas/v1/chat.schema");

const app = express();
const bodyParser = require("body-parser");
app.use(express.json());
module.exports = function (io) {
  const router = express.Router();
  // ------------------------ สร้างกิจกรรม --------------------------
  router.post("/", upload.array("image", 6), async (req, res) => {
    try {
      if (!req.body.creatorId) {
        console.log("400 ไปดิ : Creator ID is required");
        return res.status(400).send({ error: "Creator ID is required" });
      }

      let activityTime;
      let locationData;
      const businessId = req.headers["businessid"];
      console.log(`businessId = ${businessId}`);

      try {
        locationData = JSON.parse(req.body.location);
      } catch (error) {
        console.log("400 ไปดิ : Invalid JSON format for location");
        return res
          .status(400)
          .send({ error: "Invalid JSON format for location" });
      }

      const coordinates = locationData.coordinates.split(",").map(Number);
      if (
        coordinates.length !== 2 ||
        isNaN(coordinates[0]) ||
        isNaN(coordinates[1])
      ) {
        console.log("400 ไปดิ : Invalid coordinates format");
        return res.status(400).send({ error: "Invalid coordinates format" });
      }
      const [longitude, latitude] = coordinates;

      try {
        activityTime = JSON.parse(req.body.activityTime);
      } catch (e) {
        console.log("400 ไปดิ : Invalid or missing activity time");
        return res
          .status(400)
          .send({ error: "Invalid or missing activity time" });
      }

      // Find the creator user and populate profileImage
      const user = await User.findById(req.body.creatorId).populate(
        "userData",
        "profileImage"
      );
      if (!user) {
        return res.status(404).send({ error: "Creator not found" });
      }

      const newActivity = new Activity({
        creator: {
          id: req.body.creatorId,
          name: req.body.creatorName,
        },
        location: {
          type: "Point",
          coordinates: [longitude, latitude],
          name: locationData.name,
          description: locationData.description,
        },
        activityTime: activityTime,
        category: req.body.category,
        cost: req.body.cost,
        certificate: JSON.parse(req.body.certificate || "{}"),
        name: req.body.name,
        description: req.body.description,
        image: [],
        points: req.body.points,
        participantLimit: req.body.participantLimit,
        requireRequestToJoin: req.body.requireRequestToJoin,
        privacy: JSON.parse(req.body.privacy || "{}"),
        tags: JSON.parse(req.body.tags || "[]"),
        businessId: businessId,
        participants: [
          {
            userId: user._id,
            name: user.user.name,
            profileImage: user.userData.profileImage,
            paymentStatus: "paid",
            attendanceStatus: "joined",
            joinRequestTime: new Date(),
            postEventStatus: "showed up",
          },
        ],
      });

      const newActivityId = newActivity._id;
      let images = [];

      if (req.files && req.files.length) {
        const imageOrder = req.body.imageOrder
          ? JSON.parse(req.body.imageOrder)
          : {};

        const uploadPromises = req.files.map(async (file, index) => {
          const order = imageOrder[file.originalname] || index;
          const uniqueTimestamp = Date.now();
          return OSSStorage.put(
            `user/${req.body.creatorId}/activity/${newActivityId}/activity-${order}-${uniqueTimestamp}.jpg`,
            Buffer.from(file.buffer)
          ).then((image) => ({
            order,
            fileName: image.url,
          }));
        });

        try {
          images = await Promise.all(uploadPromises);
        } catch (uploadError) {
          console.log("500 ไปดิ : Error uploading all files");
          return res.status(500).send({ error: "Error uploading all files" });
        }
      }

      if (images.length > 0) {
        newActivity.image = images;
      }

      // สร้าง ChatRoom สำหรับ Activity นี้
      const chatRoom = new ChatRoom({
        businessId: businessId,
        name: `Chat for ${newActivity.name}`,
        type: "group",
        participants: [user._id], // คุณสามารถเพิ่มผู้เข้าร่วมเพิ่มเติมได้ที่นี่
        activityId: newActivity._id,
        // messageNum: 1,
      });

      await chatRoom.save();

      // อัพเดท Activity ให้มี chatRoomId
      newActivity.chatRoomId = chatRoom._id;
      await newActivity.save();

      if (chatRoom) {
        // เพิ่มผู้ใช้เข้าไปใน participants ของ ChatRoom
        if (!chatRoom.participants.includes(user._id)) {
          chatRoom.participants.push(user._id);
          await chatRoom.save();
        }

        // สร้างและส่งข้อความระบบแจ้งว่าเป็นจุดเริ่มต้นของห้องแชท
        const startMessage = new Message({
          businessId: businessId,
          chatRoom: chatRoom._id,
          sender: user._id,
          type: "system",
          content: "เริ่มต้นการสนทนา",
          status: "sent",
          timestamp: new Date(),
          order: Date.now(),
          // lastMessageTime: new Date(),
        });
        await startMessage.save();

        // อัพเดต lastMessage ของ ChatRoom
        chatRoom.lastMessage = startMessage._id;
        // chatRoom.lastMessageTime = new Date();
        chatRoom.updatedAt = new Date();
        await chatRoom.save();

        // ส่งข้อความระบบไปยังห้องแชท
        io.to(chatRoom._id.toString()).emit("message", startMessage);
      }

      console.log("201 ไปดิ : สำเร็จ!!!");
      // console.log(`${chatRoom.messageNum}`)
      res.status(201).send(newActivity);
    } catch (error) {
      console.log(`400 ไปดิ :${error}`);
      res.status(400).send({ error: error.message });
    }
  });

  // ------------------------ edit กิจกรรม --------------------------
  router.patch("/:activityId", upload.array("image", 6), async (req, res) => {
    const { activityId } = req.params;
    const { creatorId } = req.body;

    try {
      const existingActivity = await Activity.findById(activityId);
      if (!existingActivity) {
        return res.status(404).send({ error: "ActivityId not found" });
      }

      if (existingActivity.creator.id.toString() !== creatorId) {
        return res
          .status(403)
          .send({ error: "You can only edit your own activity." });
      }

      try {
        const fieldsToUpdate = [
          "name",
          "description",
          "category",
          "locationName",
          "cost",
          "tags",
          "participantLimit",
          "requireRequestToJoin",
          "notes",
          "activityTime",
        ];
        fieldsToUpdate.forEach((field) => {
          if (req.body[field] !== undefined) {
            existingActivity[field] = req.body[field];
          }
        });
      } catch (error) {
        console.error("Failed to update the activity:", error);
        // ส่ง response กลับไปยัง client ว่ามีข้อผิดพลาดเกิดขึ้น
        res.status(500).send({
          message:
            "Error updating the activity (mayby type of datas mismatched)",
          error: error.toString(),
        });
      }

      let images = existingActivity.image;
      const imageOrder = req.body.imageOrder
        ? JSON.parse(req.body.imageOrder)
        : {};

      // Delete specified images
      if (req.body.deleteImages) {
        const imagesToDelete = JSON.parse(req.body.deleteImages);
        const filenamesToDelete = imagesToDelete.map((url) =>
          url.split("/").pop()
        );
        images = images.filter(
          (eachImage) =>
            !filenamesToDelete.includes(eachImage.fileName.split("/").pop())
        );

        // Delete images from OSS
        const deletePromises = filenamesToDelete.map((filename) => {
          return OSSStorage.delete(
            `user/${creatorId}/activity/${activityId}/${filename}`
          );
        });

        await Promise.all(deletePromises);
      }

      // Handle new images upload and order with unique filename
      if (req.files && req.files.length) {
        const uniqueTimestamp = Date.now(); // Generate a unique timestamp for each upload

        const uploadPromises = req.files.map(async (file, index) => {
          const filename = file.originalname;
          const order = imageOrder[filename] || images.length + index + 1;
          return OSSStorage.put(
            `user/${creatorId}/activity/${activityId}/activity-${order}-${uniqueTimestamp}.jpg`, // Append timestamp to ensure uniqueness
            Buffer.from(file.buffer)
          ).then((eachImage) => ({
            order,
            fileName: eachImage.url,
          }));
        });

        const newImages = await Promise.all(uploadPromises);
        images = [...images, ...newImages];
      }

      // Apply new order from imageOrder if provided
      images.forEach((image) => {
        const filename = image.fileName.split("/").pop();
        const newOrder = imageOrder[filename];
        if (newOrder !== undefined) {
          image.order = newOrder;
        }
      });

      // Normalize and reorder images to avoid duplicate orders
      images.sort((a, b) => a.order - b.order);
      images.forEach((image, index) => {
        // Reassign orders to maintain consistency
        image.order = index + 1;
      });
      existingActivity.updatedAt = new Date();
      existingActivity.image = images;
      await existingActivity.save();
      res.status(200).send(existingActivity);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

  // Get All Activities
  router.get("/", async (req, res) => {
    try {
      const { startTime, before, limit } = req.query;
      const finalLimit = limit && parseInt(limit) > 0 ? parseInt(limit) : 5;
  
      // Build date filtering condition
      let dateMatch = {};
      if (startTime) {
        dateMatch = before
          ? { createdAt: { $lte: new Date(startTime) } }
          : { createdAt: { $gte: new Date(startTime) } };
      }
  
      // Aggregation pipeline
      const activities = await Activity.aggregate([
        // Match by date if specified
        ...(Object.keys(dateMatch).length > 0 ? [{ $match: dateMatch }] : []),
        
        // Sort by creation date
        { $sort: { createdAt: before ? -1 : 1 } },
  
        // Group by parentId or _id if parentId is null
        {
          $group: {
            _id: {
              $cond: {
                if: { $eq: ["$parentId", null] },
                then: "$_id",
                else: "$parentId"
              }
            },
            // Get the most recent document in each group
            doc: { 
              $first: "$$ROOT"
            }
          }
        },
  
        // Replace the root with the grouped document
        { $replaceRoot: { newRoot: "$doc" } },
  
        // Sort final results
        { $sort: { createdAt: -1 } },
  
        // Apply limit
        { $limit: finalLimit }
      ]);
  
      if (!activities || activities.length === 0) {
        console.log("Activities not found");
        return res.status(404).json({ message: "Activities not found" });
      }
  
      // Populate the aggregated results
      const populatedActivities = await Activity.populate(activities, {
        path: "participants.userId",
        select: "user.name userData",
        populate: {
          path: "userData",
          model: "RegularUserData",
          select: "profileImage",
        },
      });
  
      const activitiesWithCreatorInfo = await Promise.all(
        populatedActivities.map(async (activity) => {
          const creator = activity.creator
            ? await User.findById(activity.creator.id)
              .populate({
                path: "userData",
                model: "RegularUserData",
                select: "profileImage",
              })
              .select("user.name userData")
            : null;
  
          if (creator) {
            activity.creator = {
              id: creator._id,
              name: creator.user?.name || "",
              profileImage: creator.userData?.profileImage || "",
            };
          }
  
          // Convert to plain object since aggregation results don't have .toObject()
          const plainActivity = JSON.parse(JSON.stringify(activity));
          return {
            ...plainActivity,
            creator: activity.creator,
            participants: activity.participants.map((participant) => {
              const plainParticipant = JSON.parse(JSON.stringify(participant));
              return {
                ...plainParticipant,
                userId: {
                  ...plainParticipant.userId,
                  profileImage: participant.userId?.userData?.profileImage || "",
                },
              };
            }),
          };
        })
      );

      const totalCount = await Activity.countDocuments(dateMatch);
    const hasMore = totalCount > (activities.length + (startTime ? await Activity.countDocuments({
      ...dateMatch,
      createdAt: { $gt: new Date(startTime) }
    }) : 0));

    console.log(totalCount);
    console.log(hasMore);
  
      res.status(200).json(activitiesWithCreatorInfo);
    } catch (error) {
      console.log("500 Error = ", error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // Get an Activity by ActivityId
  router.get("/:activityId", async (req, res) => {
    try {
      const activityId = req.params.activityId;
  
      if (!mongoose.Types.ObjectId.isValid(activityId)) {
        return res.status(400).json({ message: "activityId not found" });
      }
  
      // Fetch the main activity with populated data
      const activity = await Activity.findById(activityId).populate({
        path: "participants.userId",
        select: "user.name userData",
        populate: {
          path: "userData",
          model: "RegularUserData",
          select: "profileImage",
        },
      });
  
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
  
      // Fetch creator's details
      const creator =
        activity.creator && activity.creator.id
          ? await User.findById(activity.creator.id)
            .populate({
              path: "userData",
              model: "RegularUserData",
              select: "profileImage",
            })
            .select("user.name userData")
          : null;
  
      if (creator) {
        activity.creator = {
          id: activity.creator.id,
          name: creator.user.name,
          profileImage: creator.userData ? creator.userData.profileImage || "" : "",
        };
      }
  
      // Update participants' profile images
      activity.participants = activity.participants.map((participant) => ({
        ...participant.toObject(),
        userId: {
          ...participant.userId.toObject(),
          profileImage: participant.userId.userData
            ? participant.userId.userData.profileImage || ""
            : "",
        },
      }));
  
      // Fetch related activities with the same parentId
      let relatedActivities = [];
      if (activity.parentId) {
        relatedActivities = await Activity.find({
          parentId: activity.parentId,
          _id: { $ne: activityId } // Exclude the current activity
        })
        .select('_id activityTime chatRoomId') // Select both _id and the complete activityTime object
        .sort({ 'activityTime.start': 1 }); // Sort by start time
      }
  
      // Format the dates for related activities
      const relatedDates = relatedActivities.map(related => ({
        id: related._id,
        startDate: related.activityTime?.start || null,
        endDate: related.activityTime?.end || null,
        chatRoomId: related.chatRoomId || null // Added chatRoomId to the response
      }));
  
      // Combine all data
      const response = {
        activity,
        relatedDates: relatedDates.filter(date => date.startDate && date.endDate), // Only include activities with valid dates
        currentActivityId: activityId
      };

      console.log(response);
  
      res.status(200).json(response);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // Get Activities by UserId
  router.get("/creator/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "userId not found" });
      }

      const limit = parseInt(req.query.limit) || 0; // Default to 0 for no limit

      const activities = await Activity.find({ "creator.id": userId })
        .sort({ createdAt: -1 }) // Sort by newest first
        .limit(limit)
        .populate({
          path: "participants.userId",
          select: "user.name userData",
          populate: {
            path: "userData",
            model: "RegularUserData",
            select: "profileImage",
          },
        });

      if (!activities || activities.length === 0) {
        return res.status(404).json({ message: "Activities not found" });
      }

      const creator = await User.findById(userId)
        .populate({
          path: "userData",
          model: "RegularUserData",
          select: "profileImage",
        })
        .select("user.name userData");

      if (!creator) {
        return res.status(404).json({ message: "Creator not found" });
      }

      const activitiesWithCreatorInfo = activities.map((activity) => {
        return {
          ...activity.toObject(),
          creator: {
            id: creator._id,
            name: creator.user.name,
            profileImage: creator.userData
              ? creator.userData.profileImage || ""
              : "",
          },
          participants: activity.participants.map((participant) => ({
            ...participant.toObject(),
            userId: {
              ...participant.userId.toObject(),
              profileImage: participant.userId.userData
                ? participant.userId.userData.profileImage || ""
                : "",
            },
          })),
        };
      });

      res.status(200).json(activitiesWithCreatorInfo);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Activities by UserId (Participants)
  router.get("/participant/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      console.log(`userId = ${userId}`);
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.log("userId not found");
        return res.status(400).json({ message: "userId not found" });
      }

      const limit = parseInt(req.query.limit) || 0; // Default to 0 for no limit

      const activities = await Activity.find({ "participants.userId": userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate({
          path: "participants.userId",
          select: "user.name userData",
          populate: {
            path: "userData",
            model: "RegularUserData",
            select: "profileImage",
          },
        });

      if (!activities) {
        console.log("Activities found error");
        return res.status(404).json({ message: "Activities found error" });
      }

      const participant = await User.findById(userId)
        .populate({
          path: "userData",
          model: "RegularUserData",
          select: "profileImage",
        })
        .select("user.name userData");

      if (!participant) {
        console.log("Participant not found");
        return res.status(404).json({ message: "Participant not found" });
      }

      const activitiesWithParticipantInfo = activities.map((activity) => {
        return {
          ...activity.toObject(),
          participants: activity.participants.map((participant) => ({
            ...participant.toObject(),
            userId: {
              ...participant.userId.toObject(),
              profileImage: participant.userId.userData
                ? participant.userId.userData.profileImage || ""
                : "",
            },
          })),
        };
      });

      res.status(200).json(activitiesWithParticipantInfo);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete an Activity by ActivityId
  router.delete("/:activityId", async (req, res) => {
    try {
      const activity = await Activity.findByIdAndDelete(req.params.activityId);

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      res.status(200).json({ message: "Activity deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  //------------------------------ activity : For Participant ----------------------------

  // interested in Activities
  router.post("/:activityId/interested", async (req, res) => {
    const { userId } = req.body;
    const { activityId } = req.params;

    try {
      const activity = await Activity.findById(activityId);

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const participant = activity.participants.find(
        (p) => p.userId.toString() === userId
      );

      if (participant && participant.attendanceStatus === "banned") {
        return res
          .status(403)
          .json({ message: "You are banned from this activity" });
      }

      if (participant) {
        return res
          .status(400)
          .json({ message: "You are already a participant in this activity" });
      }

      const user = await User.findById(userId).populate(
        "userData",
        "profileImage"
      );

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const newParticipant = {
        userId: user._id,
        name: user.user.name,
        profileImage: user.userData.profileImage,
        paymentStatus: "unpaid",
        attendanceStatus: "interested",
        joinRequestTime: new Date(),
        postEventStatus: "showed up",
      };

      activity.participants.push(newParticipant);

      await activity.save();

      const chatRoom = await ChatRoom.findOne({ activityId: activity._id });

      if (chatRoom) {
        // เพิ่มผู้ใช้เข้าไปใน participants ของ ChatRoom
        if (!chatRoom.participants.includes(user._id)) {
          chatRoom.participants.push(user._id);
          await chatRoom.save();
        }

        // สร้างและส่งข้อความระบบ
        const JoinedMessage = new Message({
          businessId: activity.businessId,
          chatRoom: chatRoom._id,
          sender: user._id,
          type: "join",
          content: `${user.user.name} \nJoined`,
          status: "sent",
          timestamp: new Date(),
          order: Date.now(),
        });

        await JoinedMessage.save();

        // อัพเดต lastMessage ของ ChatRoom
        chatRoom.lastMessage = JoinedMessage._id;
        // chatRoom.lastMessageTime = new Date();
        chatRoom.updatedAt = new Date();
        await chatRoom.save();

        io.to(chatRoom._id.toString()).emit("message", JoinedMessage);
      }

      res.status(200).json({
        message: "Joined as interested successfully",
        participant: newParticipant,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Request to join an activity
  router.post("/:activityId/request", async (req, res) => {
    const { userId } = req.body;
    const { activityId } = req.params;

    try {
      const activity = await Activity.findById(activityId);

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const participant = activity.participants.find(
        (p) => p.userId.toString() === userId
      );

      if (participant && participant.attendanceStatus === "banned") {
        return res
          .status(403)
          .json({ message: "You are banned from joining this activity" });
      }

      if (participant) {
        return res.status(400).json({
          message: "You have already requested to join this activity",
        });
      }

      const user = await User.findById(userId).populate(
        "userData",
        "profileImage"
      );

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const newParticipant = {
        userId: user._id,
        name: user.user.name,
        profileImage: user.userData.profileImage,
        paymentStatus: "unpaid",
        attendanceStatus: activity.requireRequestToJoin
          ? "requested"
          : "joined",
        joinRequestTime: new Date(),
        postEventStatus: "showed up",
      };

      activity.participants.push(newParticipant);

      await activity.save();

      res.status(200).json({
        message: "Request to join activity successful",
        participant: newParticipant,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Cancel join request
  router.post("/:activityId/cancel", async (req, res) => {
    const { userId } = req.body;
    const { activityId } = req.params;

    try {
      console.log(
        `Cancelling participation for userId: ${userId} in activityId: ${activityId}`
      );
      const activity = await Activity.findById(activityId);

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const participantIndex = activity.participants.findIndex(
        (p) => p.userId.toString() === userId
      );

      if (participantIndex === -1) {
        return res
          .status(400)
          .json({ message: "You are not a participant in this activity" });
      }

      activity.participants.splice(participantIndex, 1);

      await activity.save();

      res.status(200).json({
        message: "Canceled join request or participation successfully",
      });
    } catch (error) {
      console.error(`Error cancelling participation: ${error.message}`);
      res.status(500).json({ message: "Server error", error });
    }
  });

  //------------------------------ activity : for Creator ----------------------------
  // Accept join request
  router.post("/:activityId/accept", async (req, res) => {
    const { userId } = req.body;
    const { activityId } = req.params;

    try {
      const activity = await Activity.findById(activityId);

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const participant = activity.participants.find(
        (p) => p.userId.toString() === userId
      );

      if (!participant || participant.attendanceStatus !== "requested") {
        return res.status(400).json({ message: "No such request to accept" });
      }

      participant.attendanceStatus = "joined";

      await activity.save();

      res
        .status(200)
        .json({ message: "Participant accepted successfully", participant });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Decline join request
  router.post("/:activityId/decline", async (req, res) => {
    const { userId } = req.body;
    const { activityId } = req.params;

    try {
      const activity = await Activity.findById(activityId);

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const participantIndex = activity.participants.findIndex(
        (p) =>
          p.userId.toString() === userId && p.attendanceStatus === "requested"
      );

      if (participantIndex === -1) {
        return res.status(400).json({ message: "No such request to decline" });
      }

      activity.participants.splice(participantIndex, 1);

      await activity.save();

      res.status(200).json({ message: "Participant declined successfully" });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Ban participant
  router.post("/:activityId/ban", async (req, res) => {
    const { userId } = req.body;
    const { activityId } = req.params;

    try {
      const activity = await Activity.findById(activityId);

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const participant = activity.participants.find(
        (p) => p.userId.toString() === userId
      );

      if (!participant) {
        return res.status(400).json({ message: "User is not a participant" });
      }

      participant.attendanceStatus = "banned";

      await activity.save();

      res
        .status(200)
        .json({ message: "Participant banned successfully", participant });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  //unbanned

  //get banned users

  module.exports = router;
  return router;
};
