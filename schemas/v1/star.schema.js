const mongoose = require('mongoose');


const StarPointSchema = new mongoose.Schema({
    businessId: { type: String },
    postId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Post', required: true 
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', required: true 
    }
});

module.exports = mongoose.model('starPoint', StarPointSchema);
