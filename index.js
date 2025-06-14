const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const kuzu = require("kuzu");
const fs = require("fs");
const path = require("path");

const TABLE_TYPES = {
  NODE: "NODE",
  REL: "REL",
};

// Handle BigInt serialization in JSON
const bigIntReplacer = (_, value) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

// Initialize server
const server = new Server(
  {
    name: "kuzu",
    version: "0.2.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  },
);

// Get database path from command line args or environment variables
let dbPath;
const args = process.argv.slice(2);
if (args.length === 0) {
  const envDbPath = process.env.KUZU_DB_PATH;
  if (envDbPath) {
    dbPath = envDbPath;
  } else {
    console.error(
      "Please provide a path to kuzu database as a command line argument or set KUZU_DB_PATH environment variable",
    );
    process.exit(1);
  }
} else {
  dbPath = args[0];
}

// Check if database directory exists, if not, create it
if (!fs.existsSync(dbPath)) {
  try {
    fs.mkdirSync(dbPath, { recursive: true });
    console.log(`Created new database directory at ${dbPath}`);
  } catch (error) {
    console.error(`Failed to create database directory: ${error.message}`);
    process.exit(1);
  }
}

// Check if database should be read-only
const isReadOnly = process.env.KUZU_READ_ONLY === "true";

// Set up graceful shutdown
process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

// Initialize database connection with error handling
let db, conn;
try {
  db = new kuzu.Database(dbPath, 0, true, isReadOnly);
  conn = new kuzu.Connection(db);
} catch (error) {
  console.error(`Failed to initialize database connection: ${error.message}`);
  process.exit(1);
}

// Generate Cypher prompt template
const getPrompt = (question, schema) => {
  const prompt = `Task: Generate Kuzu Cypher statement to query a graph database.
Instructions:
Generate the Kuzu dialect of Cypher with the following rules in mind:
1. It is recommended to always specify node and relationship labels explicitly in the \`CREATE\` and \`MERGE\` clause. If not specified, Kuzu will try to infer the label by looking at the schema.
2. \`FINISH\` is recently introduced in GQL and adopted by Neo4j but not yet supported in Kuzu. You can use \`RETURN COUNT(*)\` instead which will only return one record.
3. \`FOREACH\` is not supported. You can use \`UNWIND\` instead.
4. Kuzu can scan files not only in the format of CSV, so the \`LOAD CSV FROM\` clause is renamed to \`LOAD FROM\`.
5. Relationship cannot be omitted. For example \`--\`, \`-- > \` and \`< --\` are not supported. You need to use \` - [] - \`, \` - [] -> \` and \` < -[] -\` instead.
6. Neo4j adopts trail semantic (no repeated edge) for pattern within a \`MATCH\` clause. While Kuzu adopts walk semantic (allow repeated edge) for pattern within a \`MATCH\` clause. You can use \`is_trail\` or \`is_acyclic\` function to check if a path is a trail or acyclic.
7. Since Kuzu adopts trail semantic by default, so a variable length relationship needs to have a upper bound to guarantee the query will terminate. If upper bound is not specified, Kuzu will assign a default value of 30.
8. To run algorithms like (all) shortest path, simply add \`SHORTEST\` or \`ALL SHORTEST\` between the kleene star and lower bound. For example,  \`MATCH(n) - [r * SHORTEST 1..10] -> (m)\`. It is recommended to use \`SHORTEST\` if paths are not needed in the use case.
9. \`REMOVE\` is not supported. Use \`SET n.prop = NULL\` instead.
10. Properties must be updated in the form of \`n.prop = expression\`. Update all properties with map of \` +=\` operator is not supported. Try to update properties one by one.
11. \`USE\` graph is not supported. For Kuzu, each graph is a database.
12. Using \`WHERE\` inside node or relationship pattern is not supported, e.g. \`MATCH(n: Person WHERE a.name = 'Andy') RETURN n\`. You need to write it as \`MATCH(n: Person) WHERE n.name = 'Andy' RETURN n\`.
13. Filter on node or relationship labels is not supported, e.g. \`MATCH (n) WHERE n:Person RETURN n\`. You need to write it as \`MATCH(n: Person) RETURN n\`, or \`MATCH(n) WHERE label(n) = 'Person' RETURN n\`.
14. Any \`SHOW XXX\` clauses become a function call in Kuzu. For example, \`SHOW FUNCTIONS\` in Neo4j is equivalent to \`CALL show_functions() RETURN *\` in Kuzu.
15. Kuzu supports \`EXISTS\` and \`COUNT\` subquery.
16. \`CALL <subquery>\` is not supported.

Use only the provided node types, relationship types and properties in the schema.
Do not use any other node types, relationship types or properties that are not provided explicitly in the schema.
Schema:
${JSON.stringify(schema, null, 2)}
Note: Do not include any explanations or apologies in your responses.
Do not respond to any questions that might ask anything else than for you to construct a Cypher statement.
Do not include any text except the generated Cypher statement.

The question is:
${question}
`;
  return prompt;
};

// Progress callback function for Kuzu API
const progressCallback = (
  pipelineProgress,
  numPipelinesFinished,
  numPipelines,
) => {
  // Optional: Log progress for long-running queries
  // console.log(`Progress: ${pipelineProgress}, Finished: ${numPipelinesFinished}/${numPipelines}`);
};

// Get database schema
const getSchema = async (connection) => {
  try {
    const result = await connection.query(
      "CALL show_tables() RETURN *;",
      progressCallback,
    );
    const tables = await result.getAll();
    result.close();

    const nodeTables = [];
    const relTables = [];

    // Process each table
    for (const table of tables) {
      try {
        // Get table properties
        const propertiesResult = await connection.query(
          `CALL TABLE_INFO('${table.name}') RETURN *;`,
          progressCallback,
        );
        const properties = (await propertiesResult.getAll()).map(
          (property) => ({
            name: property.name,
            type: property.type,
            isPrimaryKey: property["primary key"],
          }),
        );
        propertiesResult.close();

        if (table.type === TABLE_TYPES.NODE) {
          // Process node table
          const nodeTable = {
            name: table.name,
            properties: properties,
          };
          nodeTables.push(nodeTable);
        } else if (table.type === TABLE_TYPES.REL) {
          // Process relationship table
          properties.forEach((property) => {
            delete property.isPrimaryKey;
          });

          // Get relationship connectivity
          const connectivityResult = await connection.query(
            `CALL SHOW_CONNECTION('${table.name}') RETURN *;`,
            progressCallback,
          );
          const connectivity = await connectivityResult.getAll();
          connectivityResult.close();

          const connectivityInfo = connectivity.map((c) => ({
            src: c["source table name"],
            dst: c["destination table name"],
          }));

          const relTable = {
            name: table.name,
            properties: properties,
            connectivity: connectivityInfo,
          };
          relTables.push(relTable);
        }
      } catch (error) {
        console.error(`Error processing table ${table.name}: ${error.message}`);
      }
    }

    // Sort tables by name for consistent output
    nodeTables.sort((a, b) => a.name.localeCompare(b.name));
    relTables.sort((a, b) => a.name.localeCompare(b.name));

    return { nodeTables, relTables };
  } catch (error) {
    console.error(`Error getting schema: ${error.message}`);
    throw error;
  }
};

// Execute a Cypher query with error handling and connection validation
const executeCypherQuery = async (connection, cypher) => {
  if (!connection) {
    throw new Error("Database connection is not available");
  }

  try {
    const queryResult = await connection.query(cypher, progressCallback);
    const rows = await queryResult.getAll();
    queryResult.close();
    return rows;
  } catch (error) {
    console.error(`Error executing query: ${error.message}`);
    console.error(`Query: ${cypher}`);
    throw new Error(`Database query failed: ${error.message}`);
  }
};

// Setup tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "graphQuery",
        description: "Run a Cypher query on the Kuzu database",
        inputSchema: {
          type: "object",
          properties: {
            cypher: {
              type: "string",
              description: "The Cypher query to run",
            },
          },
          required: ["cypher"],
        },
      },
      {
        name: "getSchema",
        description: "Get the schema of the Kuzu database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "healthCheck",
        description:
          "Check the health and status of the Kuzu database connection",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "generateKuzuCypher",
        description:
          "Generate and run a Kuzu Cypher query from natural language",
        inputSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "Natural language question to convert to Cypher",
            },
            execute: {
              type: "boolean",
              description:
                "Whether to execute the generated query (default: false)",
            },
          },
          required: ["question"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params || !request.params.name) {
      throw new Error("Invalid request: missing tool name");
    }

    if (request.params.name === "graphQuery") {
      if (!request.params.arguments || !request.params.arguments.cypher) {
        throw new Error("Missing required parameter: cypher");
      }
      const cypher = request.params.arguments.cypher.trim();
      if (!cypher) {
        throw new Error("Cypher query cannot be empty");
      }
      const rows = await executeCypherQuery(conn, cypher);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, bigIntReplacer, 2),
          },
        ],
        isError: false,
      };
    } else if (request.params.name === "getSchema") {
      const schema = await getSchema(conn);
      return {
        content: [{ type: "text", text: JSON.stringify(schema, null, 2) }],
        isError: false,
      };
    } else if (request.params.name === "healthCheck") {
      try {
        // Test basic database connectivity
        const testResult = await conn.query(
          "CALL show_tables() RETURN *",
          progressCallback,
        );
        const tables = await testResult.getAll();
        testResult.close();

        // Get basic stats
        const stats = {
          status: "healthy",
          dbPath: dbPath,
          readOnly: isReadOnly,
          tablesCount: tables.length,
          timestamp: new Date().toISOString(),
          version: "0.1.0",
        };

        return {
          content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
          isError: false,
        };
      } catch (error) {
        const errorStats = {
          status: "unhealthy",
          dbPath: dbPath,
          readOnly: isReadOnly,
          error: error.message,
          timestamp: new Date().toISOString(),
          version: "0.1.0",
        };

        return {
          content: [
            { type: "text", text: JSON.stringify(errorStats, null, 2) },
          ],
          isError: true,
        };
      }
    } else if (request.params.name === "generateKuzuCypher") {
      // This is a placeholder - the actual implementation would require calling an LLM
      // The client should use the prompt endpoint instead, but we could extend this
      // in the future if we integrate direct LLM access
      return {
        content: [
          {
            type: "text",
            text: "Please use the generateKuzuCypher prompt instead of this tool, as it requires LLM access to generate Cypher from natural language.",
          },
        ],
        isError: false,
      };
    }
    throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (error) {
    console.error(`Tool call error: ${error.message}`);
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Setup prompt handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "generateKuzuCypher",
        description: "Generate a Cypher query for Kuzu",
        arguments: [
          {
            name: "question",
            description:
              "The question in natural language to generate the Cypher query for",
            required: true,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  try {
    if (!request.params || !request.params.name) {
      throw new Error("Invalid request: missing prompt name");
    }

    if (request.params.name === "generateKuzuCypher") {
      if (!request.params.arguments || !request.params.arguments.question) {
        throw new Error("Missing required parameter: question");
      }
      const question = request.params.arguments.question.trim();
      if (!question) {
        throw new Error("Question cannot be empty");
      }
      const schema = await getSchema(conn);
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: getPrompt(question, schema),
            },
          },
        ],
      };
    }
    throw new Error(`Unknown prompt: ${request.params.name}`);
  } catch (error) {
    console.error(`Prompt handler error: ${error.message}`);
    throw error;
  }
});

async function main() {
  console.log(`Starting Kuzu MCP server with database at: ${dbPath}`);
  console.log(`Read-only mode: ${isReadOnly ? "enabled" : "disabled"}`);

  // Validate database connection
  if (!conn) {
    console.error("Database connection failed during initialization");
    process.exit(1);
  }

  // Initialize database if empty
  try {
    // Check if database is initialized
    const tableResult = await conn.query(
      "CALL show_tables() RETURN *;",
      progressCallback,
    );
    const tables = await tableResult.getAll();
    tableResult.close();

    if (tables.length === 0 && !isReadOnly) {
      console.log("Database is empty. Running initial setup...");
      // Run setup script if available
      try {
        const setupScript = path.join(__dirname, "setup-with-callback.js");
        if (fs.existsSync(setupScript)) {
          console.log("Running setup script to initialize database...");
          // We use require here to execute the setup script
          require(setupScript);
          console.log("Database initialization triggered.");
        } else {
          console.warn("Setup script not found. Database will remain empty.");
        }
      } catch (setupError) {
        console.error(`Failed to run setup script: ${setupError.message}`);
      }
    }

    const schema = await getSchema(conn);
    console.log(
      `Connected to database with ${schema.nodeTables.length} node tables and ${schema.relTables.length} relationship tables`,
    );
  } catch (error) {
    console.warn(`Database validation failed: ${error.message}`);
    if (!isReadOnly) {
      console.log("Attempting to continue with potentially empty database...");
    } else {
      console.error("Cannot proceed with read-only mode on invalid database");
      process.exit(1);
    }
  }

  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP server started successfully");
  } catch (error) {
    console.error(`Failed to start MCP server: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
