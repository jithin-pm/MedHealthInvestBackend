const db = require('../config/db');

async function checkIndexes() {
  try {
    const [results] = await db.query(`
      SELECT TABLE_NAME, COUNT(INDEX_NAME) as index_count 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = 'u689598822_medHealth'
      GROUP BY TABLE_NAME 
      ORDER BY index_count DESC;
    `);
    
    console.log("Index counts by table:");
    console.table(results);
    
    // For the top table, list the indexes
    if (results.length > 0) {
      const topTable = results[0].TABLE_NAME;
      const [indexes] = await db.query(`SHOW INDEX FROM \`${topTable}\``);
      console.log(`\nIndexes in ${topTable}:`);
      console.log(indexes.map(i => i.Key_name).join(', '));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkIndexes();
