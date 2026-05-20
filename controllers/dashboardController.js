const { Op } = require("sequelize");
const User = require("../models/userModel");
const Project = require("../models/projectModel");
const Enquiry = require("../models/enquiryModel");

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Total Users
    const totalUsers = await User.count({
      where: {
        role: 'user'
      }
    });

    // 2. New Users Today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const newUsersToday = await User.count({
      where: {
        role: 'user',
        created_at: {
          [Op.gte]: todayStart
        }
      }
    });

    // 3. Enquiries Last 7 Days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    const enquiriesLast7Days = await Enquiry.count({
      where: {
        enquiryType: 'General',
        createdAt: {
          [Op.gte]: sevenDaysAgo
        }
      }
    });

    // 4. Project Statistics
    const projects = await Project.findAll();

    const stats = {
      totalUsers,
      newUsersToday,
      enquiriesLast7Days,
      projectStats: {
        active: {
          standard: projects.filter(p => p.status === 'ACTIVE' && p.projectType === 'Standard').length,
          exclusive: projects.filter(p => p.status === 'ACTIVE' && p.projectType === 'Exclusive').length
        },
        ongoing: {
          standard: projects.filter(p => p.status === 'ONGOING' && p.projectType === 'Standard').length,
          exclusive: projects.filter(p => p.status === 'ONGOING' && p.projectType === 'Exclusive').length
        },
        completed: {
          standard: projects.filter(p => p.status === 'COMPLETED' && p.projectType === 'Standard').length,
          exclusive: projects.filter(p => p.status === 'COMPLETED' && p.projectType === 'Exclusive').length
        }
      }
    };

    // Calculate trends (mocked for now as we don't have historical data stored simply, but we could calculate if needed)
    // For now I'll just return the current values.
    // The user requested dynamic data, so I'll provide the counts.
    
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
