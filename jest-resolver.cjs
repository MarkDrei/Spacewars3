// Custom Jest resolver for handling .js extensions in TypeScript source files
// Note: This file uses CommonJS because Jest requires it
const fs = require('fs');
const path = require('path');

function resolver(request, options) {
  // Handle .js extensions in relative imports within TypeScript source files
  if (request.endsWith('.js') && (request.startsWith('./') || request.startsWith('../'))) {
    const tsRequest = request.replace(/\.js$/, '.ts');
    const basedir = options.basedir;
    const tsPath = path.resolve(basedir, tsRequest);
    
    // Check if the .ts file exists
    if (fs.existsSync(tsPath)) {
      return tsPath;
    }
  }
  
  // Fall back to the default resolver
  return options.defaultResolver(request, options);
}

module.exports = resolver;
