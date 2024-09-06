// Import file system methods to check existence and read files
import { existsSync, readFileSync } from 'fs';
/**
 * Function to load environment variables from .env files
 * depending on the current npm lifecycle event (e.g., dev, test, production).
 */
const envLoader = () => {
  // Get the current npm lifecycle event (like 'start', 'test') or default to 'dev'
  const env = process.env.npm_lifecycle_event || 'dev';

  // Determine the file path based on the event: .env for development, .env.test for tests
  const path = env.includes('test') || env.includes('cover') ? '.env.test' : '.env';

  // Check if the .env file exists
  if (existsSync(path)) {
    // Read the .env file, trim whitespace, and split into lines (each line is a variable)
    const data = readFileSync(path, 'utf-8').trim().split('\n');

    // Iterate over each line to extract the variable and its value
    for (const line of data) {
      const delimPosition = line.indexOf('=');
      const variable = line.substring(0, delimPosition);
      const value = line.substring(delimPosition + 1);
      process.env[variable] = value;
    }
  }
};

export default envLoader;
