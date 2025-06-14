/**
 * kuzu_pulse_integration.js - Integration between Kuzu graph database and Pulse MCP server
 * 
 * This script demonstrates how to integrate the Kuzu graph database with the Pulse MCP server
 * for enhanced semantic search and knowledge graph capabilities.
 */

const kuzu = require('kuzu');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { promisify } = require('util');

// Database configuration
const KUZU_DB_PATH = process.env.KUZU_DB_PATH || path.join(__dirname, '../kuzu_data');
const PULSE_SERVER_URL = process.env.PULSE_SERVER_URL || 'http://localhost:3334';

// Progress callback function for Kuzu
const progressCallback = (pipelineProgress, numPipelinesFinished, numPipelines) => {
  console.log(`Progress: ${pipelineProgress.toFixed(2)}, Pipelines: ${numPipelinesFinished}/${numPipelines}`);
};

// Function to make HTTP requests to the Pulse MCP server
async function callPulseServer(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    const req = http.request(`${PULSE_SERVER_URL}${endpoint}`, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Function to call Pulse MCP tools
async function callPulseTool(toolName, args) {
  try {
    const data = {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method: 'callTool',
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    const response = await callPulseServer('/jsonrpc', 'POST', data);
    
    if (response.error) {
      throw new Error(`Pulse MCP error: ${response.error.message}`);
    }
    
    return response.result;
  } catch (error) {
    console.error(`Error calling Pulse tool ${toolName}:`, error);
    throw error;
  }
}

// Initialize Kuzu database connection
async function initKuzu() {
  console.log(`Connecting to Kuzu database at: ${KUZU_DB_PATH}`);
  
  const db = new kuzu.Database(KUZU_DB_PATH, 0, true, false);
  const conn = new kuzu.Connection(db);
  
  // Helper function to execute Kuzu queries
  const executeQuery = async (query) => {
    try {
      console.log(`\nExecuting Kuzu query: ${query}`);
      const result = await conn.query(query, progressCallback);
      const rows = await result.getAll();
      result.close();
      return rows;
    } catch (error) {
      console.error(`Error executing Kuzu query: ${query}`);
      console.error(error);
      throw error;
    }
  };
  
  return { conn, executeQuery };
}

// Check if Pulse server is accessible
async function checkPulseServer() {
  try {
    console.log(`Checking Pulse MCP server at: ${PULSE_SERVER_URL}`);
    
    const response = await callPulseServer('/health');
    console.log('Pulse server health check:', response);
    
    return true;
  } catch (error) {
    console.error('Failed to connect to Pulse MCP server:', error);
    return false;
  }
}

// Search MCP servers using Pulse's semantic search
async function searchMCPServers(query) {
  try {
    console.log(`\nSearching MCP servers for: "${query}"`);
    
    const result = await callPulseTool('searchServers', {
      query,
      useEmbeddings: true,
      limit: 5
    });
    
    return result.content[0].text ? JSON.parse(result.content[0].text) : [];
  } catch (error) {
    console.error('Error searching MCP servers:', error);
    return [];
  }
}

// Store MCP server data in Kuzu
async function storeMCPServersInKuzu(executeQuery, servers) {
  console.log('\nStoring MCP server data in Kuzu graph database...');
  
  try {
    // Check if MCPServer node table exists, create if not
    const tableCheck = await executeQuery("CALL show_tables() RETURN *");
    const hasMCPServerTable = tableCheck.some(t => t.name === 'MCPServer');
    
    if (!hasMCPServerTable) {
      // Create node table for MCP servers
      await executeQuery(`
        CREATE NODE TABLE MCPServer (
          id STRING PRIMARY KEY,
          name STRING,
          description STRING,
          url STRING
        )
      `);
      
      // Create node table for MCP tools
      await executeQuery(`
        CREATE NODE TABLE MCPTool (
          id STRING PRIMARY KEY,
          name STRING,
          description STRING
        )
      `);
      
      // Create relationship table between servers and tools
      await executeQuery(`
        CREATE REL TABLE PROVIDES (
          FROM MCPServer TO MCPTool,
          required BOOLEAN,
          description STRING
        )
      `);
      
      // Create relationship table for tool dependencies
      await executeQuery(`
        CREATE REL TABLE DEPENDS_ON (
          FROM MCPTool TO MCPTool,
          is_required BOOLEAN
        )
      `);
      
      console.log('Created MCPServer and MCPTool schema tables');
    }
    
    // Store each server
    for (const server of servers) {
      const serverId = server.id || server.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      
      // Create or update server node
      try {
        await executeQuery(`
          MERGE (s:MCPServer {id: '${serverId}'})
          SET s.name = '${server.name.replace(/'/g, "''")}'
          SET s.description = '${server.description.replace(/'/g, "''")}'
          SET s.url = '${server.url || ''}'
        `);
      } catch (error) {
        console.error(`Error storing server ${serverId}:`, error);
        continue;
      }
      
      // Store tools for this server
      if (server.tools && Array.isArray(server.tools)) {
        for (const tool of server.tools) {
          const toolId = `${serverId}_${tool.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
          
          try {
            // Create or update tool node
            await executeQuery(`
              MERGE (t:MCPTool {id: '${toolId}'})
              SET t.name = '${tool.name.replace(/'/g, "''")}'
              SET t.description = '${(tool.description || '').replace(/'/g, "''")}'
            `);
            
            // Create relationship between server and tool
            await executeQuery(`
              MATCH (s:MCPServer {id: '${serverId}'}), (t:MCPTool {id: '${toolId}'})
              MERGE (s)-[r:PROVIDES]->(t)
              SET r.required = ${tool.required === true}
              SET r.description = '${(tool.description || '').replace(/'/g, "''")}'
            `);
          } catch (error) {
            console.error(`Error storing tool ${toolId}:`, error);
          }
        }
      }
    }
    
    console.log(`Successfully stored ${servers.length} MCP servers in Kuzu`);
    
    return true;
  } catch (error) {
    console.error('Error storing MCP servers in Kuzu:', error);
    return false;
  }
}

// Function to demonstrate path invariance across MCP server tools
async function analyzeToolPathInvariance(executeQuery) {
  console.log('\n🔍 Analyzing path invariance across MCP tools...');
  
  try {
    // Find tools that serve the same function but from different servers
    const equivalentTools = await executeQuery(`
      MATCH (t1:MCPTool), (t2:MCPTool)
      WHERE t1.id <> t2.id AND t1.description CONTAINS t2.name
      RETURN t1.name AS tool1, t2.name AS tool2, 
             t1.description AS description1, t2.description AS description2
      LIMIT 10
    `);
    
    console.log('\n📊 Potentially equivalent tools (path invariance candidates):');
    console.log(JSON.stringify(equivalentTools, null, 2));
    
    // Find servers that provide complementary tool sets
    const complementaryServers = await executeQuery(`
      MATCH (s1:MCPServer)-[:PROVIDES]->(t1:MCPTool)
      MATCH (s2:MCPServer)-[:PROVIDES]->(t2:MCPTool)
      WHERE s1.id <> s2.id
      WITH s1.name AS server1, s2.name AS server2, 
           COUNT(DISTINCT t1) AS tools1, COUNT(DISTINCT t2) AS tools2,
           COUNT(DISTINCT t1) + COUNT(DISTINCT t2) AS total_tools
      MATCH (s1:MCPServer)-[:PROVIDES]->(t:MCPTool)<-[:PROVIDES]-(s2:MCPServer)
      WITH server1, server2, tools1, tools2, total_tools, COUNT(DISTINCT t) AS shared_tools
      WHERE shared_tools > 0 AND shared_tools < total_tools * 0.3
      RETURN server1, server2, tools1, tools2, shared_tools, total_tools,
             (tools1 + tools2 - shared_tools) AS unique_tools
      ORDER BY unique_tools DESC
      LIMIT 5
    `);
    
    console.log('\n📊 Complementary MCP servers:');
    console.log(JSON.stringify(complementaryServers, null, 2));
    
    return {
      equivalentTools,
      complementaryServers
    };
  } catch (error) {
    console.error('Error analyzing tool path invariance:', error);
    return { equivalentTools: [], complementaryServers: [] };
  }
}

// Main function
async function main() {
  try {
    console.log('🌟 KUZU-PULSE MCP INTEGRATION DEMO 🌟');
    
    // Initialize Kuzu
    const { executeQuery } = await initKuzu();
    
    // Check Pulse server
    const pulseAvailable = await checkPulseServer();
    
    if (!pulseAvailable) {
      console.error('⚠️ Pulse MCP server is not available. Some features will be disabled.');
    } else {
      // Search for MCP servers using Pulse
      const servers = await searchMCPServers('graph database');
      
      if (servers.length > 0) {
        console.log(`Found ${servers.length} MCP servers related to "graph database":`);
        servers.forEach((server, i) => {
          console.log(`${i+1}. ${server.name}: ${server.description?.substring(0, 100)}...`);
        });
        
        // Store MCP server data in Kuzu
        await storeMCPServersInKuzu(executeQuery, servers);
      } else {
        console.log('No MCP servers found for the query "graph database"');
      }
    }
    
    // Analyze path invariance in the stored MCP data
    const analysisResults = await analyzeToolPathInvariance(executeQuery);
    
    console.log('\n✅ Integration demo completed successfully!');
    
    // Final path invariance demonstration
    console.log('\n🌐 PATH INVARIANCE DEMONSTRATION');
    console.log('This integration demonstrates path invariance through:');
    console.log('1. Cross-system data flow: Pulse → Kuzu');
    console.log('2. Semantic equivalence discovery between MCP tools');
    console.log('3. Compositional analysis of MCP server capabilities');
    console.log('\nIn a path invariant system, different routes to solving a problem');
    console.log('should yield equivalent results. The MCP ecosystem enables this through');
    console.log('well-defined interfaces and compositional semantics.');
  } catch (error) {
    console.error('\n❌ Error in integration demo:', error);
  } finally {
    process.exit(0);
  }
}

// Run the main function
main();