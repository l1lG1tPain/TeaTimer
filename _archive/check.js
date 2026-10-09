const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf-8');

// Check for common issues
const issues = [];

// 1. Check unmatched braces
let braces = 0;
let parens = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') braces++;
  if (content[i] === '}') braces--;
  if (content[i] === '(') parens++;
  if (content[i] === ')') parens--;
}

if (braces !== 0) issues.push(`❌ Unmatched braces: ${braces}`);
if (parens !== 0) issues.push(`❌ Unmatched parentheses: ${parens}`);

// 2. Check for missing function keywords
const functions = content.match(/function\s+\w+/g) || [];
const functionEnds = (content.match(/^}/gm) || []).length;

// 3. Look for common errors
if (content.includes('function function')) {
  issues.push('❌ Double "function" keyword found');
}

if (content.includes('{{')) {
  issues.push('❌ Double opening brace found');
}

// 4. Check for incomplete strings
const singleQuotes = (content.match(/'/g) || []).length;
const doubleQuotes = (content.match(/"/g) || []).length;
const backticks = (content.match(/`/g) || []).length;

if (singleQuotes % 2 !== 0) issues.push(`⚠️  Odd number of single quotes: ${singleQuotes}`);
if (doubleQuotes % 2 !== 0) issues.push(`⚠️  Odd number of double quotes: ${doubleQuotes}`);
if (backticks % 2 !== 0) issues.push(`⚠️  Odd number of backticks: ${backticks}`);

// 5. Find line with issues
const lines = content.split('\n');
console.log(`📊 File Stats:`);
console.log(`   Total lines: ${lines.length}`);
console.log(`   Functions found: ${functions.length}`);
console.log(`   File size: ${(content.length / 1024).toFixed(1)} KB`);

if (issues.length === 0) {
  console.log(`\n✅ No obvious syntax issues found`);
} else {
  console.log(`\n❌ Issues found:`);
  issues.forEach(i => console.log(`   ${i}`));
}
