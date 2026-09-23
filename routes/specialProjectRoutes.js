const express = require("express");
const router = express.Router();
const specialProjectController = require("../controllers/specialProjectController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Route for adding a new special project (with payment proof upload)
router.post(
  "/add",
  upload.single("paymentProof"),
  specialProjectController.addProject
);

// Route for getting all special projects
router.get("/all", specialProjectController.getAllProjects);

// Route for getting a single special project by ID
router.get("/:id", specialProjectController.getProjectById);

// Route for editing a special project (with optional payment proof upload)
router.put(
  "/edit/:id",
  upload.single("paymentProof"),
  specialProjectController.editProject
);

// Route for deleting a special project
router.delete("/delete/:id", specialProjectController.deleteProject);

// Route for getting all special projects for a specific user
router.get("/user/:userId", specialProjectController.getProjectsByUser);

module.exports = router;
