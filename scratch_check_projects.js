const Project = require("./models/projectModel");
const sequelize = require("./config/db");

async function checkProjects() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    
    const projects = await Project.findAll();
    console.log(`Found ${projects.length} projects:`);
    projects.forEach(p => {
      console.log(`- ID: ${p.id}, Name: ${p.projectName}, Type: ${p.projectType}, Status: ${p.status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
}

checkProjects();
