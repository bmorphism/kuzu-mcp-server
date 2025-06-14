# Kuzu MCP Server

## Overview

The Kuzu MCP Server provides a Model Context Protocol interface to the Kuzu graph database. This integration allows Claude to directly interact with graph data using the Cypher query language, enabling powerful analytical capabilities for network analysis, path exploration, and complex graph traversals.

## Configuration

The server is properly configured in your `.mcp.json` file with:

```json
"kuzu": {
  "command": "node",
  "args": [
    "/Users/barton/infinity-topos/kuzu-mcp-server/index.js"
  ],
  "env": {
    "KUZU_DB_PATH": "/Users/barton/infinity-topos/kuzu-mcp-server/kuzu_data"
  },
  "description": "Kuzu Graph Database MCP Server provides powerful graph operations with Cypher query language, enabling complex path analysis, graph algorithms, and path invariance studies through structured and semantic querying capabilities.",
  "disabled": false,
  "autoApprove": [
    "getSchema",
    "query",
    "generateKuzuCypher"
  ],
  "alwaysAllow": [
    "getSchema",
    "query", 
    "generateKuzuCypher"
  ],
  "tags": ["graph-database", "cypher", "graph-query", "database", "path-invariance"]
}
```

## Database Status

The Kuzu database is initialized with:
- 3 node tables: Person, Location, Concept
- 5 relationship tables: KNOWS, LIVES_IN, VISITED, UNDERSTANDS, RELATED_TO

## Available Tools

The Kuzu MCP server provides three primary tools:

1. **getSchema** - Retrieves the database schema showing all node and relationship tables
   ```
   getSchema {}
   ```

2. **query** - Executes Cypher queries directly on the database
   ```
   query { "cypher": "MATCH (n) RETURN n LIMIT 5" }
   ```

3. **generateKuzuCypher** - Helps generate Cypher queries from natural language
   ```
   generateKuzuCypher { "question": "Find all people who understand Category Theory" }
   ```

## Example Queries

### Basic queries:

```cypher
// Get all nodes
MATCH (n) RETURN n LIMIT 10

// Get all Person nodes
MATCH (p:Person) RETURN p

// Get all relationships
MATCH ()-[r]->() RETURN r LIMIT 10
```

### More complex queries:

```cypher
// Find people who know each other and their relationship strength
MATCH (p1:Person)-[r:KNOWS]->(p2:Person)
RETURN p1.name, p2.name, r.strength
ORDER BY r.strength DESC

// Find people who understand concepts with high proficiency
MATCH (p:Person)-[r:UNDERSTANDS]->(c:Concept)
WHERE r.proficiency > 3
RETURN p.name, c.name, r.proficiency

// Find connections between concepts
MATCH (c1:Concept)-[r:RELATED_TO]->(c2:Concept)
RETURN c1.name, r.relationship_type, r.strength, c2.name
```

### Path queries:

```cypher
// Find all paths between two people up to length 3
MATCH path = (p1:Person {name: 'Alice'})-[*1..3]->(p2:Person {name: 'Charlie'})
RETURN path

// Find shortest paths between people
MATCH path = (p1:Person {name: 'Alice'})-[* SHORTEST 1..5]->(p2:Person)
WHERE p1 <> p2
RETURN path, length(path)
```

## Further Exploration

The Kuzu MCP server is particularly well-suited for:

1. **Network Analysis** - Exploring social connections, collaboration networks, etc.
2. **Path Invariance Studies** - Investigating properties that remain unchanged across different paths in graphs
3. **Knowledge Graphs** - Representing and querying complex domain knowledge
4. **Graph Algorithms** - Using built-in algorithms like shortest path

This integration combines Claude's reasoning with powerful graph database capabilities, enabling sophisticated data exploration and insight generation.