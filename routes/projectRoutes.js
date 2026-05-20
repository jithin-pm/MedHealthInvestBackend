const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authMiddleware, adminMiddleware } = require("../middlewares/authMiddleware");

// Ensure uploads directory exists
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Route to add a new project with image and video uploads
router.patch(
  "/add",
  authMiddleware,
  adminMiddleware,
  upload.fields([
    { name: "projectImages", maxCount: 4 },
  ]),
  projectController.addProject
);

// Route to edit an existing project
router.patch(
  "/edit/:id",
  authMiddleware,
  adminMiddleware,
  upload.fields([
    { name: "projectImages", maxCount: 4 },
  ]),
  projectController.editProject
);

// Route to get all projects
router.get("/all", projectController.getAllProjects);
router.get("/get/:id", projectController.getProjectById);

// Route to delete a project
router.delete("/delete/:id", authMiddleware, adminMiddleware, projectController.deleteProject);

module.exports = router;
