import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public/games/shared/blue-archive');
const mapping = [
 ['serika','세리카',13008],['ayane','아야네',23005],['nonomi','노노미',13004],['shiroko','시로코',10010],['hoshino','호시노',10005],
 ['haruka','하루카',16000],['mutsuki','무츠키',13006],['iori','이오리',10006],['ako','아코',20008],['hina','히나',10004],
 ['yuuka','유우카',13010],['momoi','모모이',13011],['midori','미도리',10016],['noa','노아',10052],['aris','아리스',10015],
 ['hanako','하나코',23007],['koharu','코하루',10020],['azusa','아즈사',10019],['tsurugi','츠루기',10013],['mika','미카',10059],['yuzu','유즈',10018],
];
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
if (process.argv.includes('--check')) {
 const manifest = JSON.parse(await fs.readFile(path.join(out,'sources.json'),'utf8'));
 for (const icon of manifest.icons) {
  const b = await fs.readFile(path.join(out,icon.file)), meta = await sharp(b).metadata();
  if (hash(b) !== icon.sha256 || meta.width !== 160 || meta.height !== 160) throw new Error('Icon mismatch: '+icon.id);
 }
 if (manifest.icons.length !== 21) throw new Error('Incomplete icon roster');
 console.log('Official game-art icons: 21 hashes and dimensions verified.');
} else {
 const get = async url => {
  const r = await fetch(url, {headers:{'User-Agent':'EternalHunger-official-art-provenance'}});
  if (!r.ok) throw new Error(r.status+' '+url);
  return r;
 };
 const commit = await (await get('https://api.github.com/repos/SchaleDB/SchaleDB/commits/main')).json();
 const revision = commit.sha;
 if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Missing immutable source revision');
 const base = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/'+revision;
 const roster = await (await get(base+'/data/kr/students.min.json')).json();
 await fs.mkdir(out,{recursive:true});
 const icons=[];
 for (const [id,name,studentId] of mapping) {
  const record=roster.find(s=>s.Id===studentId);
  if(record?.Name!==name) throw new Error('Identity mismatch '+id);
  const sourceUrl=base+'/images/student/icon/'+studentId+'.webp';
  const raw=Buffer.from(await (await get(sourceUrl)).arrayBuffer());
  const metadata=await sharp(raw).metadata();
  if(metadata.width<100||metadata.height<100)throw new Error('Unexpected icon '+id);
  const result=await sharp(raw).resize(160,160,{fit:'cover'}).webp({quality:88}).toBuffer();
  const file=id+'.webp'; await fs.writeFile(path.join(out,file),result);
  icons.push({id,name,studentId,file,sourceUrl,sourceSha256:hash(raw),sourceBytes:raw.length,sourceDimensions:[metadata.width,metadata.height],sha256:hash(result),bytes:result.length,dimensions:[160,160],processing:'Official in-game portrait crop resized to 160×160 WebP; no generated artwork.'});
 }
 const manifest={version:1,sourceKind:'Official Blue Archive game-art icons distributed by the community SchaleDB mirror',publisher:'NEXON Games / NEXON / Yostar',publisherReference:'https://bluearchive.nexon.com/',mirror:'https://github.com/SchaleDB/SchaleDB',revision,rosterUrl:base+'/data/kr/students.min.json',retrievedAt:new Date().toISOString(),icons};
 await fs.writeFile(path.join(out,'sources.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
 const tiles=[];
 for(let i=0;i<icons.length;i++){
  const b=await sharp(path.join(out,icons[i].file)).resize(128,128).toBuffer();
  tiles.push({input:b,left:i%7*144+8,top:Math.floor(i/7)*164+8});
  const label='<svg width="144" height="28"><text x="72" y="19" text-anchor="middle" fill="#182f3c" font-family="sans-serif" font-size="15">'+icons[i].id+'</text></svg>';
  tiles.push({input:Buffer.from(label),left:i%7*144,top:Math.floor(i/7)*164+136});
 }
 const audit=path.resolve(root,'../.local/kivotos-autochess');await fs.mkdir(audit,{recursive:true});
 await sharp({create:{width:1008,height:492,channels:3,background:'#eaf3f6'}}).composite(tiles).jpeg({quality:88}).toFile(path.join(audit,'official-icons-contact.jpg'));
 console.log(JSON.stringify({revision,count:icons.length,iconBytes:icons.reduce((s,x)=>s+x.bytes,0),contactSheet:path.join(audit,'official-icons-contact.jpg')}));
}
