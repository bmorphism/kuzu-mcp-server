/**
 * path_invariance_examples.js - Examples demonstrating path invariance concepts with Kuzu
 * 
 * This file provides examples of querying a graph database in ways that show path invariance,
 * where different routes through the graph yield equivalent or related results.
 */

const kuzu = require('kuzu');
const path = require('path');
const fs = require('fs');

// Database configuration
const dbPath = process.env.KUZU_DB_PATH || path.join(__dirname, '../kuzu_data');

console.log(`Connecting to Kuzu database at: ${dbPath}`);

// Progress callback function
const progressCallback = (pipelineProgress, numPipelinesFinished, numPipelines) => {
  console.log(`Progress: ${pipelineProgress.toFixed(2)}, Pipelines: ${numPipelinesFinished}/${numPipelines}`);
};

// Initialize database connection
const db = new kuzu.Database(dbPath, 0, true, false);
const conn = new kuzu.Connection(db);

// Execute a query with proper error handling
const executeQuery = async (query) => {
  try {
    console.log(`\nExecuting: ${query}`);
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

// Print results in a formatted way
const printResults = (title, results) => {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(results, null, 2));
  console.log("=".repeat(40));
};

/**
 * Example 1: Path Equivalence
 * 
 * This example demonstrates that taking different paths through the graph
 * to reach the same destination yields equivalent results.
 */
async function demoPathEquivalence() {
  console.log("\n🔹 EXAMPLE 1: PATH EQUIVALENCE 🔹");
  
  // Path 1: Direct relationship between Person and Concept
  const directPath = await executeQuery(`
    MATCH (p:Person)-[r:UNDERSTANDS]->(c:Concept)
    RETURN p.name AS person, c.name AS concept, r.proficiency AS proficiency
    ORDER BY p.name, c.name
  `);
  
  printResults("Direct Path (Person → Concept)", directPath);
  
  // Path 2: Indirect relationship through another Person
  const indirectPath = await executeQuery(`
    MATCH (p1:Person)-[:KNOWS]->(p2:Person)-[r:UNDERSTANDS]->(c:Concept)
    RETURN p1.name AS person, c.name AS concept, r.proficiency AS proficiency
    ORDER BY person, concept
  `);
  
  printResults("Indirect Path (Person → Person → Concept)", indirectPath);
  
  // Compare the paths for path invariance properties
  console.log("\n📊 Path Invariance Analysis:");
  console.log("Different paths through the graph reveal different perspectives on the same knowledge network.");
  console.log("Path invariance suggests that there should be a consistent relationship between these different paths.");
}

/**
 * Example 2: Commutative Operations
 * 
 * This example demonstrates that certain operations on the graph commute,
 * meaning the order of operations doesn't affect the final result.
 */
async function demoCommutativeOperations() {
  console.log("\n🔹 EXAMPLE 2: COMMUTATIVE OPERATIONS 🔹");
  
  // Operation 1: Filter by Person first, then by Concept field
  const personFirstFilter = await executeQuery(`
    MATCH (p:Person)-[r:UNDERSTANDS]->(c:Concept)
    WHERE p.age > 30 AND c.field = 'Mathematics'
    RETURN p.name AS person, c.name AS concept, r.proficiency AS proficiency
  `);
  
  printResults("Filter: Person age > 30 THEN Concept field = 'Mathematics'", personFirstFilter);
  
  // Operation 2: Filter by Concept field first, then by Person
  const conceptFirstFilter = await executeQuery(`
    MATCH (p:Person)-[r:UNDERSTANDS]->(c:Concept)
    WHERE c.field = 'Mathematics' AND p.age > 30
    RETURN p.name AS person, c.name AS concept, r.proficiency AS proficiency
  `);
  
  printResults("Filter: Concept field = 'Mathematics' THEN Person age > 30", conceptFirstFilter);
  
  // Verify commutativity
  console.log("\n📊 Commutativity Analysis:");
  console.log("The order of filter operations commutes (order doesn't matter)");
  console.log("This is an example of path invariance at the query level.");
}

/**
 * Example 3: Path-Invariant Aggregation
 * 
 * This example demonstrates that aggregating data along different paths
 * can yield compatible results that satisfy path invariance properties.
 */
async function demoPathInvariantAggregation() {
  console.log("\n🔹 EXAMPLE 3: PATH-INVARIANT AGGREGATION 🔹");
  
  // Aggregation 1: Group by Person, count concepts
  const personAggregation = await executeQuery(`
    MATCH (p:Person)-[:UNDERSTANDS]->(c:Concept)
    RETURN p.name AS person, COUNT(c) AS concept_count
    ORDER BY p.name
  `);
  
  printResults("Aggregation by Person (Person-centric view)", personAggregation);
  
  // Aggregation 2: Group by Concept, count persons
  const conceptAggregation = await executeQuery(`
    MATCH (p:Person)-[:UNDERSTANDS]->(c:Concept)
    RETURN c.name AS concept, COUNT(p) AS person_count
    ORDER BY c.name
  `);
  
  printResults("Aggregation by Concept (Concept-centric view)", conceptAggregation);
  
  // Aggregation 3: Total relationship count (invariant across groupings)
  const totalRelationships = await executeQuery(`
    MATCH (p:Person)-[r:UNDERSTANDS]->(c:Concept)
    RETURN COUNT(*) AS total_relationships
  `);
  
  printResults("Total relationships (Invariant measure)", totalRelationships);
  
  console.log("\n📊 Path-Invariant Aggregation Analysis:");
  console.log("These different aggregation views represent dual perspectives on the same underlying data.");
  console.log("The total number of relationships is invariant regardless of how we group the data.");
}

/**
 * Example 4: Graph Morphisms and Path Preservation
 * 
 * This example demonstrates graph morphisms that preserve path properties.
 */
async function demoGraphMorphisms() {
  console.log("\n🔹 EXAMPLE 4: GRAPH MORPHISMS 🔹");
  
  // View 1: Full subgraph of Person-Concept relationships
  const fullGraph = await executeQuery(`
    MATCH path = (p:Person)-[r:UNDERSTANDS]->(c:Concept)
    RETURN p.name AS person, c.name AS concept, r.proficiency AS proficiency
    ORDER BY p.name, c.name
  `);
  
  printResults("Full Graph View", fullGraph);
  
  // View 2: Morphism that maps to a simplified view (abstract away relationship details)
  const simplifiedGraph = await executeQuery(`
    MATCH (p:Person)-[:UNDERSTANDS]->(c:Concept)
    RETURN p.name AS person, c.name AS concept, 'understands' AS relationship
    ORDER BY p.name, c.name
  `);
  
  printResults("Simplified Graph Morphism", simplifiedGraph);
  
  // View 3: Morphism that creates a derived graph structure
  const derivedGraph = await executeQuery(`
    MATCH (p1:Person)-[:UNDERSTANDS]->(c:Concept)<-[:UNDERSTANDS]-(p2:Person)
    WHERE id(p1) < id(p2)  // To avoid duplicates
    RETURN p1.name AS person1, p2.name AS person2, c.name AS shared_concept
    ORDER BY person1, person2, shared_concept
  `);
  
  printResults("Derived Graph Morphism (People connected by shared concepts)", derivedGraph);
  
  console.log("\n📊 Graph Morphism Analysis:");
  console.log("These different views represent graph morphisms that preserve important structural properties.");
  console.log("Path invariance ensures that the essential connections are maintained across different representations.");
}

/**
 * Example 5: Category Theory in Action
 * 
 * This example demonstrates category theory concepts applied to graph queries,
 * showing functorial relationships and natural transformations.
 */
async function demoCategoryTheory() {
  console.log("\n🔹 EXAMPLE 5: CATEGORY THEORY CONCEPTS 🔹");
  
  // Get all people and their relationships (objects and morphisms in Person category)
  const personCategory = await executeQuery(`
    MATCH (p1:Person)-[r:KNOWS]->(p2:Person)
    RETURN p1.name AS source, p2.name AS target, r.strength AS morphism
    ORDER BY source, target
  `);
  
  printResults("Person Category (Objects and Morphisms)", personCategory);
  
  // Get all concepts and their relationships (objects and morphisms in Concept category)
  const conceptCategory = await executeQuery(`
    MATCH (c1:Concept)-[r:RELATED_TO]->(c2:Concept)
    RETURN c1.name AS source, c2.name AS target, r.relationship_type AS morphism
    ORDER BY source, target
  `);
  
  printResults("Concept Category (Objects and Morphisms)", conceptCategory);
  
  // Create a "functor" from Person to Concept via UNDERSTANDS
  const functorPersonToConcept = await executeQuery(`
    MATCH (p:Person)-[u:UNDERSTANDS]->(c:Concept)
    RETURN p.name AS person_object, c.name AS concept_object, u.proficiency AS mapping
    ORDER BY person_object, concept_object
  `);
  
  printResults("Functor from Person to Concept Category", functorPersonToConcept);
  
  // Demonstrate natural transformation properties
  console.log("\n📊 Category Theory Analysis:");
  console.log("The UNDERSTANDS relationship can be viewed as a functor from the Person category to the Concept category.");
  console.log("Path invariance corresponds to the preservation of compositional structure by this functor.");
  console.log("Different paths through one category map to corresponding paths in the other category.");
}

// Main function to run all examples
async function main() {
  try {
    console.log("🌟 PATH INVARIANCE EXAMPLES IN KUZU GRAPH DATABASE 🌟");
    
    // Run all examples
    await demoPathEquivalence();
    await demoCommutativeOperations();
    await demoPathInvariantAggregation();
    await demoGraphMorphisms();
    await demoCategoryTheory();
    
    console.log("\n✅ All examples completed successfully!");
  } catch (error) {
    console.error("\n❌ Error running examples:", error);
  } finally {
    process.exit(0);
  }
}

// Run the main function
main();