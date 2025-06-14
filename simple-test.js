/**
 * simple-test.js - Quick test script for verifying Kuzu MCP server functionality
 */

const kuzu = require('kuzu');
const path = require('path');
const fs = require('fs');

// Database configuration
const dbPath = process.env.KUZU_DB_PATH || path.join(__dirname, 'kuzu_data');

console.log(`Testing Kuzu database at: ${dbPath}`);

// Progress callback function
const progressCallback = (pipelineProgress, numPipelinesFinished, numPipelines) => {
  console.log(`Progress: ${pipelineProgress}, Pipelines: ${numPipelinesFinished}/${numPipelines}`);
};

// Initialize database connection
const db = new kuzu.Database(dbPath, 0, true, false);
const conn = new kuzu.Connection(db);

// Execute a query with proper error handling
const executeQuery = async (query) => {
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

// Run a series of test queries
async function runTests() {
  try {
    // Test 1: Check for database tables
    console.log('\n🧪 Test 1: Show Tables');
    const tables = await executeQuery('CALL show_tables() RETURN *');
    console.log('Tables:', tables);
    
    // Test 2: Query Person nodes
    console.log('\n🧪 Test 2: Query Person Nodes');
    const persons = await executeQuery('MATCH (p:Person) RETURN p.id, p.name, p.age, p.occupation');
    console.log('Persons:', persons);

    // Test 3: Query relationships between nodes
    console.log('\n🧪 Test 3: Query Relationships');
    const relations = await executeQuery(`
      MATCH (p1:Person)-[r:KNOWS]->(p2:Person)
      RETURN p1.name AS person1, p2.name AS person2, r.since AS since, r.strength AS strength
    `);
    console.log('Relationships:', relations);

    // Test 4: Path query
    console.log('\n🧪 Test 4: Path Query');
    const paths = await executeQuery(`
      MATCH path = (p:Person)-[*1..3]->(c:Concept)
      RETURN p.name AS person, c.name AS concept, length(path) AS path_length
      LIMIT 5
    `);
    console.log('Paths:', paths);

    // Test 5: Count nodes by type
    console.log('\n🧪 Test 5: Count Nodes by Type');
    const counts = await executeQuery(`
      MATCH (n)
      RETURN labels(n) AS type, COUNT(*) AS count
    `);
    console.log('Node counts:', counts);

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests()
  .then(() => {
    console.log('\nTests completed, closing connection.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nTest suite failed:', error);
    process.exit(1);
  });