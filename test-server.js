/**
 * test-server.js - Test script for the Kuzu MCP server
 * 
 * This script tests local functionality of the Kuzu MCP server
 * by simulating tool calls without requiring an actual MCP client.
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

// Initialize database connection
console.log(`Connecting to Kuzu database at: ${dbPath}`);
const db = new kuzu.Database(dbPath, 0, true, false);
const conn = new kuzu.Connection(db);

// Helper function to format query results nicely
const formatResult = (result) => {
  return JSON.stringify(result, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2);
};

// Function to simulate MCP tool calls
const simulateToolCall = async (toolName, params) => {
  console.log(`\n----- Simulating call to tool: ${toolName} -----`);
  console.log(`Parameters: ${JSON.stringify(params, null, 2)}`);
  
  try {
    if (toolName === 'query') {
      const { cypher } = params;
      console.log(`Executing Cypher query: ${cypher}`);
      
      const result = conn.execute(cypher);
      const rows = result.getAll();
      result.close();
      
      console.log(`Result: ${formatResult(rows)}`);
      return rows;
    }
    else if (toolName === 'getSchema') {
      console.log(`Getting schema information...`);
      
      // Get tables
      const tablesResult = conn.execute("CALL show_tables() RETURN *;");
      const tables = tablesResult.getAll();
      tablesResult.close();
      
      console.log(`Found ${tables.length} tables`);
      
      // Process table information
      const schema = {
        nodeTables: [],
        relTables: []
      };
      
      for (const table of tables) {
        // Get table properties
        const propertiesResult = conn.execute(`CALL TABLE_INFO('${table.name}') RETURN *;`);
        const properties = propertiesResult.getAll();
        propertiesResult.close();
        
        // Format properties
        const formattedProps = properties.map(prop => ({
          name: prop.name,
          type: prop.type,
          isPrimaryKey: prop["primary key"]
        }));
        
        if (table.type === 'NODE') {
          schema.nodeTables.push({
            name: table.name,
            properties: formattedProps
          });
        } 
        else if (table.type === 'REL') {
          // Get relationship connectivity
          const connResult = conn.execute(`CALL SHOW_CONNECTION('${table.name}') RETURN *;`);
          const connectivity = connResult.getAll();
          connResult.close();
          
          schema.relTables.push({
            name: table.name,
            properties: formattedProps.map(p => {
              const { isPrimaryKey, ...rest } = p;
              return rest;
            }),
            connectivity: connectivity.map(c => ({
              src: c["source table name"],
              dst: c["destination table name"]
            }))
          });
        }
      }
      
      console.log(`Schema: ${formatResult(schema)}`);
      return schema;
    }
    else {
      console.error(`Unknown tool: ${toolName}`);
      return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return { error: error.message };
  }
};

// Run test queries
const runTests = async () => {
  try {
    // Test 1: Get schema
    await simulateToolCall('getSchema', {});
    
    // Test 2: Run a simple query
    await simulateToolCall('query', {
      cypher: 'MATCH (p:Person) RETURN p.name, p.age, p.occupation'
    });
    
    // Test 3: Run a more complex query with joins
    await simulateToolCall('query', {
      cypher: `
        MATCH (p:Person)-[r:UNDERSTANDS]->(c:Concept)
        RETURN p.name as person, c.name as concept, r.proficiency as proficiency
      `
    });
    
    // Test 4: Look for path relationships
    await simulateToolCall('query', {
      cypher: `
        MATCH path = (p1:Person)-[r1:KNOWS]->(:Person)-[r2:KNOWS]->(p2:Person)
        WHERE p1.id = 1 
        RETURN p1.name as source, p2.name as destination
      `
    });
    
    // Test 5: Find relationships between concepts
    await simulateToolCall('query', {
      cypher: `
        MATCH (c1:Concept)-[r:RELATED_TO]->(c2:Concept)
        RETURN c1.name as concept1, c2.name as concept2, 
               r.relationship_type as relationship, r.strength as strength
      `
    });
    
    console.log("\n----- All tests completed successfully -----");
  } catch (error) {
    console.error("Test execution failed:", error);
  }
};

// Run the tests
runTests()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Tests failed:', error);
    process.exit(1);
  });