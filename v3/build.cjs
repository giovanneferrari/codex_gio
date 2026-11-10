const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function liveHtml(source){
 if(!source.includes('workflow-updates.js')||!source.includes('id="orderForm"'))throw Error('Estrutura do sistema incompatível com a v3.');
 return source.replace('<head>','<head><base href="../"><meta name="robots" content="noindex, nofollow">')
  .replace('<title>RITO | Gestão da cafeteria</title>','<title>RITO v3 | Pedidos reais</title>')
  .replace('</head>','<link rel="stylesheet" href="v3/live.css?v=1"></head>')
  .replace('</body>','<script src="v3/order-view.js?v=1"></script><script src="v3/live.js?v=1"></script></body>');
}
function build(destination){
 const target=path.resolve(destination);
 if(target!==path.join(root,'v3')&&target!==path.join(root,'_site/v3'))throw Error('Destino deve ser v3 ou _site/v3.');
 fs.mkdirSync(target,{recursive:true});
 fs.writeFileSync(path.join(target,'index.html'),liveHtml(fs.readFileSync(path.join(root,'index.html'),'utf8')));
 for(const name of ['live.css','live.js','order-view.js'])if(target!==__dirname)fs.copyFileSync(path.join(__dirname,name),path.join(target,name));
 const demo=path.join(target,'demo');fs.mkdirSync(demo,{recursive:true});
 for(const name of fs.readdirSync(path.join(root,'preview-pedidos')).filter(n=>/\.(html|css|js)$/.test(n))){
  let content=fs.readFileSync(path.join(root,'preview-pedidos',name),'utf8');
  if(name.endsWith('.html'))content=content.replaceAll('../assets/','../../assets/');
  fs.writeFileSync(path.join(demo,name),content);
 }
}
if(require.main===module){build(process.argv[2]||path.join(root,'v3'));console.log('V3 real e demo geradas. Nenhum dado do banco foi acessado.');}
module.exports={liveHtml,build};
