const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // This connects the Mongo record to the Firebase user
    firebaseUID: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
    },
    email: { 
        type: String, 
        required: true, 
        lowercase: true,
        trim: true,
    },
    role: { 
        type: String, 
        enum: ['user', 'admin'], 
        default: 'user',
        trim: true,
    },
    // Useful for the "Ideal Team" or personalization later
    name: { 
        type: String,
        trim: true,
    }
}, { 
    timestamps: true // Automatically creates createdAt and updatedAt fields
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);