require("dotenv").config();
const express = require("express");
const { Op } = require("sequelize");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const projectRoutes = require("./routes/projectRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");
const chatRoutes = require("./routes/chatRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const bankRoutes = require("./routes/bankRoutes");
const panRoutes = require("./routes/panRoutes");
const BankDetails = require("./models/bankDetailsModel");
const PanDetails = require("./models/panDetailsModel");
const path = require("path");
require("./config/email"); // Initialize Nodemailer
const User = require("./models/userModel");
const Admin = require("./models/adminModel");
const Category = require("./models/categoryModel");
const Project = require("./models/projectModel");
const Enquiry = require("./models/enquiryModel");
const Message = require("./models/messageModel");
const Investment = require("./models/investmentModel");
const Transaction = require("./models/transactionModel");

// Associations
Project.belongsTo(User, { foreignKey: 'exclusiveUserId', as: 'assignedUser' });
User.hasMany(Project, { foreignKey: 'exclusiveUserId' });

Investment.belongsTo(User, { foreignKey: 'userId', as: 'investor' });
Investment.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Project.hasMany(Investment, { foreignKey: 'projectId', as: 'investments' });
User.hasMany(Investment, { foreignKey: 'userId', as: 'investments' });

// Transaction Associations
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Transaction.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Transaction.belongsTo(Investment, { foreignKey: 'investmentId', as: 'investment' });
User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });

// Bank Details Association
User.hasOne(BankDetails, { foreignKey: 'userId', as: 'bankDetails' });
BankDetails.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(PanDetails, { foreignKey: 'userId', as: 'panDetails' });
PanDetails.belongsTo(User, { foreignKey: 'userId' });
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "https://medhealthbackend.medhealthinvest.com",
  "https://medhealthinvest.com",
  "https://www.medhealthinvest.com",
  "https://admin.medhealthinvest.com",
  "https://medhealth.medhealthinvest.com"
];

// Dynamic origin checker supporting any localhost port and any medhealthinvest.com subdomain
const corsOriginChecker = (origin, callback) => {
  if (!origin) return callback(null, true);
  
  const isAllowed = allowedOrigins.includes(origin) || 
                    origin.endsWith(".medhealthinvest.com") || 
                    origin === "https://medhealthinvest.com" ||
                    /^http:\/\/localhost:\d+$/.test(origin);
                    
  if (isAllowed) {
    callback(null, true);
  } else {
    callback(null, false); // Return false instead of throwing Error to prevent app crash under some configurations
  }
};

const io = new Server(server, {
  cors: {
    origin: corsOriginChecker,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: corsOriginChecker,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Sync database and seed admin
const initializeDb = async () => {
  try {
    // Sync all models (creates missing tables or columns)
    try {
      await db.sync({ alter: true });
      console.log("Database schema synchronized (alter enabled).");
    } catch (syncErr) {
      console.warn("Database sync {alter: true} failed, proceeding with manual updates:", syncErr.message);
    }

    // Immediately expire any projects that are beyond the 90-day window
    await Project.update(
      { status: 'EXPIRED' },
      {
        where: {
          status: 'ACTIVE',
          [Op.or]: [
            // Case 1: Deadline is already set and passed
            { 
              activeDeadline: { [Op.lt]: new Date() } 
            },
            // Case 2: Deadline is not set but creation date + 90 days has passed
            {
              [Op.and]: [
                { activeDeadline: null },
                { created_at: { [Op.lt]: new Date(new Date() - 90 * 24 * 60 * 60 * 1000) } }
              ]
            }
          ]
        }
      }
    );
    console.log("Stale projects moved to EXPIRED status.");

    // Manually add exclusiveUserId to projects if it doesn't exist
    try {
      const [results] = await db.query("SHOW COLUMNS FROM projects LIKE 'exclusiveUserId'");
      if (results.length === 0) {
        await db.query("ALTER TABLE projects ADD COLUMN exclusiveUserId INT NULL REFERENCES users(id)");
        console.log("Column 'exclusiveUserId' added to projects table manually.");
      }
    } catch (dbErr) {
      console.warn("Manual column check/addition skipped or failed:", dbErr.message);
    }

    // Manually add collectedAmount to projects if it doesn't exist
    try {
      const [collectedResults] = await db.query("SHOW COLUMNS FROM projects LIKE 'collectedAmount'");
      if (collectedResults.length === 0) {
        await db.query("ALTER TABLE projects ADD COLUMN collectedAmount DECIMAL(15, 2) NOT NULL DEFAULT 0.00");
        console.log("Column 'collectedAmount' added to projects table manually.");
      }
    } catch (dbErr) {
      console.warn("collectedAmount column check failed:", dbErr.message);
    }

    // Manually add minInvestmentAmount to projects if it doesn't exist
    try {
      const [minResults] = await db.query("SHOW COLUMNS FROM projects LIKE 'minInvestmentAmount'");
      if (minResults.length === 0) {
        await db.query("ALTER TABLE projects ADD COLUMN minInvestmentAmount DECIMAL(15, 2) NOT NULL DEFAULT 1000.00");
        console.log("Column 'minInvestmentAmount' added to projects table manually.");
      }
    } catch (dbErr) {
      console.warn("minInvestmentAmount column check failed:", dbErr.message);
    }

    // Manually add enquiryType to enquiries if it doesn't exist
    try {
      const [cols] = await db.query("SHOW COLUMNS FROM enquiries LIKE 'enquiryType'");
      if (cols.length === 0) {
        await db.query("ALTER TABLE enquiries ADD COLUMN enquiryType ENUM('General','Exclusive') NOT NULL DEFAULT 'General'");
        console.log("Column 'enquiryType' added to enquiries table.");
      }
    } catch (dbErr) {
      console.warn("enquiryType column check/addition skipped:", dbErr.message);
    }

    // Manually add activeDeadline to projects if it doesn't exist
    try {
      const [deadlineResults] = await db.query("SHOW COLUMNS FROM projects LIKE 'activeDeadline'");
      if (deadlineResults.length === 0) {
        await db.query("ALTER TABLE projects ADD COLUMN activeDeadline DATETIME NULL");
        console.log("Column 'activeDeadline' added to projects table.");
      }
    } catch (dbErr) {
      console.warn("activeDeadline column addition failed:", dbErr.message);
    }

    // Manually add ongoingStartDate to projects if it doesn't exist
    try {
      const [ongoingResults] = await db.query("SHOW COLUMNS FROM projects LIKE 'ongoingStartDate'");
      if (ongoingResults.length === 0) {
        await db.query("ALTER TABLE projects ADD COLUMN ongoingStartDate DATETIME NULL");
        console.log("Column 'ongoingStartDate' added to projects table.");
      }
    } catch (dbErr) {
      console.warn("ongoingStartDate column addition failed:", dbErr.message);
    }

    // Manually add role to admins if it doesn't exist
    try {
      const [adminRoleResults] = await db.query("SHOW COLUMNS FROM admins LIKE 'role'");
      if (adminRoleResults.length === 0) {
        await db.query("ALTER TABLE admins ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'admin'");
        console.log("Column 'role' added to admins table manually.");
      }
    } catch (dbErr) {
      console.warn("admin role column check failed:", dbErr.message);
    }

    // Manually add completionDate to projects if it doesn't exist
    try {
      const [completionResults] = await db.query("SHOW COLUMNS FROM projects LIKE 'completionDate'");
      if (completionResults.length === 0) {
        await db.query("ALTER TABLE projects ADD COLUMN completionDate DATETIME NULL");
        console.log("Column 'completionDate' added to projects table.");
      }
    } catch (dbErr) {
      console.warn("completionDate column addition failed:", dbErr.message);
    }

    // Synchronize all active project deadlines
    try {
      const activeProjects = await Project.findAll({ where: { status: 'ACTIVE' } });
      let updatedCount = 0;
      for (const p of activeProjects) {
        const sourceDate = p.created_at || p.createdAt;
        if (!sourceDate) continue;
        
        const deadline = new Date(sourceDate);
        if (isNaN(deadline.getTime())) {
          console.warn(`Skipping deadline sync for project ${p.id} due to invalid creation date: ${sourceDate}`);
          continue;
        }
        
        deadline.setDate(deadline.getDate() + 90);
        
        if (!p.activeDeadline || p.activeDeadline.getTime() !== deadline.getTime()) {
          await p.update({ activeDeadline: deadline });
          updatedCount++;
        }
      }
      if (updatedCount > 0) {
        console.log(`Successfully synchronized deadlines for ${updatedCount} active projects.`);
      }
    } catch (dbErr) {
      console.warn("activeDeadline synchronization failed:", dbErr.message);
    }
    
    // Seed default admin if none exists
    const adminCount = await Admin.count();
    if (adminCount === 0) {
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash("admin1234", 10);
      await Admin.create({
        fullName: "Default Admin",
        email: "admin@gmail.com",
        password: hashedPassword,
        role: "admin"
      });
      console.log("Default admin created: admin@gmail.com / admin1234");
    }
  } catch (err) {
    console.error("Error initializing database:", err);
  }
};

initializeDb();

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/project", projectRoutes);
app.use("/api/enquiry", enquiryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bank", bankRoutes);
app.use("/api/pan", panRoutes);

// Online presence tracking: userId -> socketId
const onlineUsers = new Map();

// Socket.IO Connection Logic
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_admin", () => {
    socket.join("admin_room");
    const onlineIds = Array.from(onlineUsers.keys());
    socket.emit("online_users_list", onlineIds);
    console.log(`Admin joined admin_room`);
  });

  socket.on("user_online", async (userId) => {
    const id = String(userId);
    onlineUsers.set(id, socket.id);
    socket.userId = id;
    try {
      await User.update({ lastSeen: null }, { where: { id: userId } });
    } catch (e) { /* ignore */ }
    io.to("admin_room").emit("user_status_change", { userId: id, isOnline: true, lastSeen: null });
    console.log(`User ${id} is online`);
  });

  socket.on("join_room", (userId) => {
    const roomStr = String(userId);
    socket.join(roomStr);
    console.log(`User ${socket.id} joined room: ${roomStr}`);
  });

  socket.on("send_message", async (data) => {
    try {
      const savedMessage = await Message.create({
        senderId: data.senderId,
        senderType: data.senderType,
        receiverId: data.receiverId,
        content: data.content,
        type: data.type || 'TEXT',
        userId: data.userId
      });

      const roomStr = String(data.userId);
      const msgToEmit = savedMessage.get ? savedMessage.get({ plain: true }) : savedMessage;
      if (data.tempId) msgToEmit.tempId = data.tempId;

      console.log(`Broadcasting message to room ${roomStr}:`, msgToEmit);
      io.to(roomStr).emit("receive_message", msgToEmit);

      if (data.senderType === 'user') {
        io.to("admin_room").emit("receive_message", msgToEmit);
        
        const messageCount = await Message.count({ where: { userId: data.userId, senderType: 'user' } });
        if (messageCount === 1) {
          const welcomeText = "Thank you for reaching out to Med Health Invest! Our support team has received your message and will get back to you as soon as possible. We appreciate your patience!";
          const welcomeMsg = await Message.create({
            senderId: null,
            senderType: 'admin',
            receiverId: data.senderId,
            content: welcomeText,
            type: 'TEXT',
            userId: data.userId
          });
          const welcomeEmit = welcomeMsg.get ? welcomeMsg.get({ plain: true }) : welcomeMsg;
          setTimeout(() => {
            io.to(roomStr).emit("receive_message", welcomeEmit);
          }, 1000);
        }
      }
    } catch (error) {
      console.error("Error saving/sending message:", error);
    }
  });

  socket.on("delete_message", ({ messageId, userId }) => {
    const roomStr = String(userId);
    io.to(roomStr).emit("message_deleted", { messageId });
  });

  socket.on("mark_as_read", async ({ userId, readerType }) => {
    try {
      const senderType = readerType === 'admin' ? 'user' : 'admin';
      await Message.update(
        { isRead: true },
        { where: { userId, senderType, isRead: false } }
      );
      io.to(String(userId)).emit("messages_read", { userId, readerType });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  });

  socket.on("disconnect", async () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      const lastSeen = new Date().toISOString();
      try {
        await User.update({ lastSeen }, { where: { id: socket.userId } });
      } catch (e) { /* ignore */ }
      io.to("admin_room").emit("user_status_change", { userId: socket.userId, isOnline: false, lastSeen });
    }
  });
});

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});