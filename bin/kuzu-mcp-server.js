#!/usr/bin/env node

/**
 * kuzu-mcp-server - Executable bin script for npx usage
 *
 * This script provides a command-line interface for the Kuzu MCP server,
 * allowing users to run it directly with npx kuzu-mcp-server
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function showHelp() {
  log('Kuzu MCP Server', 'cyan');
  log('===============', 'cyan');
  console.log();
  log('A Model Context Protocol server for Kuzu graph databases');
  console.log();
  log('Usage:', 'yellow');
  console.log('  npx kuzu-mcp-server [options] [database-path]');
  console.log('  kuzu-mcp-server [options] [database-path]');
  console.log();
  log('Options:', 'yellow');
  console.log('  -h, --help              Show this help message');
  console.log('  -v, --version           Show version information');
  console.log('  --setup                 Initialize a new database with sample data');
  console.log('  --test                  Run the test suite');
  console.log('  --health                Run health check');
  console.log('  --read-only             Start in read-only mode');
  console.log('  --port <port>           Port for HTTP mode (not implemented)');
  console.log();
  log('Examples:', 'yellow');
  console.log('  npx kuzu-mcp-server ./my-database');
  console.log('  npx kuzu-mcp-server --setup ./new-database');
  console.log('  npx kuzu-mcp-server --test');
  console.log('  npx kuzu-mcp-server --read-only ./production-db');
  console.log();
  log('Environment Variables:', 'yellow');
  console.log('  KUZU_DB_PATH            Default database path');
  console.log('  KUZU_READ_ONLY          Set to "true" for read-only mode');
  console.log();
  log('For more information, visit:', 'cyan');
  console.log('  https://github.com/bmorphism/kuzu-mcp-server');
}

function showVersion() {
  const packageJson = require('../package.json');
  log(`Kuzu MCP Server v${packageJson.version}`, 'cyan');
  console.log(`Author: ${packageJson.author.name} <${packageJson.author.email}>`);
  console.log(`License: ${packageJson.license}`);
}

async function runSetup(dbPath) {
  const setupScript = path.join(__dirname, '..', 'setup-with-callback.js');

  if (!fs.existsSync(setupScript)) {
    logError('Setup script not found');
    process.exit(1);
  }

  logInfo(`Setting up database at: ${dbPath}`);

  return new Promise((resolve, reject) => {
    const child = spawn('node', [setupScript, dbPath], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        logSuccess('Database setup completed successfully');
        resolve();
      } else {
        logError(`Setup failed with exit code ${code}`);
        reject(new Error(`Setup failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      logError(`Setup failed: ${error.message}`);
      reject(error);
    });
  });
}

async function runTest() {
  const testScript = path.join(__dirname, '..', 'test-mcp.js');

  if (!fs.existsSync(testScript)) {
    logError('Test script not found');
    process.exit(1);
  }

  logInfo('Running comprehensive test suite...');

  return new Promise((resolve, reject) => {
    const child = spawn('node', [testScript], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        logSuccess('All tests passed');
        resolve();
      } else {
        logError(`Tests failed with exit code ${code}`);
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      logError(`Test execution failed: ${error.message}`);
      reject(error);
    });
  });
}

async function runHealthCheck(dbPath) {
  const healthCheckRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'healthCheck',
      arguments: {}
    }
  };

  const serverScript = path.join(__dirname, '..', 'index.js');

  logInfo(`Running health check on database: ${dbPath}`);

  return new Promise((resolve, reject) => {
    const child = spawn('node', [serverScript, dbPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let jsonResponse = '';

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Health check timeout'));
    }, 10000);

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;

      // Look for JSON response
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
          if (response.result && response.result.content) {
            const healthData = JSON.parse(response.result.content[0].text);

            if (healthData.status === 'healthy') {
              logSuccess('Database is healthy');
              console.log('Health Status:', JSON.stringify(healthData, null, 2));
              resolve();
            } else {
              logError('Database is unhealthy');
              console.log('Health Status:', JSON.stringify(healthData, null, 2));
              reject(new Error('Database is unhealthy'));
            }
          } else {
            logError('Invalid health check response');
            reject(new Error('Invalid health check response'));
          }
        } catch (parseError) {
          logError(`Failed to parse health check response: ${parseError.message}`);
          reject(parseError);
        }
      } else {
        logError('No response from health check');
        reject(new Error('No response from health check'));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      logError(`Health check failed: ${error.message}`);
      reject(error);
    });

    // Send the health check request
    child.stdin.write(JSON.stringify(healthCheckRequest) + '\n');
    child.stdin.end();
  });
}

function startServer(dbPath, options = {}) {
  const serverScript = path.join(__dirname, '..', 'index.js');
  const args = [serverScript];

  if (dbPath) {
    args.push(dbPath);
  }

  // Set environment variables based on options
  const env = { ...process.env };

  if (options.readOnly) {
    env.KUZU_READ_ONLY = 'true';
  }

  if (dbPath) {
    env.KUZU_DB_PATH = dbPath;
  }

  logInfo(`Starting Kuzu MCP Server...`);
  logInfo(`Database path: ${dbPath || env.KUZU_DB_PATH || 'default'}`);
  logInfo(`Read-only mode: ${options.readOnly ? 'enabled' : 'disabled'}`);

  const child = spawn('node', args, {
    stdio: 'inherit',
    env: env
  });

  child.on('error', (error) => {
    logError(`Failed to start server: ${error.message}`);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logInfo('Shutting down server...');
    child.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    logInfo('Shutting down server...');
    child.kill('SIGTERM');
  });
}

async function main() {
  const args = process.argv.slice(2);
  let dbPath = null;
  const options = {
    readOnly: false
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        showHelp();
        process.exit(0);
        break;

      case '-v':
      case '--version':
        showVersion();
        process.exit(0);
        break;

      case '--setup':
        // Next argument should be database path
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          dbPath = args[i + 1];
          i++; // Skip next argument as it's the path
        } else {
          dbPath = './kuzu_data';
        }
        try {
          await runSetup(dbPath);
          process.exit(0);
        } catch (error) {
          process.exit(1);
        }
        break;

      case '--test':
        try {
          await runTest();
          process.exit(0);
        } catch (error) {
          process.exit(1);
        }
        break;

      case '--health':
        // Next argument should be database path
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          dbPath = args[i + 1];
          i++; // Skip next argument as it's the path
        } else {
          dbPath = process.env.KUZU_DB_PATH || './kuzu_data';
        }
        try {
          await runHealthCheck(dbPath);
          process.exit(0);
        } catch (error) {
          process.exit(1);
        }
        break;

      case '--read-only':
        options.readOnly = true;
        break;

      case '--port':
        // Skip port argument for now (not implemented)
        if (i + 1 < args.length) {
          i++; // Skip next argument
        }
        logWarning('HTTP port mode not yet implemented');
        break;

      default:
        // Assume it's a database path if it doesn't start with --
        if (!arg.startsWith('-')) {
          dbPath = arg;
        } else {
          logError(`Unknown option: ${arg}`);
          showHelp();
          process.exit(1);
        }
        break;
    }
  }

  // If no specific action was requested, start the server
  startServer(dbPath, options);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run the main function
main().catch((error) => {
  logError(`Application error: ${error.message}`);
  process.exit(1);
});
