/**
 * test-mcp.js - Comprehensive MCP functionality test suite
 * Tests all MCP tools and error handling scenarios
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const DB_PATH = path.join(__dirname, 'kuzu_data');
const TIMEOUT = 30000; // 30 seconds timeout for each test

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Test cases
const testCases = [
  {
    name: 'List Tools',
    description: 'Test tools/list endpoint',
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    },
    expectedTools: ['graphQuery', 'getSchema', 'healthCheck', 'generateKuzuCypher']
  },
  {
    name: 'Health Check',
    description: 'Test healthCheck tool',
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'healthCheck',
        arguments: {}
      }
    },
    expectedFields: ['status', 'dbPath', 'readOnly', 'tablesCount', 'timestamp', 'version']
  },
  {
    name: 'Get Schema',
    description: 'Test getSchema tool',
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'getSchema',
        arguments: {}
      }
    },
    expectedFields: ['nodeTables', 'relTables']
  },
  {
    name: 'Simple Query',
    description: 'Test graphQuery with simple MATCH query',
    request: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'graphQuery',
        arguments: {
          cypher: 'MATCH (p:Person) RETURN p.name, p.age ORDER BY p.age LIMIT 3'
        }
      }
    },
    expectedType: 'array'
  },
  {
    name: 'Count Query',
    description: 'Test graphQuery with COUNT query',
    request: {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'graphQuery',
        arguments: {
          cypher: 'MATCH (p:Person) RETURN COUNT(*) as total'
        }
      }
    },
    expectedType: 'array'
  },
  {
    name: 'Relationship Query',
    description: 'Test graphQuery with relationship traversal',
    request: {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'graphQuery',
        arguments: {
          cypher: 'MATCH (p1:Person)-[r:KNOWS]->(p2:Person) RETURN p1.name, p2.name, r.strength'
        }
      }
    },
    expectedType: 'array'
  },
  {
    name: 'List Prompts',
    description: 'Test prompts/list endpoint',
    request: {
      jsonrpc: '2.0',
      id: 7,
      method: 'prompts/list'
    },
    expectedPrompts: ['generateKuzuCypher']
  },
  {
    name: 'Get Prompt',
    description: 'Test prompts/get endpoint',
    request: {
      jsonrpc: '2.0',
      id: 8,
      method: 'prompts/get',
      params: {
        name: 'generateKuzuCypher',
        arguments: {
          question: 'Find all people and their ages'
        }
      }
    },
    expectedFields: ['messages']
  }
];

// Error test cases
const errorTestCases = [
  {
    name: 'Invalid Tool',
    description: 'Test calling non-existent tool',
    request: {
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/call',
      params: {
        name: 'nonExistentTool',
        arguments: {}
      }
    },
    expectError: true
  },
  {
    name: 'Invalid Cypher',
    description: 'Test graphQuery with invalid Cypher',
    request: {
      jsonrpc: '2.0',
      id: 102,
      method: 'tools/call',
      params: {
        name: 'graphQuery',
        arguments: {
          cypher: 'INVALID CYPHER SYNTAX'
        }
      }
    },
    expectError: true
  },
  {
    name: 'Missing Cypher',
    description: 'Test graphQuery without cypher parameter',
    request: {
      jsonrpc: '2.0',
      id: 103,
      method: 'tools/call',
      params: {
        name: 'graphQuery',
        arguments: {}
      }
    },
    expectError: true
  },
  {
    name: 'Empty Cypher',
    description: 'Test graphQuery with empty cypher',
    request: {
      jsonrpc: '2.0',
      id: 104,
      method: 'tools/call',
      params: {
        name: 'graphQuery',
        arguments: {
          cypher: ''
        }
      }
    },
    expectError: true
  },
  {
    name: 'Invalid Prompt',
    description: 'Test getting non-existent prompt',
    request: {
      jsonrpc: '2.0',
      id: 105,
      method: 'prompts/get',
      params: {
        name: 'nonExistentPrompt',
        arguments: {}
      }
    },
    expectError: true
  }
];

// Utility functions
function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Execute MCP request
function executeMCPRequest(request) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['index.js', DB_PATH], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let jsonResponse = '';
    let serverStarted = false;

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Request timeout'));
    }, TIMEOUT);

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;

      // Check for server startup messages
      if (output.includes('MCP server started successfully') || output.includes('Connected to database')) {
        serverStarted = true;
      }

      // Look for JSON response (starts with {)
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          jsonResponse += line.trim();
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (jsonResponse) {
        try {
          const response = JSON.parse(jsonResponse);
          resolve({ response, stdout, stderr, code });
        } catch (parseError) {
          reject(new Error(`Failed to parse JSON response: ${parseError.message}\nOutput: ${jsonResponse}`));
        }
      } else {
        reject(new Error(`No JSON response received. Code: ${code}, Stdout: ${stdout}, Stderr: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    // Send the request
    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();
  });
}

// Validate response against expected criteria
function validateResponse(testCase, result) {
  const { response } = result;

  if (testCase.expectError) {
    if (response.result && response.result.isError) {
      return { success: true, message: 'Error correctly returned' };
    } else if (response.error) {
      return { success: true, message: 'Error correctly returned in error field' };
    } else {
      return { success: false, message: 'Expected error but got success response' };
    }
  }

  if (response.error) {
    return { success: false, message: `Unexpected error: ${JSON.stringify(response.error)}` };
  }

  if (!response.result) {
    return { success: false, message: 'Missing result field in response' };
  }

  // Validate specific test case requirements
  if (testCase.expectedTools) {
    const tools = response.result.tools;
    if (!Array.isArray(tools)) {
      return { success: false, message: 'Expected tools array' };
    }

    const toolNames = tools.map(t => t.name);
    for (const expectedTool of testCase.expectedTools) {
      if (!toolNames.includes(expectedTool)) {
        return { success: false, message: `Missing expected tool: ${expectedTool}` };
      }
    }
  }

  if (testCase.expectedPrompts) {
    const prompts = response.result.prompts;
    if (!Array.isArray(prompts)) {
      return { success: false, message: 'Expected prompts array' };
    }

    const promptNames = prompts.map(p => p.name);
    for (const expectedPrompt of testCase.expectedPrompts) {
      if (!promptNames.includes(expectedPrompt)) {
        return { success: false, message: `Missing expected prompt: ${expectedPrompt}` };
      }
    }
  }

  if (testCase.expectedFields) {
    let dataToCheck = response.result;

    // For tool calls, check the content
    if (response.result.content && Array.isArray(response.result.content)) {
      try {
        const contentText = response.result.content[0].text;
        dataToCheck = JSON.parse(contentText);
      } catch (e) {
        return { success: false, message: `Failed to parse content as JSON: ${e.message}` };
      }
    }

    for (const field of testCase.expectedFields) {
      if (!(field in dataToCheck)) {
        return { success: false, message: `Missing expected field: ${field}` };
      }
    }
  }

  if (testCase.expectedType) {
    let dataToCheck = response.result;

    // For tool calls, check the content
    if (response.result.content && Array.isArray(response.result.content)) {
      try {
        const contentText = response.result.content[0].text;
        dataToCheck = JSON.parse(contentText);
      } catch (e) {
        return { success: false, message: `Failed to parse content as JSON: ${e.message}` };
      }
    }

    if (testCase.expectedType === 'array' && !Array.isArray(dataToCheck)) {
      return { success: false, message: `Expected array but got ${typeof dataToCheck}` };
    }
  }

  return { success: true, message: 'Response validation passed' };
}

// Run a single test case
async function runTestCase(testCase) {
  logInfo(`Running: ${testCase.name} - ${testCase.description}`);

  try {
    const result = await executeMCPRequest(testCase.request);
    const validation = validateResponse(testCase, result);

    if (validation.success) {
      logSuccess(`${testCase.name}: ${validation.message}`);
      return true;
    } else {
      logError(`${testCase.name}: ${validation.message}`);
      return false;
    }
  } catch (error) {
    if (testCase.expectError) {
      logSuccess(`${testCase.name}: Expected error occurred - ${error.message}`);
      return true;
    } else {
      logError(`${testCase.name}: Unexpected error - ${error.message}`);
      return false;
    }
  }
}

// Main test runner
async function runAllTests() {
  log('🧪 Starting Kuzu MCP Server Test Suite', 'cyan');
  log('=' * 50, 'cyan');

  // Check prerequisites
  if (!fs.existsSync(path.join(__dirname, 'index.js'))) {
    logError('index.js not found. Please run tests from the kuzu-mcp-server directory.');
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    logWarning(`Database path ${DB_PATH} not found. Some tests may fail.`);
  }

  let passedTests = 0;
  let totalTests = 0;

  // Run main test cases
  log('\n📋 Running Main Test Cases', 'magenta');
  log('-' * 30, 'magenta');

  for (const testCase of testCases) {
    totalTests++;
    const success = await runTestCase(testCase);
    if (success) passedTests++;

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Run error test cases
  log('\n🚨 Running Error Test Cases', 'magenta');
  log('-' * 30, 'magenta');

  for (const testCase of errorTestCases) {
    totalTests++;
    const success = await runTestCase(testCase);
    if (success) passedTests++;

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  log('\n📊 Test Results Summary', 'cyan');
  log('=' * 50, 'cyan');
  log(`Total Tests: ${totalTests}`);
  log(`Passed: ${passedTests}`, passedTests === totalTests ? 'green' : 'yellow');
  log(`Failed: ${totalTests - passedTests}`, totalTests - passedTests === 0 ? 'green' : 'red');
  log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`,
      passedTests === totalTests ? 'green' : 'yellow');

  if (passedTests === totalTests) {
    log('\n🎉 All tests passed! Kuzu MCP server is working correctly.', 'green');
    process.exit(0);
  } else {
    log('\n💥 Some tests failed. Please check the output above for details.', 'red');
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('\n🛑 Test suite interrupted by user', 'yellow');
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('\n🛑 Test suite terminated', 'yellow');
  process.exit(143);
});

// Run the tests
if (require.main === module) {
  runAllTests().catch(error => {
    logError(`Test suite failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  executeMCPRequest,
  validateResponse
};
