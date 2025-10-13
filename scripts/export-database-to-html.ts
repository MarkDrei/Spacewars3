#!/usr/bin/env tsx
/**
 * Export Database to HTML
 * 
 * This script extracts all data from the SQLite database and generates
 * a nicely formatted HTML report with all tables and their contents.
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'database', 'users.db');
const OUTPUT_PATH = path.join(process.cwd(), 'test-output', 'database-export.html');

interface TableInfo {
  name: string;
  sql: string;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

/**
 * Get all tables in the database
 */
function getTables(db: sqlite3.Database): Promise<TableInfo[]> {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows as TableInfo[]);
      }
    );
  });
}

/**
 * Get column information for a table
 */
function getTableInfo(db: sqlite3.Database, tableName: string): Promise<ColumnInfo[]> {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as ColumnInfo[]);
    });
  });
}

/**
 * Get all rows from a table
 */
function getTableData(db: sqlite3.Database, tableName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

/**
 * Get table row count
 */
function getTableCount(db: sqlite3.Database, tableName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row: any) => {
      if (err) reject(err);
      else resolve(row?.count || 0);
    });
  });
}

/**
 * Format a value for display
 */
function formatValue(value: any, maxLength: number = 100): string {
  if (value === null || value === undefined) {
    return '<span class="null">NULL</span>';
  }
  
  if (typeof value === 'boolean') {
    return value ? '<span class="bool-true">true</span>' : '<span class="bool-false">false</span>';
  }
  
  if (typeof value === 'number') {
    return `<span class="number">${value}</span>`;
  }
  
  let str = String(value);
  const originalStr = str;
  
  // Try to parse as JSON for pretty printing
  if (str.startsWith('{') || str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      const prettyJson = JSON.stringify(parsed, null, 2);
      const isTruncated = prettyJson.length > maxLength;
      
      if (isTruncated) {
        const truncated = prettyJson.substring(0, maxLength) + '...';
        const fullContent = escapeHtml(prettyJson);
        const truncatedContent = escapeHtml(truncated);
        return `<pre class="json expandable" onclick="showModal('${escapeForAttribute(fullContent)}')" title="Click to view full content">${truncatedContent}</pre>`;
      } else {
        return `<pre class="json">${escapeHtml(prettyJson)}</pre>`;
      }
    } catch (e) {
      // Not valid JSON, continue with string handling
    }
  }
  
  // Handle long strings
  if (str.length > maxLength) {
    const truncated = str.substring(0, maxLength) + '...';
    const fullContent = escapeHtml(originalStr);
    const truncatedContent = escapeHtml(truncated);
    return `<span class="string expandable" onclick="showModal('${escapeForAttribute(fullContent)}')" title="Click to view full content">${truncatedContent}</span>`;
  }
  
  return `<span class="string">${escapeHtml(str)}</span>`;
}

/**
 * Escape content for use in HTML attribute
 */
function escapeForAttribute(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Generate HTML for a table
 */
async function generateTableHtml(
  db: sqlite3.Database,
  table: TableInfo
): Promise<string> {
  const columns = await getTableInfo(db, table.name);
  const data = await getTableData(db, table.name);
  const count = await getTableCount(db, table.name);
  
  let html = `
    <div class="table-section">
      <h2 id="${table.name}" class="table-name">
        📋 ${table.name}
        <span class="row-count">${count} row${count !== 1 ? 's' : ''}</span>
      </h2>
      
      <div class="schema">
        <h3>Schema</h3>
        <pre class="sql">${escapeHtml(table.sql || '')}</pre>
      </div>
      
      <div class="data">
        <h3>Data</h3>
  `;
  
  if (data.length === 0) {
    html += '<p class="no-data">No data in this table</p>';
  } else {
    html += `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
    `;
    
    // Table headers
    columns.forEach(col => {
      const pkBadge = col.pk ? ' <span class="pk-badge">PK</span>' : '';
      const notNullBadge = col.notnull ? ' <span class="notnull-badge">NOT NULL</span>' : '';
      html += `<th>${escapeHtml(col.name)}${pkBadge}${notNullBadge}<br><span class="type">${col.type}</span></th>`;
    });
    
    html += `
            </tr>
          </thead>
          <tbody>
    `;
    
    // Table rows
    data.forEach((row, index) => {
      html += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
      columns.forEach(col => {
        html += `<td>${formatValue(row[col.name])}</td>`;
      });
      html += '</tr>';
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
  }
  
  html += `
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Generate the complete HTML document
 */
async function generateHtml(db: sqlite3.Database): Promise<string> {
  const tables = await getTables(db);
  
  let tableOfContents = '<ul class="toc">';
  tables.forEach(table => {
    tableOfContents += `<li><a href="#${table.name}">${table.name}</a></li>`;
  });
  tableOfContents += '</ul>';
  
  let tablesHtml = '';
  for (const table of tables) {
    tablesHtml += await generateTableHtml(db, table);
  }
  
  const now = new Date().toISOString();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Export - Spacewars3</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    
    header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    
    .timestamp {
      font-size: 0.9em;
      opacity: 0.9;
    }
    
    .summary {
      padding: 30px 40px;
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
    }
    
    .summary h2 {
      margin-bottom: 15px;
      color: #495057;
    }
    
    .toc {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
    }
    
    .toc li a {
      display: block;
      padding: 10px 15px;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      color: #667eea;
      text-decoration: none;
      transition: all 0.2s;
    }
    
    .toc li a:hover {
      background: #667eea;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    
    .content {
      padding: 40px;
    }
    
    .table-section {
      margin-bottom: 60px;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .table-name {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      font-size: 1.8em;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .row-count {
      font-size: 0.6em;
      background: rgba(255,255,255,0.2);
      padding: 5px 15px;
      border-radius: 20px;
    }
    
    .schema, .data {
      padding: 20px;
    }
    
    .schema h3, .data h3 {
      color: #495057;
      margin-bottom: 15px;
      font-size: 1.2em;
    }
    
    .sql {
      background: #282c34;
      color: #abb2bf;
      padding: 20px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      line-height: 1.5;
    }
    
    .table-wrapper {
      overflow-x: auto;
      border: 1px solid #dee2e6;
      border-radius: 6px;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9em;
    }
    
    .data-table th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #495057;
      border-bottom: 2px solid #dee2e6;
      position: sticky;
      top: 0;
      white-space: nowrap;
    }
    
    .data-table td {
      padding: 12px;
      border-bottom: 1px solid #dee2e6;
      vertical-align: top;
    }
    
    .data-table tr.even {
      background: #f8f9fa;
    }
    
    .data-table tr:hover {
      background: #e9ecef;
    }
    
    .type {
      font-size: 0.8em;
      color: #6c757d;
      font-weight: normal;
    }
    
    .pk-badge, .notnull-badge {
      display: inline-block;
      font-size: 0.7em;
      padding: 2px 6px;
      border-radius: 3px;
      margin-left: 5px;
    }
    
    .pk-badge {
      background: #28a745;
      color: white;
    }
    
    .notnull-badge {
      background: #17a2b8;
      color: white;
    }
    
    .null {
      color: #6c757d;
      font-style: italic;
    }
    
    .number {
      color: #0066cc;
      font-weight: 500;
    }
    
    .string {
      color: #333;
    }
    
    .bool-true {
      color: #28a745;
      font-weight: 600;
    }
    
    .bool-false {
      color: #dc3545;
      font-weight: 600;
    }
    
    .json {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 4px;
      font-size: 0.85em;
      margin: 0;
      max-height: 200px;
      overflow-y: auto;
    }
    
    .no-data {
      color: #6c757d;
      font-style: italic;
      padding: 20px;
      text-align: center;
      background: #f8f9fa;
      border-radius: 6px;
    }
    
    .expandable {
      cursor: pointer;
      position: relative;
    }
    
    .expandable:hover {
      opacity: 0.8;
      background: #e9ecef !important;
    }
    
    .expandable::after {
      content: '🔍';
      position: absolute;
      top: 5px;
      right: 5px;
      font-size: 0.8em;
      opacity: 0.5;
    }
    
    /* Modal styles */
    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.7);
      animation: fadeIn 0.2s;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .modal-content {
      position: relative;
      background-color: white;
      margin: 5% auto;
      padding: 0;
      width: 90%;
      max-width: 1000px;
      max-height: 80vh;
      border-radius: 8px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      animation: slideDown 0.3s;
      display: flex;
      flex-direction: column;
    }
    
    @keyframes slideDown {
      from {
        transform: translateY(-50px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    .modal-header {
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px 8px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-header h2 {
      margin: 0;
      font-size: 1.5em;
    }
    
    .close {
      color: white;
      font-size: 35px;
      font-weight: bold;
      cursor: pointer;
      line-height: 1;
      transition: all 0.2s;
    }
    
    .close:hover {
      transform: scale(1.2);
      text-shadow: 0 0 10px rgba(255,255,255,0.8);
    }
    
    .modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    
    .modal-body pre {
      background: #282c34;
      color: #abb2bf;
      padding: 20px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      line-height: 1.6;
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .modal-footer {
      padding: 15px 20px;
      background: #f8f9fa;
      border-radius: 0 0 8px 8px;
      text-align: right;
    }
    
    .copy-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1em;
      transition: all 0.2s;
    }
    
    .copy-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    .copy-btn:active {
      transform: translateY(0);
    }
    
    .copy-btn.copied {
      background: #28a745;
    }
    
    footer {
      text-align: center;
      padding: 30px;
      background: #f8f9fa;
      color: #6c757d;
      font-size: 0.9em;
    }
  </style>
  <script>
    function showModal(content) {
      const modal = document.getElementById('contentModal');
      const modalBody = document.getElementById('modalBody');
      modalBody.innerHTML = '<pre>' + content + '</pre>';
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
    
    function closeModal() {
      const modal = document.getElementById('contentModal');
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
    
    function copyContent() {
      const modalBody = document.getElementById('modalBody');
      const text = modalBody.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.copy-btn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 2000);
      });
    }
    
    // Close modal when clicking outside
    window.onclick = function(event) {
      const modal = document.getElementById('contentModal');
      if (event.target == modal) {
        closeModal();
      }
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        closeModal();
      }
    });
  </script>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 Spacewars3 Database Export</h1>
      <p class="timestamp">Generated: ${now}</p>
      <p class="timestamp">Database: ${DB_PATH}</p>
    </header>
    
    <div class="summary">
      <h2>📊 Tables (${tables.length})</h2>
      ${tableOfContents}
    </div>
    
    <div class="content">
      ${tablesHtml}
    </div>
    
    <footer>
      <p>Generated by Spacewars3 Database Export Tool</p>
      <p>Spacewars Ironcore © 2025</p>
    </footer>
  </div>
  
  <!-- Modal for full content display -->
  <div id="contentModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>📄 Full Content</h2>
        <span class="close" onclick="closeModal()">&times;</span>
      </div>
      <div class="modal-body" id="modalBody">
        <!-- Content will be inserted here -->
      </div>
      <div class="modal-footer">
        <button class="copy-btn" onclick="copyContent()">📋 Copy to Clipboard</button>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting database export...');
  
  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found at: ${DB_PATH}`);
    console.log('Please ensure the database exists before running this script.');
    process.exit(1);
  }
  
  // Create output directory if it doesn't exist
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✅ Created output directory: ${outputDir}`);
  }
  
  // Open database
  const db = new (sqlite3.verbose().Database)(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('❌ Error opening database:', err);
      process.exit(1);
    }
  });
  
  try {
    console.log('📊 Extracting database structure and data...');
    const html = await generateHtml(db);
    
    console.log('💾 Writing HTML file...');
    fs.writeFileSync(OUTPUT_PATH, html, 'utf-8');
    
    const stats = fs.statSync(OUTPUT_PATH);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    console.log(`✅ Database export complete!`);
    console.log(`📄 Output file: ${OUTPUT_PATH}`);
    console.log(`📦 File size: ${sizeKB} KB`);
    console.log(`🌐 Open in browser: file://${OUTPUT_PATH}`);
    
  } catch (error) {
    console.error('❌ Error generating HTML:', error);
    process.exit(1);
  } finally {
    // Close database
    db.close((err) => {
      if (err) console.error('⚠️ Error closing database:', err);
    });
  }
}

// Run the script
main().catch(console.error);
