/**
 * setup-with-callback.js - Initialize the Kuzu database with schema and sample data
 * This version includes the required progress callback function
 */

const kuzu = require('kuzu');
const path = require('path');
const fs = require('fs');

// Process command line arguments for database path
const args = process.argv.slice(2);
let dbPath;

if (args.length === 0) {
  const envDbPath = process.env.KUZU_DB_PATH;
  if (envDbPath) {
    dbPath = envDbPath;
  } else {
    dbPath = path.join(__dirname, 'kuzu_data');
    console.log(`No path provided, using default: ${dbPath}`);
  }
} else {
  dbPath = args[0];
}

// Create directory if it doesn't exist
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
  console.log(`Created database directory: ${dbPath}`);
}

// Initialize database
console.log(`Initializing Kuzu database at: ${dbPath}`);
const db = new kuzu.Database(dbPath, 0, true, false);  // 3rd param: create if not exists
const conn = new kuzu.Connection(db);

// Progress callback function
const progressCallback = (pipelineProgress, numPipelinesFinished, numPipelines) => {
  // Can use this to show progress if desired
  // console.log(`Progress: ${pipelineProgress}, Finished: ${numPipelinesFinished}/${numPipelines}`);
};

// Schema creation helper function with progress callback
const executeQuery = async (query, params = {}) => {
  try {
    console.log(`Executing: ${query}`);
    const result = await conn.query(query, progressCallback);
    const rows = await result.getAll();
    result.close();
    return rows;
  } catch (error) {
    console.error(`Error executing query: ${query}`);
    console.error(error);
    throw error;
  }
};

// Main setup function
async function setupDatabase() {
  try {
    // Create node tables
    await executeQuery(`
      CREATE NODE TABLE IF NOT EXISTS Person (
        id INT64 PRIMARY KEY,
        name STRING,
        age INT64,
        occupation STRING
      )
    `);

    await executeQuery(`
      CREATE NODE TABLE IF NOT EXISTS Location (
        id INT64 PRIMARY KEY,
        name STRING,
        type STRING,
        latitude DOUBLE,
        longitude DOUBLE
      )
    `);

    await executeQuery(`
      CREATE NODE TABLE IF NOT EXISTS Concept (
        id INT64 PRIMARY KEY,
        name STRING,
        description STRING,
        field STRING
      )
    `);

    // Create relationship tables
    await executeQuery(`
      CREATE REL TABLE IF NOT EXISTS KNOWS (
        FROM Person TO Person,
        since STRING,
        strength FLOAT
      )
    `);

    await executeQuery(`
      CREATE REL TABLE IF NOT EXISTS LIVES_IN (
        FROM Person TO Location,
        since STRING,
        is_primary BOOLEAN
      )
    `);

    await executeQuery(`
      CREATE REL TABLE IF NOT EXISTS VISITED (
        FROM Person TO Location,
        date STRING,
        purpose STRING
      )
    `);

    await executeQuery(`
      CREATE REL TABLE IF NOT EXISTS UNDERSTANDS (
        FROM Person TO Concept,
        proficiency INT64,
        learned_date STRING
      )
    `);

    await executeQuery(`
      CREATE REL TABLE IF NOT EXISTS RELATED_TO (
        FROM Concept TO Concept,
        relationship_type STRING,
        strength FLOAT
      )
    `);

    // Check if we have any data
    const personQuery = await executeQuery(`MATCH (p:Person) RETURN COUNT(*) as count`);
    const personCount = personQuery && personQuery[0] ? personQuery[0].count : 0;
    
    console.log(`Person count: ${personCount}`);
    
    // Insert sample data if empty
    if (personCount === 0) {
      console.log('Inserting sample data...');
      
      // Insert Persons
      await executeQuery(`
        CREATE (p:Person {id: 1, name: 'Alice', age: 30, occupation: 'Data Scientist'})
      `);
      await executeQuery(`
        CREATE (p:Person {id: 2, name: 'Bob', age: 28, occupation: 'Software Engineer'})
      `);
      await executeQuery(`
        CREATE (p:Person {id: 3, name: 'Charlie', age: 35, occupation: 'Mathematician'})
      `);

      // Insert Locations
      await executeQuery(`
        CREATE (l:Location {id: 1, name: 'San Francisco', type: 'City', latitude: 37.7749, longitude: -122.4194})
      `);
      await executeQuery(`
        CREATE (l:Location {id: 2, name: 'New York', type: 'City', latitude: 40.7128, longitude: -74.0060})
      `);
      await executeQuery(`
        CREATE (l:Location {id: 3, name: 'Berkeley', type: 'University', latitude: 37.8719, longitude: -122.2585})
      `);

      // Insert Concepts
      await executeQuery(`
        CREATE (c:Concept {id: 1, name: 'Category Theory', description: 'Mathematical study of abstract structures', field: 'Mathematics'})
      `);
      await executeQuery(`
        CREATE (c:Concept {id: 2, name: 'Path Invariance', description: 'Property where outcomes remain consistent regardless of the specific path taken', field: 'Computer Science'})
      `);
      await executeQuery(`
        CREATE (c:Concept {id: 3, name: 'Graph Database', description: 'Database that uses graph structures for semantic queries', field: 'Computer Science'})
      `);

      // Create relationships
      await executeQuery(`
        MATCH (a:Person {id: 1}), (b:Person {id: 2})
        CREATE (a)-[r:KNOWS {since: '2020', strength: 0.8}]->(b)
      `);
      await executeQuery(`
        MATCH (a:Person {id: 2}), (b:Person {id: 3})
        CREATE (a)-[r:KNOWS {since: '2018', strength: 0.9}]->(b)
      `);
      await executeQuery(`
        MATCH (a:Person {id: 1}), (l:Location {id: 1})
        CREATE (a)-[r:LIVES_IN {since: '2019', is_primary: true}]->(l)
      `);
      await executeQuery(`
        MATCH (a:Person {id: 2}), (l:Location {id: 2})
        CREATE (a)-[r:LIVES_IN {since: '2015', is_primary: true}]->(l)
      `);
      await executeQuery(`
        MATCH (a:Person {id: 3}), (l:Location {id: 3})
        CREATE (a)-[r:VISITED {date: '2023-05-15', purpose: 'Conference'}]->(l)
      `);
      await executeQuery(`
        MATCH (a:Person {id: 1}), (c:Concept {id: 1})
        CREATE (a)-[r:UNDERSTANDS {proficiency: 4, learned_date: '2022-01-10'}]->(c)
      `);
      await executeQuery(`
        MATCH (a:Person {id: 3}), (c:Concept {id: 2})
        CREATE (a)-[r:UNDERSTANDS {proficiency: 5, learned_date: '2021-07-22'}]->(c)
      `);
      await executeQuery(`
        MATCH (c1:Concept {id: 1}), (c2:Concept {id: 2})
        CREATE (c1)-[r:RELATED_TO {relationship_type: 'Foundation', strength: 0.7}]->(c2)
      `);
    }

    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Error during database setup:', error);
    process.exit(1);
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    console.log('Setup completed successfully, listing tables...');
    return conn.query('CALL show_tables() RETURN *', progressCallback)
      .then(res => res.getAll())
      .then(tables => {
        console.log('Tables in database:', tables);
        process.exit(0);
      });
  })
  .catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });