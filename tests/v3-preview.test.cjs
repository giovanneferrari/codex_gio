const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const dir=path.join(root,'preview-pedidos');
test('publicação da v3 adiciona uma pasta sem substituir a raiz',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-pages.yml'),'utf8');
 assert.ok(workflow.includes('mkdir -p _site/v3'));
 assert.ok(workflow.includes('cp preview-pedidos/*.html preview-pedidos/*.css preview-pedidos/*.js _site/v3/'));
 assert.ok(workflow.includes('cp index.html styles.css app.js'));
});
test('links locais da prévia existem e HTML pede não indexação',()=>{
 for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.html'))){
  const source=fs.readFileSync(path.join(dir,file),'utf8');
  assert.ok(source.includes('name="robots" content="noindex, nofollow"'),file);
  for(const [,url] of source.matchAll(/(?:src|href)="([^"#]+)"/g)){
   if(/^(https?:|data:)/.test(url))continue;
   assert.ok(fs.existsSync(path.resolve(dir,url.split(/[?#]/)[0])),`${file}: ${url}`);
  }
 }
});
test('prévia não inclui APIs de produção nem persistência de dados',()=>{
 for(const file of fs.readdirSync(dir).filter(f=>/\.(js|html)$/.test(f))){
  const source=fs.readFileSync(path.join(dir,file),'utf8');
  assert.doesNotMatch(source,/supabase|fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|serviceWorker|sendBeacon/i,file);
 }
});
