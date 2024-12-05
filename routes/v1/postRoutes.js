const express = require("express");
const router = express.Router();
const post = require("../../schemas/v1/post.Schema");
const reaction = require("../../schemas/v1/reaction.schema");
const path = require("path");
const multer = require("multer");
const processFiles = require("../../modules/multer/multer");
const upload = multer({ processFiles });
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { OSSStorage, deleteFolder } = require("../../modules/storage/oss");

require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
const {
  abcRateLimiter,
} = require("../../modules/ratelimit/accountRatelimiter");
//const redis = require("../../app");

//const { updatePost, deletePost } = require("../controllers/postControllers");

//สร้างโพสต์
router.post("/", upload.array("image", 6), async (req, res) => {
  try {
    if (!req.body.userId) {
      return res.status(400).send({ error: "userId is required" });
    }

    const businessId = req.headers["businessid"];
    console.log(`businessId = ${businessId}`);

    const newPost = new post({
      ...req.body,
      image: [],
      businessId,
    });

    const newPostId = newPost._id;
    let images = [];

    if (req.files && req.files.length) {
      const imageOrder = req.body.imageOrder
        ? JSON.parse(req.body.imageOrder)
        : {};

      const uploadPromises = req.files.map(async (file, index) => {
        const order = imageOrder[file.originalname] || index;
        // Use current timestamp to generate a unique identifier for each image
        const uniqueTimestamp = Date.now();
        return OSSStorage.put(
          `${businessId}/user/${req.body.userId}/post/${newPostId}/post-${order}-${uniqueTimestamp}.jpg`,
          Buffer.from(file.buffer)
        ).then((image) => ({
          order,
          fileName: image.url,
        }));
      });

      try {
        images = await Promise.all(uploadPromises);
      } catch (uploadError) {
        return res.status(500).send({ error: "Error uploading all files" });
      }
    }

    if (images.length > 0) {
      newPost.image = images;
    }
    await newPost.save();

    res.status(201).send(newPost);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Route for deleting a post

router.delete("/:postId", async (req, res) => {
  try {
    const foundPost = await post.findByIdAndDelete(req.params.postId);

    if (!foundPost) return res.status(404).send("Post not found");
    res.send("Post deleted");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Route for reading all posts of a specific user
router.get("/user/:userId", async (req, res) => {
  try {
    const posts = await post.find({ userId: req.params.userId });
    res.send(posts);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.post("/gap", async (req, res) => {
  try {
    const userId = req.body.userId; // Retrieve userId from the request body if available

    const posts = await post
      .find({})
      .populate({
        path: "userId",
        select: "user.name user.email userTypeData",
        populate: {
          path: "userData",
          select: "profileImage",
        },
      })
      .populate("point.userId", "user.name")
      .populate("reports.userId", "user.name")
      .populate("favourite.userId", "user.name")
      .populate("shared.userId", "user.name");

    const postsWithReactions = await Promise.all(
      posts.map(async (post) => {
        const reactions = await reaction.aggregate([
          { $match: { postId: post._id } },
          { $group: { _id: "$reactionType", count: { $sum: 1 } } },
        ]);

        let userReaction = [];
        if (userId) {
          // Fetch the specific reaction from this user for each post, if userId is provided
          const userSpecificReaction = await reaction
            .findOne({
              userId: userId,
              postId: post._id,
            })
            .select("reactionType -_id");

          userReaction = userSpecificReaction ? [userSpecificReaction] : [];
        }

        return {
          ...post.toObject(),
          reactions,
          userReaction, // Include user-specific reactions in the response if any
        };
      })
    );
    console.log(`\n\n--------------- \npostsWithReactions = ${ JSON.stringify(postsWithReactions,null,2)}`);
    res.status(200).json(postsWithReactions);
    
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// edit โพสต์
router.patch("/:postId", upload.array("image", 6), async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.body;

  const businessId = req.headers["businessid"];
  console.log(`businessId = ${businessId}`);
  if (!businessId) {
    return res.status(403).send({ error: "businessId not " });
  }

  try {
    const existingPost = await post.findById(postId);
    if (!existingPost) {
      return res.status(403).send({ error: "Post not found" });
    }

    if (existingPost.userId.toString() !== userId) {
      return res
        .status(403)
        .send({ error: "You can only edit your own posts" });
    }

    try {
      const fieldsToUpdate = ["title", "description", "category", "location"];
      fieldsToUpdate.forEach((field) => {
        if (req.body[field] !== undefined) {
          existingPost[field] = req.body[field];
        }
      });
    } catch (error) {
      console.error("Failed to update post:", error);
      // ส่ง response กลับไปยัง client ว่ามีข้อผิดพลาดเกิดขึ้น
      res
        .status(500)
        .send({ message: "Error updating post", error: error.toString() });
    }

    let images = existingPost.image;
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
        (image) => !filenamesToDelete.includes(image.fileName.split("/").pop())
      );

      // Delete images from OSS
      const deletePromises = filenamesToDelete.map((filename) => {
        return OSSStorage.delete(
          `${businessId}/user/${userId}/post/${postId}/${filename}`
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
          `${businessId}/user/${req.body.userId}/post/${newPostId}/post-${order}-${uniqueTimestamp}.jpg`,
          Buffer.from(file.buffer)
        ).then((image) => ({
          order,
          fileName: image.url,
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

    // Ensure at least one image remains
    if (images.length === 0) {
      return res
        .status(400)
        .send({ error: "At least one image is required per post." });
    }
    existingPost.updatedAt = new Date();
    existingPost.image = images;
    await existingPost.save();
    res.status(200).send(existingPost);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// ใส่  reaction
router.post("/:postId/reactions", async (req, res) => {
  const { postId } = req.params;
  const { userId, reactionType } = req.body;
  const businessId = req.headers["businessid"];
  console.log(`businessId = ${businessId}`);
  if (!businessId) {
    return res.status(403).send({ error: "businessId not found" });
  }

  try {
    // ตรวจสอบว่ามี reaction ของผู้ใช้นี้ในโพสต์นี้อยู่แล้วหรือไม่
    const existingReaction = await reaction.findOne({ postId, userId });

    if (existingReaction) {
      if (existingReaction.reactionType === reactionType) {
        // ลบ Reaction เมื่อเป็นประเภทเดียวกัน
        await reaction.findByIdAndRemove(existingReaction._id);
        res.status(200).send({ message: "Reaction removed." });
      } else {
        // เปลี่ยน Reaction เป็นประเภทใหม่
        existingReaction.reactionType = reactionType;
        await existingReaction.save();
        res
          .status(200)
          .send({ message: "Reaction updated.", reaction: existingReaction });
      }
    } else {
      // เพิ่ม Reaction ใหม่
      const newReaction = new reaction({
        postId,
        userId,
        reactionType,
        businessId: req.headers["businessid"],
      });
      await newReaction.save();
      res
        .status(201)
        .send({ message: "Reaction added.", reaction: newReaction });
    }
  } catch (error) {
    res.status(500).send(error);
  }
});

router.get("/:postId/reactions", async (req, res) => {
  const { postId } = req.params;
  try {
    const reactions = await reaction
      .find({ postId: new mongoose.Types.ObjectId(postId) })
      .select("reactionType userId -_id") // ระบุเฉพาะฟิลด์ที่ต้องการแสดงและไม่แสดง _id
      .populate("userId", "name"); // ตัวเลือกนี้สามารถใช้หรือไม่ใช้ตามความต้องการในการแสดงชื่อผู้ใช้

    res.status(200).json(reactions);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;
