const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");

// Route to add a new category
router.post("/add", categoryController.addCategory);

// Route to get all categories
router.get("/all", categoryController.getAllCategories);

module.exports = router;
