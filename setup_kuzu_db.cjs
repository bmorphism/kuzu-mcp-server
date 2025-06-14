const kuzu = require('kuzu');
const fs = require('fs');
const path = require('path');

(async () => {
  const dbPath = path.join(__dirname, '..', 'kuzu-test-db');
  const db = new kuzu.Database(dbPath, 0, true, false);
  const conn = new kuzu.Connection(db);

  try {
    // Load schema
    console.log('Loading schema...');
    const schema = fs.readFileSync(path.join(__dirname, '..', 'prime_number_schema_v2.cypher'), 'utf8');
    const schemaStatements = schema.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
    console.log('Found', schemaStatements.length, 'schema statements');
    
    for (const stmt of schemaStatements) {
      const cleanStmt = stmt.trim();
      if (cleanStmt) {
        console.log('Executing:', cleanStmt.substring(0, 50) + '...');
        try {
          const result = await conn.query(cleanStmt + ';');
          await result.close();
          console.log('Success!');
        } catch (e) {
          console.error('Failed:', e.message);
          throw e;
        }
      }
    }
    
    // Load data
    console.log('\nLoading data...');
    const data = fs.readFileSync(path.join(__dirname, '..', 'prime_data.cypher'), 'utf8');
    const dataStatements = data.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
    
    for (const stmt of dataStatements) {
      const cleanStmt = stmt.trim();
      if (cleanStmt) {
        console.log('Executing:', cleanStmt.substring(0, 50) + '...');
        const result = await conn.query(cleanStmt + ';');
        await result.close();
      }
    }
    
    // Test query
    console.log('\nTesting query...');
    const testResult = await conn.query('MATCH (n:Number) RETURN n.value, n.is_prime LIMIT 5;');
    const rows = await testResult.getAll();
    console.log('Sample data:', rows);
    await testResult.close();
    
    console.log('\nDatabase setup complete!');
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
  } finally {
    conn.close();
  }
})();