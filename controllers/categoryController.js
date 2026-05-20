const Category = require("../models/categoryModel");
const sequelize = require("../config/db");

const categoryController = {
  addCategory: async (req, res) => {
    try {
      const { name } = req.body;

      const trimmedName = name.trim();

      if (!trimmedName) {
        return res.status(400).json({ message: "Category name is required" });
      }

      // Case-insensitive check if category already exists
      const existingCategory = await Category.findOne({ 
        where: sequelize.where(
          sequelize.fn('lower', sequelize.col('name')), 
          trimmedName.toLowerCase()
        ) 
      });
      
      if (existingCategory) {
        return res.status(400).json({ message: "This category already exists." });
      }

      const newCategory = await Category.create({
        name: trimmedName,
      });

      res.status(201).json({
        message: "Category added successfully",
        category: newCategory,
      });
    } catch (error) {
      console.error("Error in addCategory:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  getAllCategories: async (req, res) => {
    try {
      const categories = await Category.findAll();
      res.status(200).json({ categories });
    } catch (error) {
      console.error("Error in getAllCategories:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },
};

module.exports = categoryController;
