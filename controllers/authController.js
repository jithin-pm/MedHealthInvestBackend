const User = require("../models/userModel");
const Admin = require("../models/adminModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const authController = {
  registerUser: async (req, res) => {
    try {
      const { fullName, email, password, gender, mobileNumber, countryCode } = req.body;

      // Basic validation
      if (!fullName || !email || !password || !gender || !mobileNumber || !countryCode) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      await User.create({
        fullName,
        email,
        password: hashedPassword,
        gender,
        mobileNumber,
        countryCode,
      });

      res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      console.error("Error in user registration:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  loginUser: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Generate Tokens
      const payload = { id: user.id, role: user.role };
      const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "70m" });
      const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

      // Set Refresh Token in HttpOnly Cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(200).json({
        message: "Login successful",
        accessToken,
        role: user.role, // Return role explicitly
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          mobileNumber: user.mobileNumber,
          countryCode: user.countryCode,
          role: user.role
        },
      });
    } catch (error) {
      console.error("Error in login:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  refreshToken: async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ message: "Refresh Token not found" });
      }

      jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).json({ message: "Invalid or expired refresh token" });
        }

        const accessToken = jwt.sign({ id: decoded.id, role: decoded.role }, process.env.JWT_SECRET, { expiresIn: "70m" });
        res.status(200).json({ data: { accessToken } });
      });
    } catch (error) {
      console.error("Error in token refresh:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  adminLogin: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const admin = await Admin.findOne({ where: { email } });
      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Generate Tokens
      const payload = { id: admin.id, role: admin.role };
      const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "70m" });
      const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

      // Set Refresh Token in HttpOnly Cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(200).json({
        message: "Admin login successful",
        accessToken,
        role: admin.role,
        user: {
          id: admin.id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role
        },
      });
    } catch (error) {
      console.error("Error in admin login:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  getAllUsers: async (req, res) => {
    try {
      const users = await User.findAll({
        attributes: { exclude: ['password'] },
        order: [['created_at', 'DESC']]
      });
      res.status(200).json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  extendSession: async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ message: "No token provided" });
      
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
      
      const newToken = jwt.sign(
        { id: decoded.id, role: decoded.role },
        process.env.JWT_SECRET,
        { expiresIn: "70m" }
      );
      
      res.status(200).json({ accessToken: newToken });
    } catch (error) {
      console.error("Error extending session:", error);
      res.status(500).json({ message: "Session extension failed" });
    }
  },
};

module.exports = authController;
