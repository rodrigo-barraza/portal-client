// @ts-nocheck
const fs = require('fs');
const glob = require('glob'); // Not available, I'll just recursively read dirs

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // fix useState
  content = content.replace(/useState\(\[\]\)/g, "useState<any[]>([])");
  content = content.replace(/useState\(null\)/g, "useState<any>(null)");
  content = content.replace(/useState\(\{\}\)/g, "useState<any>({})");

  // fix implicit any in map/filter/reduce etc.
  content = content.replace(/\((sum, s)\) =>/g, "(sum: any, s: any) =>");
  content = content.replace(/\((sum, c)\) =>/g, "(sum: any, c: any) =>");
  content = content.replace(/\((s, d)\) =>/g, "(s: any, d: any) =>");
  content = content.replace(/\((a, b)\) =>/g, "(a: any, b: any) =>");
  
  if (content !== original) {
    fs.writeFileSync(file, content);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = dir + '/' + file;
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir('src');
