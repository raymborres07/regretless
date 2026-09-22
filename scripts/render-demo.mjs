import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const work=path.resolve('.local/recording');
const output=path.resolve('artifacts');
mkdirSync(output,{recursive:true});
const marks=JSON.parse(readFileSync(path.join(work,'marks.json'),'utf8'));
const pickupMarks=existsSync(path.join(work,'pickup-marks.json'))?JSON.parse(readFileSync(path.join(work,'pickup-marks.json'),'utf8')):null;
const font="fontfile='C\\:/Windows/Fonts/arial.ttf'";
const bold="fontfile='C\\:/Windows/Fonts/arialbd.ttf'";
function run(args){execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});}
const enc=['-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','30','-an'];
const txt=(text,size,y,color='white',heavy=false)=>`drawtext=${heavy?bold:font}:text='${text}':fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}`;
function title(file,filters){run(['-f','lavfi','-i','color=c=0x22301f:s=1920x1080:r=30:d=4','-vf',filters.join(',')+',fade=t=in:d=0.3,fade=t=out:st=3.7:d=0.3',...enc,path.join(work,file)]);}
title('intro.mp4',[
 txt('regretless.',42,145,'0xd7f58e',true),
 txt('You bought it.',104,340,'white',true),
 txt('We stay on it.',104,475,'0xd7f58e',true),
 txt('The post-purchase money-recovery agent',30,700),
 txt('A walkthrough with illustrative purchases',20,925,'0xb4c3aa'),
]);
const scenes=[
 ['dashboard',7,'Your purchases. Your potential recovery.'],
 ['receipt',9,'01   Add a purchase and paste your receipt'],
 ['manual',6,'02   Enter details manually without AI credits'],
 ['replay',14,'03   Replay the example price drop - watch Convex update live'],
 ['policy',8,'04   Read the policy evidence before making a claim'],
 ['draft',8,'05   Review the request - example sending is disabled'],
];
for(const [name,duration,caption] of scenes){
 const picked=pickupMarks && ['receipt','policy','draft'].includes(name);
 const sourceMarks=picked?pickupMarks:marks;
 const i=sourceMarks.findIndex(m=>m.name===name);
 const start=sourceMarks[i].start,span=sourceMarks[i+1].start-start;
 const filter=`setpts=${duration/span}*(PTS-STARTPTS),fps=30,scale=1920:1080:flags=lanczos,setsar=1,drawbox=x=0:y=994:w=iw:h=86:color=0x22301f@0.97:t=fill,drawtext=${font}:text='${caption}':fontsize=29:fontcolor=white:x=70:y=1020,tpad=stop_mode=clone:stop_duration=1`;
 run(['-ss',String(start),'-t',String(span),'-i',path.join(work,picked?'pickups-raw.mp4':'walkthrough-raw.mp4'),'-vf',filter,'-t',String(duration),...enc,path.join(work,`${name}.mp4`)]);
 console.log(`Edited ${name}: ${duration}s`);
}
title('outro.mp4',[
 txt('regretless.',110,330,'0xd7f58e',true),
 txt('Your purchase keeps working after checkout.',40,530),
 txt('third-clam-324.convex.site',29,680,'0xd7f58e'),
 txt('Illustrative scenario. No real email sent or refund recovered.',22,910,'0xb4c3aa'),
]);
const clips=['intro',...scenes.map(s=>s[0]),'outro'];
writeFileSync(path.join(work,'concat.txt'),clips.map(n=>`file '${n}.mp4'`).join('\n'));
run(['-f','concat','-safe','0','-i',path.join(work,'concat.txt'),'-c','copy','-movflags','+faststart',path.join(output,'regretless-60s.mp4')]);
console.log('Created artifacts/regretless-60s.mp4');
