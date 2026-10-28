const sequelize = require('../config/db');

/**
 * Generates the next sequential unique user ID in the format: MHI{YEAR}{SEQ}
 * e.g., MHI202634
 * 
 * Guarantees uniqueness even if users are deleted, by atomically incrementing
 * a persistent sequence tracker in user_id_sequences table.
 */
async function generateNextCustomUserId(targetYear = new Date().getFullYear()) {
  const year = parseInt(targetYear, 10) || new Date().getFullYear();

  // Atomically increment last_number for the year using INSERT ... ON DUPLICATE KEY UPDATE
  await sequelize.query(`
    INSERT INTO user_id_sequences (year, last_number)
    VALUES (:year, 1)
    ON DUPLICATE KEY UPDATE last_number = last_number + 1
  `, {
    replacements: { year }
  });

  // Fetch the incremented number
  const [rows] = await sequelize.query(`
    SELECT last_number FROM user_id_sequences WHERE year = :year
  `, {
    replacements: { year }
  });

  const nextSeq = rows[0]?.last_number || 1;
  const paddedSeq = String(nextSeq).padStart(2, '0');
  return `MHI${year}${paddedSeq}`;
}

module.exports = { generateNextCustomUserId };
