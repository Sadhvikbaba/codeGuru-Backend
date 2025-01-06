import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";

const userSchema = new Schema(
  {
    userName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    // Password is optional for OAuth users
    password: {
      type: String,
      default: null, // null for OAuth users
    },
    googleId: {
      type: String,
      default: null, 
    },
    githubId: {
      type: String,
      default: null, 
    },
    OTP: {
      type: String,
      default: "",
    },
    solved: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);


userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next(); // Skip if no password
  this.password = await bcryptjs.hash(this.password, 10);
  next();
});

// Method to compare passwords
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcryptjs.compare(password, this.password);
};

// Generate Access Token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      userName: this.userName,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

// Generate Refresh Token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);
