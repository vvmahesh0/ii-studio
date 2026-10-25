import {readdirSync,readFileSync,lstatSync} from 'node:fs';
import {join,relative} from 'node:path';
const root=process.cwd(), issues=[];
const excluded=new Set(['node_modules','.next','.git','coverage','.release-check']);
const secretPattern=/sk-or-v1-[a-z0-9]{20,}|gh[pousr]_[a-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
function visit(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){
 const path=join(dir,entry.name),rel=relative(root,path);
 if(excluded.has(entry.name))continue;
 if(entry.isSymbolicLink()){issues.push(`${rel}: symlink must not be in release source`);continue;}
 if(entry.isDirectory()){if(['.vercel','backups','.impeccable'].includes(entry.name))issues.push(`${rel}: private/generated directory`);else visit(path);continue;}
 if(entry.name.startsWith('.env')&&entry.name!=='.env.example')issues.push(`${rel}: private configuration`);
 if(/\.(?:log|tsbuildinfo)$/.test(entry.name)||entry.name==='next-env.d.ts')continue;
 if(lstatSync(path).size>2_000_000 || /\.(?:png|jpg|jpeg|zip|woff2?|pdf)$/.test(entry.name))continue;
 const text=readFileSync(path,'utf8');
 if(secretPattern.test(text))issues.push(`${rel}: credential-shaped content; review privately`);
 if(text.includes('/Users/') && !['scripts/release-check.mjs'].includes(rel))issues.push(`${rel}: machine-specific path`);
}}
visit(root);
if(issues.length){for(const issue of issues)console.error(issue);process.exit(1);}
console.log('Release source pattern checks passed. Config/build/dependency directories excluded. This is not a full secret, archive, image, history or security audit.');
