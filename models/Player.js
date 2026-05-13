const mongoose = require('mongoose');

/** GeoJSON Point: coordinates are [longitude, latitude] per RFC 7947 */
const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(coords) {
          if (!Array.isArray(coords) || coords.length !== 2) return false;
          const [lng, lat] = coords;
          return (
            typeof lng === 'number' &&
            Number.isFinite(lng) &&
            typeof lat === 'number' &&
            Number.isFinite(lat) &&
            lng >= -180 &&
            lng <= 180 &&
            lat >= -90 &&
            lat <= 90
          );
        },
        message:
          'coordinates must be [longitude, latitude] with lng in [-180, 180] and lat in [-90, 90]',
      },
    },
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema({
  author: { 
      type: String, 
      required: true 
  },
  text: { 
      type: String, 
      required: true, 
      maxlength: 1000 // Requirement: max 1000 chars
  },
  rating: { 
      type: Number, 
      required: true, 
      min: 0, 
      max: 5 // Requirement: 0 to 5 stars
  },
  location: {
      type: locationSchema,
      required: true // Requirement: Capture location on every comment
  },
  createdAt: { 
      type: Date, 
      default: Date.now 
  }
});

const playerSchema = new mongoose.Schema({
  name: { 
      type: String, 
      required: true, 
      index: true 
  },
  team: { 
      type: String, 
      required: true, 
      index: true 
  },
  league: { 
      type: String, 
      required: true, 
      index: true 
  },
  image: { 
      type: String, 
      required: false // Can be a URL or Base64 from camera
  },
  registrationDate: { 
      type: Date, 
      default: Date.now,
      index: true 
  },
  externalId: { 
      type: Number, 
      unique: true, 
      sparse: true // Stores ID from API-Football to avoid duplicates
  },
  location: {
      type: locationSchema,
      required: true // Requirement: Capture location on player insertion
  },
  // Nested Documents Array
  comments: [commentSchema]
  }, { 
  timestamps: true // Automatically adds createdAt and updatedAt
});

playerSchema.index({ location: '2dsphere' });
playerSchema.index({ 'comments.location': '2dsphere' });

const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);

module.exports = Player;
