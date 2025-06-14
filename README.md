# Kuzu MCP Server

A Model Context Protocol (MCP) server that provides seamless access to [Kuzu](https://kuzudb.com/) graph databases. This integration enables Large Language Models (LLMs) like Claude to inspect database schemas and execute Cypher queries on Kuzu databases, with a particular focus on path invariance analysis and category theory applications.

## New Features

- **Path Invariance Analysis**: Support for analyzing path invariance properties in graph structures (see [PATH_INVARIANCE.md](docs/PATH_INVARIANCE.md))
- **Pulse Server Integration**: Connect with the Pulse MCP server for semantic search of MCP capabilities
- **Progress Callback Integration**: Improved API usage with proper progress callbacks for all database operations
- **Example Scripts**: Demonstration scripts for path invariance concepts and MCP server integration

## Features

- **Schema Exploration**: Retrieve the complete structure of your Kuzu database, including node tables, relationship tables, and their properties
- **Query Execution**: Run Cypher queries directly against your Kuzu database
- **Natural Language to Cypher**: Generate optimized Kuzu-compatible Cypher queries from natural language questions
- **Read-Only Mode**: Optional protection against database modifications
- **Docker Support**: Run as a containerized service for enhanced portability and isolation

## Quick Start

### Prerequisites

- Node.js 18+ (or Docker)
- A Kuzu database (or use the provided setup script to create a sample database)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/kuzu-mcp-server.git
cd kuzu-mcp-server

# Install dependencies
npm install

# Initialize a sample database (optional)
node setup-db.js
```

### Running the Server

#### Using Node.js

```bash
# Start with a specific database path
node index.js /path/to/your/kuzu/database

# Start with environment variable
export KUZU_DB_PATH=/path/to/your/kuzu/database
node index.js

# Start in read-only mode
export KUZU_READ_ONLY=true
node index.js /path/to/your/kuzu/database
```

#### Using Docker

```bash
# Build the image
docker build -t kuzu-mcp-server .

# Run the container
docker run -v /path/to/your/kuzu/database:/database --rm -i kuzu-mcp-server

# Run in read-only mode
docker run -v /path/to/your/kuzu/database:/database -e KUZU_READ_ONLY=true --rm -i kuzu-mcp-server
```

## Integration with Claude Desktop

### Configure MCP in Claude Desktop

Edit the Claude Desktop configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

#### Using Node.js

```json
{
  "mcpServers": {
    "kuzu": {
      "command": "node",
      "args": [
        "/absolute/path/to/kuzu-mcp-server/index.js",
        "/absolute/path/to/kuzu/database"
      ],
      "description": "Kuzu graph database integration",
      "disabled": false,
      "autoApprove": [
        "getSchema",
        "graphQuery",
        "generateKuzuCypher"
      ]
    }
  }
}
```

#### Using Docker

```json
{
  "mcpServers": {
    "kuzu": {
      "command": "docker",
      "args": [
        "run",
        "-v",
        "/absolute/path/to/kuzu/database:/database",
        "--rm",
        "-i",
        "kuzu-mcp-server"
      ],
      "description": "Kuzu graph database integration",
      "disabled": false,
      "autoApprove": [
        "getSchema",
        "graphQuery",
        "generateKuzuCypher"
      ]
    }
  }
}
```

### Read-Only Mode

To prevent any database modifications, enable read-only mode by adding the `KUZU_READ_ONLY` environment variable:

```json
{
  "mcpServers": {
    "kuzu": {
      "command": "docker",
      "args": [
        "run",
        "-v",
        "/absolute/path/to/kuzu/database:/database",
        "-e",
        "KUZU_READ_ONLY=true",
        "--rm",
        "-i",
        "kuzu-mcp-server"
      ]
    }
  }
}
```

## Using the MCP Tools in Claude

Once configured, you can use the following tools in your conversations with Claude:

### Tool: getSchema

Retrieves the complete database schema, including all node and relationship tables with their properties.

```
To analyze this database, I need to understand its structure.

<mcp:kuzu:getSchema>
</mcp:kuzu:getSchema>
```

### Tool: graphQuery

Executes a Cypher query against the database and returns the results.

```
<mcp:kuzu:graphQuery>
MATCH (p:Person)-[r:LivesIn]->(c:City)
WHERE c.country = 'USA'
RETURN p.name, c.name, r.since
</mcp:kuzu:graphQuery>
```

### Prompt: generateKuzuCypher

Generates a Kuzu-compatible Cypher query from a natural language question.

```
<mcp:kuzu:generateKuzuCypher>
Find all people who live in cities in the USA and have friendships with strength greater than 0.7
</mcp:kuzu:generateKuzuCypher>
```

## Setup Script

The included `setup-db.js` script provides several helpful features:

- Creates a new Kuzu database with a sample schema (people, cities, and their relationships)
- Detects existing Kuzu configuration in MCP configuration files
- Updates the global MCP configuration to include the Kuzu server

To use the setup script:

```bash
# Use the default database path
node setup-db.js

# Specify a custom database path
node setup-db.js /path/to/your/kuzu/database
```

## Sample Database Schema

The setup script creates a sample database with the following schema:

### Node Tables

- **Person**
  - Properties: name (STRING, PK), age (INT64)
  
- **City**
  - Properties: name (STRING, PK), country (STRING)

### Relationship Tables

- **LivesIn**
  - From: Person
  - To: City
  - Properties: since (INT64)
  
- **Friendship**
  - From: Person
  - To: Person
  - Properties: strength (FLOAT)

## Cypher Query Examples

Here are some example queries you can try with the sample database:

```cypher
# Get all people and their ages
MATCH (p:Person)
RETURN p.name, p.age
ORDER BY p.age DESC;

# Find where each person lives
MATCH (p:Person)-[r:LivesIn]->(c:City)
RETURN p.name, c.name, c.country, r.since;

# Find friendships with high strength (>0.7)
MATCH (p1:Person)-[r:Friendship]->(p2:Person)
WHERE r.strength > 0.7
RETURN p1.name, p2.name, r.strength
ORDER BY r.strength DESC;

# Find people who live in cities in a specific country
MATCH (p:Person)-[:LivesIn]->(c:City)
WHERE c.country = 'USA'
RETURN p.name, c.name;

# Find people who moved to their city after 2018
MATCH (p:Person)-[r:LivesIn]->(c:City)
WHERE r.since >= 2018
RETURN p.name, c.name, r.since;
```

## Kuzu Cypher Syntax Notes

The following Kuzu-specific Cypher syntax guides are provided to help with query generation:

1. Always specify node and relationship labels explicitly in the `CREATE` and `MERGE` clauses
2. Use `RETURN COUNT(*)` instead of `FINISH` (which is not supported in Kuzu)
3. Use `UNWIND` instead of `FOREACH` (not supported)
4. Use `LOAD FROM` instead of `LOAD CSV FROM`
5. Relationship patterns must include brackets: ` - [] - `, ` - [] -> `, ` < -[] -`
6. Kuzu adopts walk semantics (allows repeated edges) for patterns in `MATCH` clauses
7. Variable length relationships need an upper bound (default is 30 if not specified)
8. Use `SHORTEST` or `ALL SHORTEST` for path algorithms: `MATCH(n) - [r * SHORTEST 1..10] -> (m)`
9. Use `SET n.prop = NULL` instead of `REMOVE` (not supported)
10. Properties must be updated with `n.prop = expression` format
11. The `USE` graph clause is not supported
12. Filters must be in a separate `WHERE` clause, not inside node/relationship patterns
13. Use explicit labels in patterns instead of label filtering in WHERE clauses

## Development

### Building the Docker Image

```bash
docker build -t kuzu-mcp-server .
```

### Environmental Variables

- `KUZU_DB_PATH`: Path to the Kuzu database directory
- `KUZU_READ_ONLY`: Set to "true" to enable read-only mode

## License

MIT License - See the LICENSE file for details.

## Example Scripts

The server includes example scripts to demonstrate path invariance concepts:

```bash
# Run the path invariance examples
node examples/path_invariance_examples.js

# Run the Kuzu-Pulse integration example
node examples/kuzu_pulse_integration.js

# Or use the convenience script to run all examples
../run-kuzu-examples.sh
```

## Documentation

- [PATH_INVARIANCE.md](docs/PATH_INVARIANCE.md) - Detailed explanation of path invariance concepts in graph databases
- [UPGRADE-REPORT.md](UPGRADE-REPORT.md) - Report on recent improvements to the server

## Links

- [Kuzu Database](https://kuzudb.com/)
- [Model Context Protocol (MCP)](https://github.com/anthropics/anthropic-cookbook/tree/main/model_context_protocol)
- [Claude Documentation](https://docs.anthropic.com/claude/docs/model-context-protocol)
- [Infinity Topos Framework](https://github.com/infinity-topos/framework)

## Troubleshooting

### Common Issues

1. **Database Path Not Found**: Ensure the specified database path exists and is accessible
2. **Permission Issues**: Check that your user has read/write permissions to the database directory
3. **Docker Volume Mounting**: Verify that the absolute path to your database is correctly specified when using Docker

### Logs and Debugging

The server outputs information about:
- Database path and read-only mode status
- Schema information (number of node and relationship tables found)
- Query execution errors

For more detailed debugging, you can run the server with Node.js debugging options:

```bash
NODE_DEBUG=* node index.js /path/to/database
```