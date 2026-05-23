const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "medhealthinvest_db"
});

connection.connect((err) => {
  if (err) {
    console.error("DB connection error:", err);
    process.exit(1);
  }

  // Disable foreign key checks
  connection.query("SET FOREIGN_KEY_CHECKS = 0;", (fkErr) => {
    if (fkErr) {
      console.error(fkErr);
      connection.end();
      process.exit(1);
    }

    // Drop tables if exist
    connection.query("DROP TABLE IF EXISTS bank_details;", (dropBankErr) => {
      if (dropBankErr) console.error(dropBankErr);
      
      connection.query("DROP TABLE IF EXISTS pan_details;", (dropPanErr) => {
        if (dropPanErr) console.error(dropPanErr);

        // Recreate bank_details with exact original schema shown in screenshot
        const createBankSql = `
          CREATE TABLE bank_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            account_number VARCHAR(50) NULL,
            ifsc_code VARCHAR(20) NULL,
            bank_status ENUM('pending', 'verified', 'failed') DEFAULT 'pending',
            verified_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `;

        connection.query(createBankSql, (createBankErr) => {
          if (createBankErr) {
            console.error("Error creating bank_details:", createBankErr);
            connection.end();
            process.exit(1);
          }
          console.log("Recreated original bank_details table!");

          // Recreate pan_details with exact original schema
          const createPanSql = `
            CREATE TABLE pan_details (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NULL,
              pan_number VARCHAR(20) NULL,
              pan_status ENUM('pending', 'verified', 'failed') DEFAULT 'pending',
              verified_at TIMESTAMP NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `;

          connection.query(createPanSql, (createPanErr) => {
            if (createPanErr) {
              console.error("Error creating pan_details:", createPanErr);
              connection.end();
              process.exit(1);
            }
            console.log("Recreated original pan_details table!");

            // Re-enable foreign key checks
            connection.query("SET FOREIGN_KEY_CHECKS = 1;", (fkOnErr) => {
              connection.end();
              if (fkOnErr) {
                console.error(fkOnErr);
                process.exit(1);
              }
              console.log("Foreign key checks restored successfully.");
              process.exit(0);
            });
          });
        });
      });
    });
  });
});
