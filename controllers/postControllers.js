const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const { OSSStorage, deleteFolder } = require("../modules/storage/oss.js");
require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
const redis = require("../app");
const Post = require("../schemas/post.schema.js");


// Controller สำหรับการอัปเดตโพสต์
exports.updatePost = async (req, res) => {
    if (!req.body) {
        res.status(400).send({ status: 'error', message: "Body can not be empty!" });
        return;
    };

    if (!req.params.postId) {
        res.status(400).send({ status: 'error', message: "Post Id can not be empty!" });
        return;
    };

    const postId = req.params.postId;
    const updatedPost = req.body;

    // Validate the updatedPost against the schema
    const validationErrors = validatePost(updatedPost);
    if (validationErrors.length > 0) {
        res.status(400).send({ status: 'error', message: validationErrors });
        return;
    }

    try {
        let imagesUrl = [];
        let imageFiles = req.files;
        for (let i = 0; i < imageFiles.length; i++) {
            // Validate the image type and size
            const validationErrors = validateImage(imageFiles[i]);
            if (validationErrors.length > 0) {
                res.status(400).send({ status: 'error', message: validationErrors });
                return;
            }

            await OSSStorage.put(
                `businesses/${businessId}/products/${generatedProductId}/Product-${generatedProductId}-${i + 1}.jpg`,
                Buffer.from(imageFiles[i].buffer)
            ).then(async (image) => {
                imagesUrl.push(image.url);
            });
        }

        const foundPost = await Post.findOneAndUpdate(postId, { $set: updatedPost }, { new: true, runValidators: true });

        if (foundPost) {
            const newAccessToken = jwt.sign(
                { userId: req.user.userId, name: req.user.name, email: req.user.email },
                process.env.JWT_ACCESS_TOKEN_SECRET,
                { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
            );
            redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

            res.status(200).send({
                authenticated_user: req.user,
                status: "success",
                message: `Successfully updated post ID ${postId}`,
                data: foundPost,
                token: newAccessToken,
            });
        } else {
            res.status(404).send({ status: 'error', message: `Post ID ${postId} was not found.` });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};


// Controller สำหรับการลบโพสต์
exports.deletePost = async (req, res) => {
    const postId = req.params.postId;

    if (!postId) {
        res.status(400).send({ status: 'error', message: "Post Id can not be empty!" });
        return;
    }

    try {
        const result = await Post.findOneAndRemove({ postId: postId });

        if (!result) {
            res.status(404).send({ status: 'error', message: `Cannot delete post ID ${postId}. Maybe post was not found.` });
        } else {
            const newAccessToken = jwt.sign(
                { userId: req.user.userId, name: req.user.name, email: req.user.email },
                process.env.JWT_ACCESS_TOKEN_SECRET,
                { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
            );
            redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

            res.status(200).send({
                authenticated_user: req.user,
                status: 'success',
                message: `Post ID ${postId} was deleted successfully.`,
                token: newAccessToken
            });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', message: `Could not delete Post ID ${postId}` });
    }
};

// Controller สำหรับการลบโพสต์ทั้งหมด
exports.deleteAllPosts = async (req, res) => {
    try {
        const result = await Post.deleteMany({});

        if (result.deletedCount > 0) {
            const newAccessToken = jwt.sign(
                { userId: req.user.userId, name: req.user.name, email: req.user.email },
                process.env.JWT_ACCESS_TOKEN_SECRET,
                { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
            );
            redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

            res.status(200).send({
                authenticated_user: req.user,
                status: 'success',
                message: `${result.deletedCount} Posts were deleted successfully!`,
                token: newAccessToken,
            });
        } else {
            res.status(404).send({ status: 'error', message: `No posts found to delete.` });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Server error', error: err.message });
    }
};
