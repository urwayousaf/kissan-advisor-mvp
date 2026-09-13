const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    farmerName: {
      type: String,
      required: true,
    },

    crop: {
      type: String,
      required: true,
    },

    disease: {
      type: String,
      required: true,
    },

    confidence: {
      type: Number,
      default: 0,
    },

    image: {
      type: String,
      default: "",
    },

    symptoms: {
      type: String,
      default: "",
    },

    location: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["Pending", "Under Review", "Verified", "Advice Sent"],
      default: "Pending",
    },

    verified: {
      type: Boolean,
      default: false,
    },

    officerAdvice: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Case", caseSchema);