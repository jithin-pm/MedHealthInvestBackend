const db = require('../config/db');

async function cleanIndexes() {
  const tables = ['admins', 'users', 'categories'];
  
  for (const table of tables) {
    try {
      const [indexes] = await db.query(`SHOW INDEX FROM \`${table}\``);
      // Filter out PRIMARY and the first occurrence of valid indexes
      const keyNames = indexes.map(i => i.Key_name);
      // We only want to keep PRIMARY and the base 'email' or 'name' etc.
      // Usually the duplicates look like email_2, email_3 etc.
      const toDrop = keyNames.filter(k => k.match(/_(2|3|4|5|6|7|8|9|[1-6][0-9])$/));
      
      // Deduplicate the list since SHOW INDEX returns multiple rows for composite indexes
      const uniqueToDrop = [...new Set(toDrop)];
      
      console.log(`Found ${uniqueToDrop.length} redundant indexes in ${table}`);
      
      for (const key of uniqueToDrop) {
        console.log(`Dropping ${key} from ${table}...`);
        try {
          await db.query(`ALTER TABLE \`${table}\` DROP INDEX \`${key}\``);
        } catch (e) {
          console.warn(`Failed to drop ${key}: ${e.message}`);
        }
      }
    } catch (err) {
      console.error(`Error processing ${table}:`, err.message);
    }
  }
  process.exit(0);
}

cleanIndexes();
