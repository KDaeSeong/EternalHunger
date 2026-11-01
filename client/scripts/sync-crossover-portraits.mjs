import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const audit=path.resolve(root,'../.local/kivotos-autochess/crossover'),rawDir=path.join(audit,'raw'),out=path.join(root,'public/games/shared/crossover');
const definitions=[
 ['nte-nanally','나나리','nte','nanally'],['nte-sakiri','사키리','nte','zaowu'],['nte-hathor','하토르','nte','hasuoer'],['nte-fadia','파디아','nte','fadiya'],['nte-daffodil','다포딜','nte','dfde'],['nte-jiuyuan','구원','nte','jiuyuan'],
 ['gi-lisa','리사','genshin','Lisa'],['gi-jean','진','genshin','Qin'],['gi-diluc','다이루크','genshin','Diluc'],['gi-ningguang','응광','genshin','Ningguang'],['gi-keqing','각청','genshin','Keqing'],['gi-zhongli','종려','genshin','Zhongli'],
];
const cropById={
  "nte-nanally": {
    "left": 245,
    "top": 160,
    "width": 270,
    "height": 270
  },
  "nte-sakiri": {
    "left": 245,
    "top": 205,
    "width": 260,
    "height": 260
  },
  "nte-hathor": {
    "left": 300,
    "top": 150,
    "width": 260,
    "height": 260
  },
  "nte-fadia": {
    "left": 270,
    "top": 145,
    "width": 270,
    "height": 270
  },
  "nte-daffodil": {
    "left": 275,
    "top": 140,
    "width": 260,
    "height": 260
  },
  "nte-jiuyuan": {
    "left": 250,
    "top": 160,
    "width": 280,
    "height": 280
  }
};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--check')){
 const manifest=JSON.parse(await fs.readFile(path.join(out,'sources.json'),'utf8'));
 for(const icon of manifest.icons){const b=await fs.readFile(path.join(out,icon.file)),m=await sharp(b).metadata();if(hash(b)!==icon.sha256||m.width!==160||m.height!==160)throw new Error('Portrait mismatch '+icon.id);}
 if(manifest.icons.length!==12)throw new Error('Incomplete crossover roster');
 console.log('Official crossover portraits: 12 identities, hashes and dimensions verified.');
}else{
 await fs.mkdir(rawDir,{recursive:true});await fs.mkdir(out,{recursive:true});
 const records=[];
 for(const [id,name,origin,key] of definitions){
  const sourceUrl=origin==='nte'?'https://nte.perfectworld.com/public/m/images/main260402/role-poster-'+key+'.png':'https://upload-os-bbs.hoyolab.com/game_record/genshin/character_icon/UI_AvatarIcon_'+key+'.png';
  const rawPath=path.join(rawDir,id+'.png');
  let raw=await fs.readFile(rawPath).catch(()=>null);
  if(!raw){const r=await fetch(sourceUrl);if(!r.ok)throw new Error(r.status+' '+sourceUrl);raw=Buffer.from(await r.arrayBuffer());await fs.writeFile(rawPath,raw);}
  const metadata=await sharp(raw).metadata();
  records.push({id,name,origin,sourceUrl,sourceReference:origin==='nte'?'https://nte.perfectworld.com/kr/main.html':'https://genshin.hoyoverse.com/ko/',sourceSha256:hash(raw),sourceBytes:raw.length,sourceDimensions:[metadata.width,metadata.height],file:id+'.webp',crop:cropById[id]||null});
 }
 await fs.writeFile(path.join(audit,'download-sources.json'),JSON.stringify(records,null,2)+'\n');
 if(process.argv.includes('--fetch')){
  const tiles=[];
  for(let i=0;i<6;i++){
   tiles.push({input:await sharp(path.join(rawDir,records[i].id+'.png')).resize(200,330,{fit:'contain',background:'#dce9ed'}).png().toBuffer(),left:i*216+8,top:0});
   const svg='<svg width="216" height="30"><text x="108" y="20" text-anchor="middle" fill="#173347" font-family="sans-serif" font-size="15">'+records[i].id+'</text></svg>';
   tiles.push({input:Buffer.from(svg),left:i*216,top:330});
  }
  await sharp({create:{width:1296,height:360,channels:3,background:'#eaf2f4'}}).composite(tiles).jpeg({quality:88}).toFile(path.join(audit,'nte-source-contact.jpg'));
  console.log(JSON.stringify({fetched:records.map(x=>({id:x.id,bytes:x.sourceBytes,dimensions:x.sourceDimensions})),contact:path.join(audit,'nte-source-contact.jpg')}));
 }else{
  const icons=[];
  for(const record of records){
   let transform=sharp(path.join(rawDir,record.id+'.png'));
   if(record.crop)transform=transform.extract(record.crop);
   const b=await transform.resize(160,160,{fit:'cover'}).webp({quality:88}).toBuffer();
   await fs.writeFile(path.join(out,record.file),b);
   icons.push({...record,sha256:hash(b),bytes:b.length,dimensions:[160,160],processing:record.crop?'Face cropped from official character illustration; resized to 160×160 WebP.':'Official in-game portrait resized to 160×160 WebP.'});
  }
  const manifest={version:1,retrievedAt:new Date().toISOString(),sourceKind:'Official publisher-hosted character illustrations and game-art portrait icons',publishers:{nte:'Hotta Studio / Perfect World Games',genshin:'HoYoverse'},icons};
  await fs.writeFile(path.join(out,'sources.json'),JSON.stringify(manifest,null,2)+'\n');
  const tiles=[];
  for(let i=0;i<icons.length;i++){
   tiles.push({input:await sharp(path.join(out,icons[i].file)).resize(128,128).png().toBuffer(),left:i%6*160+16,top:Math.floor(i/6)*164+4});
   const svg='<svg width="160" height="28"><text x="80" y="18" text-anchor="middle" fill="#173347" font-family="sans-serif" font-size="13">'+icons[i].id+'</text></svg>';
   tiles.push({input:Buffer.from(svg),left:i%6*160,top:Math.floor(i/6)*164+136});
  }
  await sharp({create:{width:960,height:328,channels:3,background:'#edf4f5'}}).composite(tiles).jpeg({quality:88}).toFile(path.join(audit,'official-portraits-contact.jpg'));
  console.log(JSON.stringify({icons:icons.length,bytes:icons.reduce((n,x)=>n+x.bytes,0),contact:path.join(audit,'official-portraits-contact.jpg')}));
 }
}
