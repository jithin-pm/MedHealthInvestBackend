const User = require("../models/userModel");
const Admin = require("../models/adminModel");
const PanDetails = require("../models/panDetailsModel");
const BankDetails = require("../models/bankDetailsModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const { getFailedLoginAttemptTemplate, getAccountUnblockedTemplate } = require("../utils/emailTemplates");
const { generateNextCustomUserId } = require("../utils/generateCustomUserId");

const authController = {
  registerUser: async (req, res) => {
    try {
      const { fullName, email, password, gender, mobileNumber, countryCode } = req.body;

      // Basic validation
      if (!fullName || !email || !password || !gender || !mobileNumber || !countryCode) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const cleanMobile = String(mobileNumber).replace(/\D/g, "");
      if (countryCode === "+91" && cleanMobile.length !== 10) {
        return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" });
      }
      if (cleanMobile.length < 7 || cleanMobile.length > 15) {
        return res.status(400).json({ message: "Please enter a valid mobile number" });
      }

      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
      if (password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !hasSpecial) {
        return res.status(400).json({ message: "Password must be at least 6 characters and contain uppercase, lowercase, number, and a special character" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check if user already exists with email or mobile
      const existingUser = await User.findOne({ where: { email: normalizedEmail } });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      const existingMobile = await User.findOne({ where: { mobileNumber: cleanMobile, countryCode } });
      if (existingMobile) {
        return res.status(400).json({ message: "User already exists with this mobile number" });
      }

      // Hash password in advance so we do not store raw password in token
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Generate 4-digit OTP
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

      // Issue temporary stateless token containing the registration payload and OTP
      const payload = {
        purpose: "REGISTRATION",
        fullName: fullName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        gender,
        mobileNumber: cleanMobile,
        countryCode,
        otp: generatedOtp
      };

      const tempToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "10m" });

      const authKey = process.env.MSG91_AUTH_KEY ? process.env.MSG91_AUTH_KEY.trim() : null;
      const templateId = process.env.MSG91_TEMPLATE_ID ? process.env.MSG91_TEMPLATE_ID.trim() : null;
      const senderId = process.env.MSG91_SENDER_ID ? process.env.MSG91_SENDER_ID.trim() : null;

      const formattedCode = countryCode ? countryCode.replace(/\D/g, "") : "91";
      const formattedMobile = cleanMobile;
      const fullMobile = `${formattedCode}${formattedMobile}`;

      if (authKey && templateId) {
        try {
          const axios = require("axios");
          const options = {
            method: "POST",
            url: "https://control.msg91.com/api/v5/flow/",
            headers: {
              "authkey": authKey,
              "content-type": "application/json"
            },
            data: {
              template_id: templateId,
              short_url: "0",
              recipients: [
                {
                  mobiles: fullMobile,
                  number: generatedOtp
                }
              ]
            }
          };

          if (senderId) {
            options.data.sender = senderId;
          }

          console.log("MSG91 Calling Flow API for Registration OTP delivery to:", fullMobile);
          await axios(options);
        } catch (err) {
          console.error("MSG91 Error sending registration OTP:", err.response ? err.response.data : err.message);
        }
      } else {
        console.warn("MSG91 Auth Key or Template ID missing. Registration OTP not sent. Use 1234 to bypass in dev.");
      }

      const mobileEnding = cleanMobile.slice(-4);

      // Respond with OTP requirement - DO NOT SAVE IN DB YET
      res.status(200).json({
        message: "Verification OTP sent to your mobile number",
        requiresOtp: true,
        tempToken,
        mobileEnding
      });
    } catch (error) {
      console.error("Error in user registration initiation:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  verifyRegistrationOtp: async (req, res) => {
    try {
      const { tempToken, otp } = req.body;
      if (!tempToken || !otp) {
        return res.status(400).json({ message: "Verification token and OTP are required" });
      }

      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ message: "Verification session expired. Please register again." });
      }

      if (decoded.purpose !== "REGISTRATION") {
        return res.status(400).json({ message: "Invalid verification token" });
      }

      if (decoded.otp !== otp) {
        // Allow bypass only for development when MSG91 is not configured
        if (!process.env.MSG91_AUTH_KEY && (otp === "1234" || otp === "123456")) {
          // Proceed
        } else {
          return res.status(400).json({ message: "Invalid verification code" });
        }
      }

      // Re-verify that user does not already exist
      const existingUser = await User.findOne({ where: { email: decoded.email } });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      const existingMobile = await User.findOne({ where: { mobileNumber: decoded.mobileNumber, countryCode: decoded.countryCode } });
      if (existingMobile) {
        return res.status(400).json({ message: "User already exists with this mobile number" });
      }

      // Generate persistent unique custom user ID (e.g. MHI202634)
      const customUserId = await generateNextCustomUserId();

      // NOW AND ONLY NOW: CREATE USER IN DATABASE
      const newUser = await User.create({
        customUserId,
        fullName: decoded.fullName,
        email: decoded.email,
        password: decoded.password, // already hashed
        gender: decoded.gender,
        mobileNumber: decoded.mobileNumber,
        countryCode: decoded.countryCode,
      });

      // Record registration activity log
      try {
        const { parseUserAgent, getClientIp } = require("../utils/deviceParser");
        const ActivityLog = require("../models/activityLogModel");
        const ipAddress = getClientIp(req);
        const uaString = req.headers["user-agent"] || "";
        const { device, browser, os } = parseUserAgent(uaString);

        await ActivityLog.create({
          userId: newUser.id,
          action: "REGISTRATION",
          ipAddress,
          device,
          browser,
          os,
          userAgent: uaString,
          status: "SUCCESS",
          loginTime: new Date()
        });
      } catch (logErr) {
        console.error("Failed to record registration log:", logErr.message);
      }

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: newUser.id,
          customUserId: newUser.customUserId,
          fullName: newUser.fullName,
          email: newUser.email,
          mobileNumber: newUser.mobileNumber,
          countryCode: newUser.countryCode,
          gender: newUser.gender
        }
      });
    } catch (error) {
      console.error("Error in verifyRegistrationOtp:", error);
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

      // Check if account is inactive
      if (user.isActive === false || user.isActive === 0) {
        try {
          const { parseUserAgent, getClientIp } = require('../utils/deviceParser');
          const ActivityLog = require('../models/activityLogModel');
          const ipAddress = getClientIp(req);
          const uaString = req.headers['user-agent'] || '';
          const { device, browser, os } = parseUserAgent(uaString);

          await ActivityLog.create({
            userId: user.id,
            action: 'LOGIN_BLOCKED',
            ipAddress,
            device,
            browser,
            os,
            userAgent: uaString,
            status: 'DEACTIVATED',
            loginTime: new Date()
          });
        } catch (logErr) { }

        return res.status(403).json({
          message: "Your account has been deactivated by administrator. Please contact support.",
          isInactive: true
        });
      }

      // Check if account is currently locked
      if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
        try {
          const { parseUserAgent, getClientIp } = require('../utils/deviceParser');
          const ActivityLog = require('../models/activityLogModel');
          const ipAddress = getClientIp(req);
          const uaString = req.headers['user-agent'] || '';
          const { device, browser, os } = parseUserAgent(uaString);

          await ActivityLog.create({
            userId: user.id,
            action: 'LOGIN_BLOCKED',
            ipAddress,
            device,
            browser,
            os,
            userAgent: uaString,
            status: 'LOCKED',
            loginTime: new Date()
          });
        } catch (logErr) { }

        const remainingMs = Math.max(0, new Date(user.lockUntil).getTime() - Date.now());
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        return res.status(403).json({
          isLocked: true,
          lockUntil: user.lockUntil,
          remainingMs,
          remainingHours,
          message: `Account is temporarily blocked due to 3 failed password attempts in a day. Please try again after ${remainingHours} hour(s) or contact support.`
        });
      } else if (user.lockUntil && new Date(user.lockUntil) <= new Date()) {
        // Automatically unblock if 24 hours have elapsed
        user.lockUntil = null;
        user.loginAttempts = 0;
        user.lastFailedAttempt = null;
        await user.save();
      }

      // Helper to check calendar day in IST (Asia/Kolkata)
      const getDayKey = (date) => {
        try {
          return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(date));
        } catch (e) {
          return new Date(date).toISOString().split('T')[0];
        }
      };

      // 3 attempts in a day rule: Reset count if a new day has arrived or 24 hours have passed
      const lastAttemptTime = user.lastFailedAttempt || user.updated_at;
      if (user.loginAttempts > 0 && lastAttemptTime) {
        const isDifferentDay = getDayKey(lastAttemptTime) !== getDayKey(new Date());
        const msSinceLastAttempt = Date.now() - new Date(lastAttemptTime).getTime();
        if (isDifferentDay || msSinceLastAttempt >= 24 * 60 * 60 * 1000) {
          user.loginAttempts = 0;
          user.lastFailedAttempt = null;
          await user.save();
        }
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        // Calculate daily failed attempts
        const lastTime = user.lastFailedAttempt || user.updated_at;
        const isDifferentDay = lastTime ? (getDayKey(lastTime) !== getDayKey(new Date())) : false;
        const msElapsed = lastTime ? (Date.now() - new Date(lastTime).getTime()) : Infinity;

        if (user.loginAttempts > 0 && (isDifferentDay || msElapsed >= 24 * 60 * 60 * 1000)) {
          // If previous attempt was from a previous day or > 24 hours ago, start fresh at 1 for today
          user.loginAttempts = 1;
        } else {
          user.loginAttempts = (user.loginAttempts || 0) + 1;
        }

        user.lastFailedAttempt = new Date();
        const attemptsLeft = Math.max(0, 3 - user.loginAttempts);

        if (user.loginAttempts >= 3) {
          user.lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // Block for 24 hours
          await user.save();

          // Dispatch account locked notification from Hostinger email
          (async () => {
            try {
              const emailHtml = getFailedLoginAttemptTemplate(user, 0);
              await sendEmail({
                from: '"Med Health Invest Security" <noreply@medhealthinvest.com>',
                replyTo: 'noreply@medhealthinvest.com',
                to: user.email,
                subject: '[Security Alert] Account Blocked for 24 Hours - 3 Failed Login Attempts',
                html: emailHtml
              });
              console.log(`[AUTH] Account locked alert sent to ${user.email} from noreply@medhealthinvest.com`);
            } catch (err) {
              console.error(`[AUTH] Failed to send account locked email to ${user.email}:`, err.message);
            }
          })();

          const remainingMs = 24 * 60 * 60 * 1000;
          return res.status(403).json({
            isLocked: true,
            lockUntil: user.lockUntil,
            remainingMs,
            remainingHours: 24,
            message: "Account blocked for 24 hours due to 3 failed login attempts in a day. A security alert has been sent to your email."
          });
        }

        await user.save();

        // Dispatch failed attempt notice from Hostinger email with remaining attempts
        (async () => {
          try {
            const emailHtml = getFailedLoginAttemptTemplate(user, attemptsLeft);
            await sendEmail({
              from: '"Med Health Invest Security" <noreply@medhealthinvest.com>',
              replyTo: 'noreply@medhealthinvest.com',
              to: user.email,
              subject: `[Security Warning] Failed Login Attempt - ${attemptsLeft} Attempt${attemptsLeft === 1 ? '' : 's'} Remaining`,
              html: emailHtml
            });
            console.log(`[AUTH] Failed attempt notice sent to ${user.email} (${attemptsLeft} left) from noreply@medhealthinvest.com`);
          } catch (err) {
            console.error(`[AUTH] Failed to send attempt notice to ${user.email}:`, err.message);
          }
        })();

        // Record Failed Login Attempt
        try {
          const { parseUserAgent, getClientIp } = require('../utils/deviceParser');
          const ActivityLog = require('../models/activityLogModel');
          const ipAddress = getClientIp(req);
          const uaString = req.headers['user-agent'] || '';
          const { device, browser, os } = parseUserAgent(uaString);

          await ActivityLog.create({
            userId: user.id,
            action: 'LOGIN_FAILED',
            ipAddress,
            device,
            browser,
            os,
            userAgent: uaString,
            status: 'FAILED',
            loginTime: new Date()
          });
        } catch (logErr) {
          console.error("Failed to record failed login log:", logErr.message);
        }

        return res.status(400).json({
          isLocked: false,
          attemptsLeft,
          message: `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`
        });
      }

      // Correct credentials - reset lockout counters and send OTP (Login success is logged upon OTP verification)

      // If correct password, reset loginAttempts, lastFailedAttempt, and lockUntil
      if (user.loginAttempts > 0 || user.lockUntil || user.lastFailedAttempt) {
        user.loginAttempts = 0;
        user.lockUntil = null;
        user.lastFailedAttempt = null;
        await user.save();
      }

      // Generate OTP manually because the template requires ##number## variable
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

      // Issue a temp token containing the OTP for stateless verification
      const payload = { id: user.id, mobileNumber: user.mobileNumber, countryCode: user.countryCode, otp: generatedOtp };
      const tempToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1m" });

      const authKey = process.env.MSG91_AUTH_KEY ? process.env.MSG91_AUTH_KEY.trim() : null;
      const templateId = process.env.MSG91_TEMPLATE_ID ? process.env.MSG91_TEMPLATE_ID.trim() : null;
      const senderId = process.env.MSG91_SENDER_ID ? process.env.MSG91_SENDER_ID.trim() : null;

      // format mobile number without + sign
      const formattedCode = user.countryCode ? user.countryCode.replace(/\D/g, '') : '91';
      const formattedMobile = user.mobileNumber ? user.mobileNumber.replace(/\D/g, '') : '';
      const fullMobile = `${formattedCode}${formattedMobile}`;

      if (authKey && templateId) {
        try {
          const axios = require('axios');
          const options = {
            method: 'POST',
            url: 'https://control.msg91.com/api/v5/flow/',
            headers: {
              'authkey': authKey,
              'content-type': 'application/json'
            },
            data: {
              template_id: templateId,
              short_url: "0",
              recipients: [
                {
                  mobiles: fullMobile,
                  number: generatedOtp
                }
              ]
            }
          };

          if (senderId) {
            options.data.sender = senderId;
          }

          console.log("MSG91 Calling Flow API for OTP delivery to:", fullMobile);
          await axios(options);
        } catch (err) {
          console.error("MSG91 Error sending OTP:", err.response ? err.response.data : err.message);
        }
      } else {
        console.warn("MSG91 Auth Key or Template ID missing. OTP not sent. Use 1234 to bypass.");
      }

      const mobileEnding = user.mobileNumber ? user.mobileNumber.slice(-4) : "****";

      res.status(200).json({
        message: "OTP sent to registered mobile number",
        requiresOtp: true,
        tempToken,
        mobileEnding
      });
    } catch (error) {
      console.error("Error in login:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  verifyLoginOtp: async (req, res) => {
    try {
      const { tempToken, otp } = req.body;
      if (!tempToken || !otp) {
        return res.status(400).json({ message: "Token and OTP are required" });
      }

      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ message: "Session expired. Please login again." });
      }

      const user = await User.findByPk(decoded.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (decoded.otp !== otp) {
        // Allow bypass only for development when MSG91 is not configured
        if (!process.env.MSG91_AUTH_KEY && (otp === "1234" || otp === "123456")) {
          // Proceed
        } else {
          try {
            const { parseUserAgent, getClientIp } = require('../utils/deviceParser');
            const ActivityLog = require('../models/activityLogModel');
            const ipAddress = getClientIp(req);
            const uaString = req.headers['user-agent'] || '';
            const { device, browser, os } = parseUserAgent(uaString);

            await ActivityLog.create({
              userId: user.id,
              action: 'OTP_FAILED',
              ipAddress,
              device,
              browser,
              os,
              userAgent: uaString,
              status: 'FAILED',
              loginTime: new Date()
            });
          } catch (logErr) { }

          return res.status(400).json({ message: "Invalid OTP" });
        }
      }

      // Generate Tokens
      const payload = { id: user.id, role: user.role };
      const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "70m" });
      const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

      res.cookie("adminRefreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Record Verified Login Session
      try {
        const { parseUserAgent, getClientIp } = require('../utils/deviceParser');
        const ActivityLog = require('../models/activityLogModel');
        const ipAddress = getClientIp(req);
        const uaString = req.headers['user-agent'] || '';
        const { device, browser, os } = parseUserAgent(uaString);

        await ActivityLog.create({
          userId: user.id,
          action: 'LOGIN',
          ipAddress,
          device,
          browser,
          os,
          userAgent: uaString,
          status: 'SUCCESS',
          loginTime: new Date()
        });

        // Update user lastSeen timestamp
        user.lastSeen = new Date();
        await user.save();
      } catch (logErr) {
        console.error("Failed to record login session log in verifyLoginOtp:", logErr.message);
      }

      res.status(200).json({
        message: "Login successful",
        accessToken,
        role: user.role,
        user: {
          id: user.id,
          customUserId: user.customUserId,
          fullName: user.fullName,
          email: user.email,
          mobileNumber: user.mobileNumber,
          countryCode: user.countryCode,
          role: user.role,
          isPanVerified: user.isPanVerified || 0,
          isAadharVerified: user.isAadharVerified || 0,
          isBankVerified: user.isBankVerified || 0
        },
      });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { mobileNumber, countryCode } = req.body;
      if (!mobileNumber) {
        return res.status(400).json({ message: "Mobile number is required" });
      }

      const user = await User.findOne({ where: { mobileNumber, countryCode: countryCode || '+91' } });
      if (!user) {
        return res.status(404).json({ message: "No account found with this mobile number" });
      }

      // Generate OTP
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

      // Issue a temp token containing the OTP
      const payload = { id: user.id, mobileNumber: user.mobileNumber, countryCode: user.countryCode, otp: generatedOtp };
      const tempToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1m" });

      const authKey = process.env.MSG91_AUTH_KEY ? process.env.MSG91_AUTH_KEY.trim() : null;
      const templateId = process.env.MSG91_TEMPLATE_ID ? process.env.MSG91_TEMPLATE_ID.trim() : null;
      const senderId = process.env.MSG91_SENDER_ID ? process.env.MSG91_SENDER_ID.trim() : null;

      const formattedCode = user.countryCode ? user.countryCode.replace(/\D/g, '') : '91';
      const formattedMobile = user.mobileNumber ? user.mobileNumber.replace(/\D/g, '') : '';
      const fullMobile = `${formattedCode}${formattedMobile}`;

      if (authKey && templateId) {
        try {
          const axios = require('axios');
          const options = {
            method: 'POST',
            url: 'https://control.msg91.com/api/v5/flow/',
            headers: {
              'authkey': authKey,
              'content-type': 'application/json'
            },
            data: {
              template_id: templateId,
              short_url: "0",
              recipients: [
                {
                  mobiles: fullMobile,
                  number: generatedOtp
                }
              ]
            }
          };

          if (senderId) {
            options.data.sender = senderId;
          }

          console.log("MSG91 Calling Flow API for OTP delivery to:", fullMobile);
          await axios(options);
        } catch (err) {
          console.error("MSG91 Error sending OTP:", err.response ? err.response.data : err.message);
        }
      } else {
        console.warn("MSG91 Auth Key or Template ID missing. OTP not sent. Use 1234 to bypass in dev.");
      }

      const mobileEnding = user.mobileNumber ? user.mobileNumber.slice(-4) : "****";

      res.status(200).json({
        message: "OTP sent to registered mobile number",
        requiresOtp: true,
        tempToken,
        mobileEnding
      });
    } catch (error) {
      console.error("Error in forgotPassword:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { tempToken, otp, newPassword } = req.body;
      if (!tempToken || !otp || !newPassword) {
        return res.status(400).json({ message: "Token, OTP, and new password are required" });
      }

      if (newPassword.length < 6 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword)) {
        return res.status(400).json({ message: "Password must be at least 6 characters and contain uppercase, lowercase, number, and a special character" });
      }

      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ message: "Session expired. Please request a new OTP." });
      }

      const user = await User.findByPk(decoded.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (decoded.otp !== otp) {
        // Allow bypass only for development when MSG91 is not configured
        if (!process.env.MSG91_AUTH_KEY && (otp === "1234" || otp === "123456")) {
          // Proceed
        } else {
          return res.status(400).json({ message: "Invalid OTP" });
        }
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      user.loginAttempts = 0;
      user.lockUntil = null;
      await user.save();

      res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Error in resetPassword:", error);
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


  adminRefreshToken: async (req, res) => {
    try {
      const refreshToken = (req.cookies && (req.cookies.adminRefreshToken || req.cookies.refreshToken)) || req.body?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ message: "Admin refresh token not found" });
      }

      jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
        if (err || decoded.role !== 'admin') {
          return res.status(403).json({ message: "Invalid or expired admin refresh token" });
        }

        const accessToken = jwt.sign({ id: decoded.id, role: decoded.role }, process.env.JWT_SECRET, { expiresIn: "70m" });
        res.status(200).json({ data: { accessToken } });
      });
    } catch (error) {
      console.error("Error in admin token refresh:", error);
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

      // Generate 4-digit OTP
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

      // Issue temporary stateless token for OTP verification
      const payload = {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        mobileNumber: admin.mobileNumber,
        otp: generatedOtp,
        isAdmin: true
      };
      const tempToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "10m" });

      const authKey = process.env.MSG91_AUTH_KEY ? process.env.MSG91_AUTH_KEY.trim() : null;
      const templateId = process.env.MSG91_TEMPLATE_ID ? process.env.MSG91_TEMPLATE_ID.trim() : null;
      const senderId = process.env.MSG91_SENDER_ID ? process.env.MSG91_SENDER_ID.trim() : null;

      const rawMobile = admin.mobileNumber ? admin.mobileNumber.replace(/\D/g, '') : '';
      const fullMobile = rawMobile ? (rawMobile.startsWith('91') && rawMobile.length > 10 ? rawMobile : `91${rawMobile}`) : '';

      if (authKey && templateId && fullMobile) {
        try {
          const axios = require('axios');
          const options = {
            method: 'POST',
            url: 'https://control.msg91.com/api/v5/flow/',
            headers: {
              'authkey': authKey,
              'content-type': 'application/json'
            },
            data: {
              template_id: templateId,
              short_url: "0",
              sender: senderId || undefined,
              recipients: [
                {
                  mobiles: fullMobile,
                  number: generatedOtp
                }
              ]
            }
          };

          console.log("MSG91 Calling Flow API for Admin OTP delivery to:", fullMobile);
          await axios(options);
        } catch (err) {
          console.error("MSG91 Error sending Admin OTP:", err.response ? err.response.data : err.message);
        }
      } else {
        console.warn("MSG91 Auth Key/Template ID missing or mobileNumber missing for admin. OTP not sent. OTP is:", generatedOtp);
      }

      const mobileEnding = rawMobile ? rawMobile.slice(-4) : "****";

      return res.status(200).json({
        message: "OTP sent to registered mobile number",
        requiresOtp: true,
        tempToken,
        mobileEnding
      });
    } catch (error) {
      console.error("Error in admin login:", error);
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  verifyAdminLoginOtp: async (req, res) => {
    try {
      const { tempToken, otp } = req.body;
      if (!tempToken || !otp) {
        return res.status(400).json({ message: "Token and OTP are required" });
      }

      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ message: "Verification session expired. Please login again." });
      }

      if (!decoded.isAdmin || !decoded.id) {
        return res.status(403).json({ message: "Invalid session for admin login" });
      }

      if (decoded.otp !== otp) {
        // Allow bypass for dev only when MSG91 is not configured
        if (!process.env.MSG91_AUTH_KEY && (otp === "1234" || otp === "123456")) {
          // Proceed
        } else {
          return res.status(400).json({ message: "Invalid verification code. Please try again." });
        }
      }

      const admin = await Admin.findByPk(decoded.id);
      if (!admin) {
        return res.status(404).json({ message: "Admin account not found" });
      }

      // Generate Tokens
      const payload = { id: admin.id, role: admin.role };
      const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "70m" });
      const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

      const isProduction = process.env.NODE_ENV === "production" || !req.headers.host?.includes('localhost');
      const cookieOpts = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      res.cookie("refreshToken", refreshToken, cookieOpts);
      res.cookie("adminRefreshToken", refreshToken, cookieOpts);

        return res.status(200).json({
          message: "Admin login successful",
          accessToken,
          refreshToken,
          role: admin.role,
          user: {
            id: admin.id,
            fullName: admin.fullName,
            email: admin.email,
            mobileNumber: admin.mobileNumber,
            role: admin.role
          },
        });
      } catch (error) {
        console.error("Error in verifyAdminLoginOtp:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
      }
    },

    resendAdminOtp: async (req, res) => {
      try {
        const { tempToken } = req.body;
        if (!tempToken) {
          return res.status(400).json({ message: "Token is required" });
        }

        let decoded;
        try {
          decoded = jwt.verify(tempToken, process.env.JWT_SECRET, { ignoreExpiration: true });
        } catch (err) {
          return res.status(401).json({ message: "Invalid or expired token" });
        }

        if (!decoded.isAdmin || !decoded.id) {
          return res.status(403).json({ message: "Invalid admin session" });
        }

        const admin = await Admin.findByPk(decoded.id);
        if (!admin) {
          return res.status(404).json({ message: "Admin not found" });
        }

        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const payload = {
          id: admin.id,
          email: admin.email,
          role: admin.role,
          mobileNumber: admin.mobileNumber,
          otp: generatedOtp,
          isAdmin: true
        };
        const newTempToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "10m" });

        const authKey = process.env.MSG91_AUTH_KEY ? process.env.MSG91_AUTH_KEY.trim() : null;
        const templateId = process.env.MSG91_TEMPLATE_ID ? process.env.MSG91_TEMPLATE_ID.trim() : null;
        const senderId = process.env.MSG91_SENDER_ID ? process.env.MSG91_SENDER_ID.trim() : null;

        const rawMobile = admin.mobileNumber ? admin.mobileNumber.replace(/\D/g, '') : '';
        const fullMobile = rawMobile ? (rawMobile.startsWith('91') && rawMobile.length > 10 ? rawMobile : `91${rawMobile}`) : '';

        if (authKey && templateId && fullMobile) {
          try {
            const axios = require('axios');
            await axios({
              method: 'POST',
              url: 'https://control.msg91.com/api/v5/flow/',
              headers: {
                'authkey': authKey,
                'content-type': 'application/json'
              },
              data: {
                template_id: templateId,
                short_url: "0",
                sender: senderId || undefined,
                recipients: [
                  {
                    mobiles: fullMobile,
                    number: generatedOtp
                  }
                ]
              }
            });
            console.log("MSG91 Resent Admin OTP to:", fullMobile);
          } catch (err) {
            console.error("MSG91 Error resending Admin OTP:", err.response ? err.response.data : err.message);
          }
        }

        const mobileEnding = rawMobile ? rawMobile.slice(-4) : "****";

        return res.status(200).json({
          message: "New OTP sent to registered mobile number",
          requiresOtp: true,
          tempToken: newTempToken,
          mobileEnding
        });
      } catch (error) {
        console.error("Error in resendAdminOtp:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
      }
    },


      toggleUserStatus: async (req, res) => {
        try {
          const { userId } = req.params;
          const { isActive } = req.body;
          const user = await User.findByPk(userId);
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }

          const newStatus = typeof isActive === 'boolean' ? isActive : (user.isActive === false || user.isActive === 0 ? true : false);
          user.isActive = newStatus;
          await user.save();

          res.status(200).json({
            success: true,
            message: `Account for ${user.fullName || user.email} has been ${newStatus ? 'activated' : 'marked as inactive'}.`,
            user: {
              id: user.id,
              isActive: user.isActive,
            }
          });
        } catch (error) {
          console.error("Error in toggleUserStatus:", error);
          res.status(500).json({ message: "Internal Server Error", error: error.message });
        }
      },

        updateProfile: async (req, res) => {
          try {
            const userId = req.user.id;
            const { fullName, gender, mobileNumber, countryCode } = req.body;

            const user = await User.findByPk(userId);
            if (!user) {
              return res.status(404).json({ message: "User not found" });
            }

            if (fullName) user.fullName = fullName.trim();
            if (gender) user.gender = gender;
            if (countryCode) user.countryCode = countryCode;
            if (mobileNumber) {
              const cleanMobile = String(mobileNumber).replace(/\D/g, "");
              user.mobileNumber = cleanMobile;
            }

            await user.save();

            const userSafe = user.toJSON();
            delete userSafe.password;

            res.status(200).json({
              success: true,
              message: "Profile updated successfully",
              user: userSafe,
            });
          } catch (error) {
            console.error("Error updating profile:", error);
            res.status(500).json({ message: "Internal Server Error", error: error.message });
          }
        },

          adminUpdateUser: async (req, res) => {
            try {
              const { userId } = req.params;
              const { fullName, email, gender, mobileNumber, countryCode } = req.body;

              const user = await User.findByPk(userId);
              if (!user) {
                return res.status(404).json({ message: "User not found" });
              }

              if (email && email.toLowerCase() !== user.email.toLowerCase()) {
                const existingEmail = await User.findOne({ where: { email: email.toLowerCase() } });
                if (existingEmail && existingEmail.id !== user.id) {
                  return res.status(400).json({ message: "Email is already in use by another user" });
                }
                user.email = email.toLowerCase().trim();
              }

              if (fullName) user.fullName = fullName.trim();
              if (gender) user.gender = gender;
              if (countryCode) user.countryCode = countryCode;
              if (mobileNumber) {
                const cleanMobile = String(mobileNumber).replace(/\D/g, "");
                user.mobileNumber = cleanMobile;
              }

              await user.save();

              const userSafe = user.toJSON();
              delete userSafe.password;

              res.status(200).json({
                success: true,
                message: "User profile updated successfully",
                user: userSafe,
              });
            } catch (error) {
              console.error("Error in adminUpdateUser:", error);
              res.status(500).json({ message: "Internal Server Error", error: error.message });
            }
          },

            unblockUser: async (req, res) => {
              try {
                const { userId } = req.params;
                const user = await User.findByPk(userId);
                if (!user) {
                  return res.status(404).json({ message: "User not found" });
                }

                user.loginAttempts = 0;
                user.lockUntil = null;
                user.lastFailedAttempt = null;
                await user.save();

                // Dispatch unblock security notice from Hostinger email asynchronously
                (async () => {
                  try {
                    if (getAccountUnblockedTemplate) {
                      const emailHtml = getAccountUnblockedTemplate(user);
                      await sendEmail({
                        from: '"Med Health Invest Security" <noreply@medhealthinvest.com>',
                        replyTo: 'noreply@medhealthinvest.com',
                        to: user.email,
                        subject: '[Security Notice] Your Account Has Been Unblocked',
                        html: emailHtml
                      });
                      console.log(`[AUTH] Unblock notice sent to ${user.email} from noreply@medhealthinvest.com`);
                    }
                  } catch (err) {
                    console.error(`[AUTH] Failed to send unblock notice to ${user.email}:`, err.message);
                  }
                })();

                res.status(200).json({
                  success: true,
                  message: `Account for ${user.fullName || user.email} has been successfully unblocked.`,
                  user: {
                    id: user.id,
                    loginAttempts: user.loginAttempts,
                    lockUntil: user.lockUntil
                  }
                });
              } catch (error) {
                console.error("Error in unblockUser:", error);
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

                getVerificationStatus: async (req, res) => {
                  try {
                    const { userId } = req.params;
                    const user = await User.findOne({
                      where: { id: userId },
                      attributes: [
                        'id',
                        'customUserId',
                        'isPanVerified',
                        'isAadharVerified',
                        'isBankVerified',
                        'fullName',
                        'bankName',
                        'accountNumber',
                        'ifscCode',
                        'accountHolderName'
                      ]
                    });
                    const fs = require('fs');
                    const logData = {
                      timestamp: new Date().toISOString(),
                      reqUserId: userId,
                      userFound: user ? {
                        id: user.id,
                        fullName: user.fullName,
                        isPanVerified: user.isPanVerified,
                        isBankVerified: user.isBankVerified,
                        bankName: user.bankName,
                        accountNumber: user.accountNumber,
                        ifscCode: user.ifscCode,
                        accountHolderName: user.accountHolderName
                      } : null,
                    };

                    let panDetails = null;
                    let bankDetails = null;

                    if (user.isPanVerified === 1) {
                      panDetails = await PanDetails.findOne({ where: { userId } });
                      logData.panDetailsFound = panDetails ? panDetails.toJSON() : null;
                    }

                    if (user.isBankVerified === 1) {
                      bankDetails = await BankDetails.findOne({ where: { userId } });
                      logData.bankDetailsFound = bankDetails ? bankDetails.toJSON() : null;
                    }

                    fs.appendFileSync('debug.log', JSON.stringify(logData, null, 2) + '\n---\n');

                    res.status(200).json({
                      id: user.id,
                      customUserId: user.customUserId,
                      isPanVerified: user.isPanVerified === 1,
                      isAadharVerified: user.isAadharVerified === 1,
                      isBankVerified: user.isBankVerified === 1,
                      fullName: user.fullName,
                      bankName: user.bankName,
                      accountNumber: user.accountNumber,
                      ifscCode: user.ifscCode,
                      accountHolderName: user.accountHolderName,
                      panDetails,
                      bankDetails
                    });
                  } catch (error) {
                    console.error('Error fetching verification status:', error);
                    res.status(500).json({ message: 'Internal Server Error', error: error.message });
                  }
                },


                  getUserActivityLogs: async (req, res) => {
                    try {
                      const { userId } = req.params;
                      const user = await User.findByPk(userId);
                      if (!user) {
                        return res.status(404).json({ message: "User not found" });
                      }

                      const ActivityLog = require('../models/activityLogModel');
                      const logs = await ActivityLog.findAll({
                        where: { userId },
                        order: [['loginTime', 'DESC']],
                        limit: 100
                      });

                      res.status(200).json({
                        success: true,
                        user: {
                          id: user.id,
                          fullName: user.fullName,
                          email: user.email,
                          customUserId: user.customUserId,
                          lastSeen: user.lastSeen
                        },
                        logs
                      });
                    } catch (error) {
                      console.error("Error fetching user activity logs:", error);
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

authController.adminForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Admin email address is required" });
    }

    const admin = await Admin.findOne({ where: { email: email.trim().toLowerCase() } });
    if (!admin) {
      return res.status(404).json({ message: "No administrative account registered with this email" });
    }

    // Generate 4-digit OTP
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // Issue temporary stateless token for OTP verification (10 minutes)
    const payload = {
      id: admin.id,
      email: admin.email,
      otp: generatedOtp,
      type: 'ADMIN_RESET'
    };
    const tempToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "10m" });

    // Send SMS via MSG91 if configured
    const authKey = process.env.MSG91_AUTH_KEY ? process.env.MSG91_AUTH_KEY.trim() : null;
    const templateId = process.env.MSG91_TEMPLATE_ID ? process.env.MSG91_TEMPLATE_ID.trim() : null;
    const senderId = process.env.MSG91_SENDER_ID ? process.env.MSG91_SENDER_ID.trim() : null;

    const rawMobile = admin.mobileNumber ? admin.mobileNumber.replace(/\D/g, '') : '';
    const fullMobile = rawMobile ? (rawMobile.startsWith('91') && rawMobile.length > 10 ? rawMobile : `91${rawMobile}`) : '';

    if (authKey && templateId && fullMobile) {
      try {
        const axios = require('axios');
        await axios({
          method: 'POST',
          url: 'https://control.msg91.com/api/v5/flow/',
          headers: {
            'authkey': authKey,
            'content-type': 'application/json'
          },
          data: {
            template_id: templateId,
            short_url: "0",
            sender: senderId || undefined,
            recipients: [
              {
                mobiles: fullMobile,
                number: generatedOtp
              }
            ]
          }
        });
        console.log("MSG91 Sent Admin Password Reset OTP to mobile:", fullMobile);
      } catch (err) {
        console.error("MSG91 Error sending Admin Reset OTP:", err.response ? err.response.data : err.message);
      }
    }

    // Also send OTP via Email
    try {
      await sendEmail({
        from: '"Med Health Invest Security" <noreply@medhealthinvest.com>',
        replyTo: 'noreply@medhealthinvest.com',
        to: admin.email,
        subject: '[MedHealth Invest] Admin Password Reset Code',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0c0c0c; color: #ffffff; padding: 32px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #222;">
            <div style="margin-bottom: 24px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800;">ADMIN SECURITY VERIFICATION</h2>
              <p style="color: #888; font-size: 13px; margin-top: 6px;">Password Reset Authorization Code</p>
            </div>
            <div style="background: rgba(204,255,0,0.08); border: 1px solid rgba(204,255,0,0.25); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 11px; font-weight: 700; color: #ccff00; letter-spacing: 2px; text-transform: uppercase;">One-Time Security Code</span>
              <div style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #ffffff; margin-top: 8px; font-family: monospace;">${generatedOtp}</div>
            </div>
            <p style="color: #aaa; font-size: 13px; line-height: 1.6;">
              Use this 4-digit code to complete your admin password reset. This code is valid for <strong>10 minutes</strong>.
            </p>
            <p style="color: #666; font-size: 11px; margin-top: 24px; border-top: 1px solid #1a1a1a; padding-top: 16px;">
              If you did not request a password reset, your administrative credentials may be compromised. Please secure your account immediately.
            </p>
          </div>
        `
      });
      console.log("Sent Admin Password Reset OTP to email:", admin.email);
    } catch (mailErr) {
      console.error("Error sending Admin Reset email:", mailErr.message);
    }

    console.log(`[AUTH] Admin Password Reset OTP for ${admin.email} is: ${generatedOtp}`);

    const mobileEnding = rawMobile ? rawMobile.slice(-4) : "****";
    return res.status(200).json({
      message: "Verification code dispatched successfully",
      tempToken,
      mobileEnding,
      email: admin.email
    });
  } catch (error) {
    console.error("Error in adminForgotPassword:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

authController.adminResetPassword = async (req, res) => {
  try {
    const { tempToken, otp, newPassword } = req.body;

    if (!tempToken || !otp || !newPassword) {
      return res.status(400).json({ message: "Token, verification code, and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Verification session has expired. Please request a new code." });
    }

    if (decoded.type !== 'ADMIN_RESET') {
      return res.status(400).json({ message: "Invalid reset token type" });
    }

    if (decoded.otp !== otp) {
      if (!process.env.MSG91_AUTH_KEY && (otp === "1234" || otp === "123456")) {
        // Dev bypass
      } else {
        return res.status(400).json({ message: "Invalid verification code. Please check and try again." });
      }
    }

    const admin = await Admin.findByPk(decoded.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin account not found" });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    return res.status(200).json({ message: "Admin password reset successfully. Please log in with your new password." });
  } catch (error) {
    console.error("Error in adminResetPassword:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

authController.adminChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const admin = await Admin.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin account not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error in adminChangePassword:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

authController.adminResetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User account not found" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Log activity
    try {
      const ActivityLog = require("../models/activityLogModel");
      await ActivityLog.create({
        userId: user.id,
        action: 'PASSWORD_RESET_BY_ADMIN',
        ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin Action',
        device: 'Admin Console'
      });
    } catch (logErr) {
      console.warn("Could not log password reset activity:", logErr.message);
    }

    // Notify user via Email
    try {
      await sendEmail({
        from: '"Med Health Invest Security" <noreply@medhealthinvest.com>',
        replyTo: 'noreply@medhealthinvest.com',
        to: user.email,
        subject: '[MedHealth Invest] Your Password Has Been Reset by Admin',
        html: `
          <div style="font-family:sans-serif;background:#0c0c0c;color:#fff;padding:28px;border-radius:12px;max-width:500px;margin:0 auto;border:1px solid #222;">
            <h2 style="color:#ccff00;margin-top:0;">Password Reset Notice</h2>
            <p>Hello ${user.fullName},</p>
            <p>Your MedHealth Invest account password has been reset by administrative support.</p>
            <p>If you were provided a temporary password, please sign in and change your password immediately.</p>
            <p style="color:#888;font-size:12px;margin-top:20px;border-top:1px solid #222;padding-top:12px;">If you did not request this assistance, please contact MedHealth Invest compliance immediately.</p>
          </div>
        `
      });
    } catch (mailErr) {
      console.warn("Could not send password reset notification email to user:", mailErr.message);
    }

    return res.status(200).json({ message: `Password for ${user.fullName} has been reset successfully.` });
  } catch (error) {
    console.error("Error in adminResetUserPassword:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = authController;
