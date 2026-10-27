import { sampleBall, runnerPosition, BASE_POINTS } from './playback.js';

/** Broadcast views share the same logical field so input and replay stay aligned. */
export const FIELD = Object.freeze({
  width:960, height:480,
  release:{x:662,y:302}, plate:{x:182,y:336}, zone:{x:151,y:275,w:62,h:77},
});
const C={home:'#3679ca',homeShade:'#174a87',away:'#c94e47',awayShade:'#862f36',navy:'#142b3b',skin:'#d8a47d',white:'#f5f6ee',pants:'#edf0ed'};
const lerp=(a,b,t)=>a+(b-a)*t;
const bounded=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));

export class Stadium {
  constructor(canvas){
    this.canvas=canvas;canvas.width=FIELD.width;canvas.height=FIELD.height;
    this.ctx=canvas.getContext('2d');this.ctx.imageSmoothingEnabled=true;
    this.background=canvas.ownerDocument.createElement('canvas');
    this.background.width=960;this.background.height=480;
    this.buildBackground(this.background.getContext('2d'));
    this.fieldBackground=canvas.ownerDocument.createElement('canvas');
    this.fieldBackground.width=960;this.fieldBackground.height=480;
    this.buildFieldBackground(this.fieldBackground.getContext('2d'));
  }
  rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
  poly(c,points,color){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();}
  ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();}
  roundRect(c,x,y,w,h,r,color){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.arcTo(x+w,y,x+w,y+r,r);c.lineTo(x+w,y+h-r);c.arcTo(x+w,y+h,x+w-r,y+h,r);c.lineTo(x+r,y+h);c.arcTo(x,y+h,x,y+h-r,r);c.lineTo(x,y+r);c.arcTo(x,y,x+r,y,r);c.closePath();c.fillStyle=color;c.fill();}
  text(c,text,x,y,size=14,color=C.white,align='left',weight=600){c.font=`${weight} ${size}px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y);}
  line(c,points,color,width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
  shadow(c,x,y,rx=15,ry=5,alpha=.25){const g=c.createRadialGradient(x,y,1,x,y,rx);g.addColorStop(0,`rgba(8,27,28,${alpha})`);g.addColorStop(1,'rgba(8,27,28,0)');this.ellipse(c,x,y,rx,ry,g);}
  cloud(c,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);const g=c.createLinearGradient(0,-15,0,22);g.addColorStop(0,'rgba(255,255,255,.93)');g.addColorStop(1,'rgba(231,243,247,.2)');this.ellipse(c,0,7,60,13,g);this.ellipse(c,-23,0,26,17,g);this.ellipse(c,10,-9,30,23,g);this.ellipse(c,37,3,29,16,g);c.restore();}
  skyline(c,y=160){
    for(let i=0;i<30;i++){
      const x=i*35-10,h=18+(i*29)%57,w=22+(i%3)*5;
      const g=c.createLinearGradient(x,y-h,x,y);g.addColorStop(0,'#527f93');g.addColorStop(1,'#739aa7');
      this.rect(c,x,y-h,w,h,g);
      if(i%5===0){this.rect(c,x+7,y-h-6,w-14,6,'#4a7385');this.line(c,[[x+w/2,y-h-6],[x+w/2,y-h-20]],'#557f90',1);}
      for(let row=0;row<Math.floor(h/12);row++)for(let col=0;col<3;col++)this.rect(c,x+4+col*7,y-h+6+row*11,3,5,'rgba(206,229,233,.42)');
    }
  }
  lights(c,x,y,scale=1){
    c.save();c.translate(x,y);c.scale(scale,scale);
    const steel=c.createLinearGradient(0,0,9,0);steel.addColorStop(0,'#546b75');steel.addColorStop(.5,'#bdc7c8');steel.addColorStop(1,'#4c6570');
    this.rect(c,0,21,7,134,steel);this.line(c,[[3,23],[-24,0],[31,0],[3,23]],'#81949d',3);
    this.roundRect(c,-35,-21,76,31,3,'#314953');
    for(let row=0;row<2;row++)for(let col=0;col<6;col++){this.roundRect(c,-30+col*11,-16+row*11,7,7,2,'#f8faf0');this.ellipse(c,-26+col*11,-13+row*11,6,4,'rgba(255,249,205,.17)');}
    for(let i=0;i<5;i++)this.line(c,[[-3,39+i*22],[10,39+i*22]],'#8d9ca0',2);
    c.restore();
  }
  grandstand(c,top,bottom,rows=6){
    const g=c.createLinearGradient(0,top,0,bottom);g.addColorStop(0,'#254654');g.addColorStop(1,'#132e3c');this.rect(c,0,top,960,bottom-top,g);
    const colors=['#d9e7e3','#c1d5df','#638ba3','#a45c55','#dbc49c','#3e7394','#8cad8d','#b7a9a3'];
    const spacing=(bottom-top-4)/rows;
    for(let row=0;row<rows;row++){
      const y=top+4+row*spacing;this.line(c,[[0,y+spacing-1],[960,y+spacing-1]],'#55717a',1);
      for(let col=0;col<108;col++){
        const x=col*9+(row%2)*4, color=colors[(col*13+row*7)%colors.length];
        this.ellipse(c,x+3,y+3,1.6,1.8,['#bd9c7c','#dbb799','#8e6b53'][(col+row)%3]);
        this.roundRect(c,x+.6,y+4.6,5.4,4.8,1.4,color);
      }
    }
    [95,262,477,697,867].forEach(x=>{this.poly(c,[[x,top],[x+8,top],[x+19,bottom],[x-6,bottom]],'#70868b');for(let y=top+5;y<bottom;y+=8)this.line(c,[[x-2,y],[x+14,y]],'#a4b2ae',1);});
    this.line(c,[[0,top],[960,top]],'#a0b3b7',2);this.line(c,[[0,bottom],[960,bottom]],'#091f2b',4);
  }
  sign(c,x,y,w,h,label,bg='#123c50',fg='#f3f5e9'){
    this.roundRect(c,x,y,w,h,2,bg);this.line(c,[[x+3,y+2],[x+w-3,y+2]],'rgba(255,255,255,.25)',1);this.text(c,label,x+w/2,y+h*.69,Math.min(12,w/(label.length*.65)),fg,'center',700);
  }
  buildBackground(c){
    const sky=c.createLinearGradient(0,0,0,210);sky.addColorStop(0,'#6aa9c7');sky.addColorStop(.6,'#b4d5df');sky.addColorStop(1,'#e4e7dc');this.rect(c,0,0,960,480,sky);
    const sun=c.createRadialGradient(788,49,2,788,49,106);sun.addColorStop(0,'rgba(255,248,211,.85)');sun.addColorStop(.15,'rgba(255,248,211,.42)');sun.addColorStop(1,'rgba(255,248,211,0)');this.rect(c,680,0,216,161,sun);
    this.cloud(c,131,64,1.1);this.cloud(c,442,36,.8);this.cloud(c,765,92,1.15);this.skyline(c,168);
    this.lights(c,47,47,.85);this.lights(c,901,41,.96);
    this.grandstand(c,170,233,5);
    this.rect(c,0,166,960,5,'#a5b7b8');this.rect(c,0,163,960,4,'#345869');
    this.rect(c,0,231,960,27,'#174756');this.line(c,[[0,231],[960,231]],'#e2d6a8',3);
    this.sign(c,22,236,135,17,'NORTHSTAR ATHLETICS','#2b4f66');this.sign(c,175,236,178,17,'NEW YORK KNIGHTS','#f0ece0','#27495b');this.sign(c,369,236,131,17,'KNIGHTS PARK','#a94c40');this.sign(c,517,236,164,17,'THE NATIONAL GAME','#f0e9ce','#264653');this.sign(c,699,236,133,17,'GOOD SPORT','#345f65');this.text(c,'400',904,250,14,'#ecedd9','center',700);
    const grass=c.createLinearGradient(0,256,0,480);grass.addColorStop(0,'#5c994e');grass.addColorStop(.45,'#4c8b43');grass.addColorStop(1,'#306b37');this.rect(c,0,258,960,222,grass);
    for(let i=0;i<13;i++){const x=i*100-160;this.poly(c,[[i*90,258],[i*90+45,258],[x+145,480],[x+60,480]],i%2?'rgba(141,182,85,.15)':'rgba(15,69,40,.09)');}
    this.line(c,[[0,258],[960,258]],'#315c39',5);
    const dirt=c.createLinearGradient(0,327,0,452);dirt.addColorStop(0,'#c89a70');dirt.addColorStop(.5,'#b57f58');dirt.addColorStop(1,'#946443');
    this.poly(c,[[0,418],[151,325],[960,369],[960,435],[157,375],[21,480],[0,480]],dirt);
    this.poly(c,[[0,427],[154,341],[960,389],[960,403],[153,355],[0,457]],'rgba(232,191,139,.28)');
    for(let i=0;i<360;i++){const x=(i*137+29)%960,y=336+(i*43)%87;if(y>336+x*.045&&y<376+x*.058)this.ellipse(c,x,y,1.5,.65,i%2?'rgba(88,50,27,.15)':'rgba(255,221,169,.2)');}
    this.line(c,[[177,356],[960,403]],'#f0ead6',2.3);this.line(c,[[177,356],[0,479]],'#f0ead6',2.3);
    this.ellipse(c,671,344,51,17,'#a6704c');this.ellipse(c,670,339,49,15,'#c6946d');this.ellipse(c,666,335,32,9,'rgba(220,177,127,.25)');this.roundRect(c,645,335,29,3.5,1,'#f5f1dd');
    this.ellipse(c,165,360,52,25,'#bc8a60');this.poly(c,[[170,350],[185,350],[185,356],[177,362],[170,356]],'#fffaf0');
    c.strokeStyle='#f2e5c7';c.lineWidth=1.5;c.strokeRect(127,344,29,30);
    this.rect(c,0,469,960,11,'#235639');this.line(c,[[0,469],[960,469]],'#81a569',2);
    const vignette=c.createRadialGradient(485,290,160,485,290,600);vignette.addColorStop(0,'rgba(10,24,36,0)');vignette.addColorStop(1,'rgba(10,24,36,.2)');this.rect(c,0,0,960,480,vignette);
    this.text(c,'KNIGHTS PARK',932,454,12,'rgba(229,238,218,.75)','right',600);
  }
  limb(c,points,color,width=8){this.line(c,points,color,width);}
  player(c,x,y,color,opts={}){
    const {small=false,pitcher=false,swing=-1,time=0,throwing=false,catcher=false}=opts;
    c.save();c.translate(x,y);if(small)c.scale(.48,.48);
    this.shadow(c,2,2,26,6,.36);
    const skin=C.skin,dark=color===C.home?C.homeShade:C.awayShade;
    if(catcher){
      this.limb(c,[[-5,-27],[-17,-13],[-12,-4]],'#e8e9df',10);this.limb(c,[[9,-27],[21,-13],[17,-3]],'#d4dcd7',10);
      this.roundRect(c,-19,-5,14,5,2,C.navy);this.roundRect(c,13,-4,17,5,2,C.navy);
      const jersey=c.createLinearGradient(-10,-47,15,-24);jersey.addColorStop(0,color);jersey.addColorStop(1,dark);this.roundRect(c,-11,-46,26,24,7,jersey);
      this.roundRect(c,-5,-43,16,22,3,'#203547');this.line(c,[[-2,-40],[-2,-24]],'#496071',2);this.line(c,[[7,-40],[7,-24]],'#496071',2);
      this.ellipse(c,2,-54,10,11,skin);this.roundRect(c,-11,-64,25,9,4,C.navy);
      c.strokeStyle='#7392a1';c.lineWidth=1.2;for(let i=0;i<3;i++)this.line(c,[[-9,-56+i*5],[13,-56+i*5]],'#8ca2a9',1.2);this.line(c,[[-6,-61],[-6,-44]],'#8ca2a9',1.2);this.line(c,[[9,-61],[9,-44]],'#8ca2a9',1.2);
      this.limb(c,[[12,-39],[23,-31],[30,-34]],color,8);this.glove(c,31,-34,1);
      c.restore();return;
    }
    const knee=throwing?-5:0;
    this.limb(c,[[-5,-29],[-8,-15],[-10,-2]],'#d9e0de',10);this.limb(c,[[8,-29],[11,-15+knee],[14,-2]],'#f2f3ec',10);
    this.line(c,[[-10,-27],[-12,-4]],'#a4b7bb',1.6);this.line(c,[[15,-28],[18,-4]],'#c2d0cd',1.5);
    this.roundRect(c,-17,-4,17,6,2,C.navy);this.roundRect(c,9,-4,20,6,2,C.navy);
    const jersey=c.createLinearGradient(-13,-52,16,-28);jersey.addColorStop(0,color);jersey.addColorStop(1,dark);this.poly(c,[[-12,-51],[-4,-57],[8,-57],[17,-48],[14,-28],[-10,-28]],jersey);
    this.line(c,[[3,-53],[3,-30]],'#e8edf0',1.2);for(let b=0;b<3;b++)this.ellipse(c,4,-48+b*6,1,1,'#d9e3e9');this.text(c,pitcher?'24':'7',9,-37,9,'#f8f9f2','center',800);
    this.roundRect(c,-10,-30,25,4,1,'#233949');this.roundRect(c,0,-29,4,3,.6,'#aab4ad');
    this.roundRect(c,-3,-63,12,9,3,'#bc8766');this.ellipse(c,2,-72,10,12,skin);this.ellipse(c,-6,-70,3,4,'#c28c68');
    const cap=c.createLinearGradient(-8,-82,12,-70);cap.addColorStop(0,'#3c5c70');cap.addColorStop(1,'#122d40');
    c.beginPath();c.ellipse(2,-78,12,8,0,Math.PI,Math.PI*2);c.lineTo(14,-72);c.lineTo(-10,-72);c.closePath();c.fillStyle=cap;c.fill();
    this.roundRect(c,pitcher?-19:7,-75,15,3.6,1.8,'#17374b');this.ellipse(c,pitcher?-4:9,-70,1.1,1.1,'#3c302c');this.line(c,[[4,-64],[8,-64]],'#a96e55',.8);
    if(pitcher){
      this.limb(c,[[14,-47],[20,-34],[11,-32]],color,9);this.limb(c,[[8,-32],[-3,-36]],skin,7);this.glove(c,-5,-36,.9);
      this.limb(c,[[-9,-48],throwing?[-21,-51]:[-21,-37],throwing?[-29,-40]:[-8,-35]],color,9);if(throwing)this.limb(c,[[-21,-51],[-30,-40]],skin,7);
    }else{
      this.limb(c,[[-9,-48],[-15,-36],[13,-34]],dark,9);this.limb(c,[[15,-47],[22,-37],[20,-34]],color,8);this.limb(c,[[12,-34],[22,-34]],skin,7);
      c.save();c.translate(23,-35);const angle=swing<0?-.48:-.48+Math.sin(Math.min(1,swing)*Math.PI)*2.65;c.rotate(angle);
      const bat=c.createLinearGradient(-3,0,4,0);bat.addColorStop(0,'#b48652');bat.addColorStop(.45,'#efd6a3');bat.addColorStop(1,'#a77b4b');
      this.roundRect(c,-3.5,-55,7,41,3,bat);this.roundRect(c,-2,-16,4,22,1.5,'#9a6c44');this.ellipse(c,0,7,3.5,1.8,'#795234');c.restore();
      if(swing>0&&swing<.8){c.strokeStyle='rgba(246,233,177,.38)';c.lineWidth=4;c.beginPath();c.arc(21,-35,48,-1.2,1.2);c.stroke();}
    }
    c.restore();
  }
  glove(c,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);this.ellipse(c,0,0,8,10,'#8c5b34');this.ellipse(c,-1,-2,5,7,'#b88955');this.line(c,[[-4,-7],[3,5]],'#dab37c',1);this.line(c,[[3,-7],[-3,5]],'#6d452c',1);c.restore();}
  ball(c,x,y,size=8){
    const r=size/2;c.save();this.ellipse(c,x,y,r+1.5,r+1.5,'rgba(26,43,44,.28)');const g=c.createRadialGradient(x-r*.35,y-r*.45,.5,x,y,r);g.addColorStop(0,'#fff');g.addColorStop(.7,'#fbf9eb');g.addColorStop(1,'#d6dbd6');this.ellipse(c,x,y,r,r,g);
    c.strokeStyle='#c45c52';c.lineWidth=Math.max(.6,size*.075);c.beginPath();c.arc(x-r*.8,y,r*.8,-.9,.9);c.stroke();c.beginPath();c.arc(x+r*.8,y,r*.8,Math.PI-.9,Math.PI+.9);c.stroke();c.restore();
  }
  fieldShape(c){c.beginPath();c.moveTo(480,438);c.lineTo(127,192);c.quadraticCurveTo(480,-106,833,192);c.closePath();}
  buildFieldBackground(c){
    const sky=c.createLinearGradient(0,0,0,50);sky.addColorStop(0,'#6faabd');sky.addColorStop(1,'#afc8c8');this.rect(c,0,0,960,480,sky);this.skyline(c,39);
    this.grandstand(c,37,240,15);
    const foul=c.createLinearGradient(0,220,0,480);foul.addColorStop(0,'#386e43');foul.addColorStop(1,'#2d6240');this.rect(c,0,226,960,254,foul);
    for(let i=0;i<16;i++)this.poly(c,[[i*85-190,226],[i*85-149,226],[i*99+114,480],[i*99+54,480]],i%2?'rgba(137,178,112,.08)':'rgba(15,56,37,.07)');
    c.save();this.fieldShape(c);c.clip();const turf=c.createLinearGradient(0,55,0,440);turf.addColorStop(0,'#5b9851');turf.addColorStop(.6,'#4c8c46');turf.addColorStop(1,'#3a793d');this.rect(c,90,35,780,420,turf);
    for(let i=0;i<17;i++){const x=i*56-70;this.poly(c,[[x,25],[x+28,25],[x+136,450],[x+73,450]],i%2?'rgba(183,209,127,.14)':'rgba(18,74,41,.08)');}
    for(let i=0;i<1600;i++){const x=100+(i*139)%760,y=40+(i*83)%410;this.ellipse(c,x,y,.6,.32,i%2?'rgba(191,213,146,.16)':'rgba(11,67,35,.12)');}
    c.beginPath();c.moveTo(127,192);c.quadraticCurveTo(480,-106,833,192);c.lineWidth=24;c.strokeStyle='#ba9673';c.stroke();c.restore();
    c.beginPath();c.moveTo(127,192);c.quadraticCurveTo(480,-106,833,192);c.lineWidth=12;c.strokeStyle='#214c4b';c.stroke();c.beginPath();c.moveTo(127,186);c.quadraticCurveTo(480,-112,833,186);c.lineWidth=3;c.strokeStyle='#d9e3d1';c.stroke();
    this.sign(c,355,35,250,24,'KNIGHTS PARK   /   NEW YORK','#132e3d','#ecf3e8');this.sign(c,184,103,110,19,'NORTHSTAR','#efead9','#294b5c');this.sign(c,669,103,110,19,'GOOD SPORT','#a45f4b','#fff3d9');this.text(c,'400',480,78,11,'#e5efd9','center',700);this.text(c,'330',154,185,10,'#e7efd6','center');this.text(c,'330',806,185,10,'#e7efd6','center');
    const path=[[480,421],[626,304],[480,190],[334,304],[480,421]];
    this.line(c,path,'#b27d52',43);this.line(c,path,'#c59669',34);
    for(let i=0;i<280;i++){const x=320+(i*47)%320,y=180+(i*67)%252,d=Math.abs(x-480)/160+Math.abs(y-304)/126;if(d<1.1&&d>.79)this.ellipse(c,x,y,1,.5,i%2?'rgba(92,51,27,.19)':'rgba(255,218,167,.22)');}
    this.line(c,[[480,421],[120,177]],'#f6f3df',2);this.line(c,[[480,421],[840,177]],'#f6f3df',2);
    this.line(c,path,'rgba(249,241,210,.68)',1.2);
    const homeDirt=c.createRadialGradient(478,414,4,480,420,40);homeDirt.addColorStop(0,'#cea578');homeDirt.addColorStop(1,'#af7c53');this.ellipse(c,480,420,39,25,homeDirt);
    this.ellipse(c,480,303,20,13,'#c1986d');this.ellipse(c,477,300,15,8,'#d0aa7e');this.roundRect(c,473,300,14,3,1,'#f5f2e1');
    [[626,304],[480,190],[334,304]].forEach(([x,y])=>{this.shadow(c,x+1,y+2,9,3,.35);this.poly(c,[[x,y-5],[x+7,y],[x,y+5],[x-7,y]],'#fffdf3');this.line(c,[[x-5,y+1],[x,y+4],[x+5,y+1]],'#d2d4c7',1);});
    this.poly(c,[[474,418],[486,418],[486,424],[480,430],[474,424]],'#fffdf3');c.strokeStyle='#f4ead0';c.lineWidth=1.3;c.strokeRect(451,408,17,28);c.strokeRect(492,408,17,28);c.strokeRect(648,327,27,14);c.strokeRect(285,327,27,14);
    this.text(c,'1ST',655,313,9,'rgba(231,238,214,.6)');this.text(c,'2ND',480,176,9,'rgba(231,238,214,.6)','center');this.text(c,'3RD',305,313,9,'rgba(231,238,214,.6)','right');
    this.roundRect(c,20,278,96,26,4,'rgba(13,46,51,.75)');this.text(c,'VISITORS',68,295,10,'#d9e4dd','center',600);this.roundRect(c,844,278,96,26,4,'rgba(13,46,51,.75)');this.text(c,'KNIGHTS',892,295,10,'#d9e4dd','center',600);
    const glow=c.createRadialGradient(440,225,40,480,240,500);glow.addColorStop(0,'rgba(246,236,176,.04)');glow.addColorStop(1,'rgba(7,28,34,.2)');this.rect(c,0,0,960,480,glow);
    this.rect(c,0,466,960,14,'#1a3e3d');this.line(c,[[0,466],[960,466]],'#a0b897',2);this.text(c,'NEW YORK BASEBALL',22,455,10,'rgba(211,229,214,.7)');this.text(c,'KNIGHTS PARK',938,455,10,'rgba(211,229,214,.7)','right');
  }
  fieldPlayer(c,x,y,color,opts={}){
    const {running=false,time=0,selected=false,glove=false,throwing=false,catching=false,runner=false,bat=false}=opts;
    c.save();c.translate(x,y);this.shadow(c,1,2,13,4,.34);
    if(selected){c.strokeStyle='rgba(245,219,139,.8)';c.lineWidth=1.3;c.beginPath();c.ellipse(1,2,11,4,0,0,Math.PI*2);c.stroke();this.poly(c,[[-3.5,-36],[3.5,-36],[0,-31]],'#f0d790');}
    const stride=running?Math.sin(time/76)*3.8:0;
    this.limb(c,[[-3,-11],[-4-stride*.45,-5],[-4+stride,1]],'#dce6e4',4.8);this.limb(c,[[4,-11],[5+stride*.45,-5],[5-stride,1]],'#edf1e7',4.8);
    this.roundRect(c,-8+stride,0,7,3,1,C.navy);this.roundRect(c,3-stride,0,8,3,1,C.navy);
    const jersey=c.createLinearGradient(-7,-23,9,-9);jersey.addColorStop(0,color);jersey.addColorStop(1,color===C.home?C.homeShade:C.awayShade);this.poly(c,[[-7,-22],[-3,-25],[4,-25],[9,-21],[7,-10],[-6,-10]],jersey);this.line(c,[[1,-22],[1,-12]],'#ebf1eb',.8);this.text(c,runner?'7':'2',5,-14,5,'#edf3ec','center',700);
    this.ellipse(c,0,-28,5,5.6,C.skin);this.ellipse(c,0,-32,6,3.4,'#183c51');this.roundRect(c,2,-31,7,2,1,'#17354a');
    const lift=catching||throwing?-7:running?stride:0;
    this.limb(c,[[-6,-21],[-10,-17+lift],[-11,-12+lift]],color,4);this.limb(c,[[8,-21],[11,-16-lift*.4],[12,-12-lift*.4]],color,4);
    this.ellipse(c,-11,-11+lift,2.3,2.5,glove?'#9b6a3d':C.skin);if(glove)this.ellipse(c,-12,-12+lift,3.5,4,'#9b6a3d');this.ellipse(c,12,-11-lift*.4,2.2,2.3,C.skin);
    if(bat){this.line(c,[[12,-16],[20,-31]],'#d3b17b',2.8);this.line(c,[[12,-16],[15,-21]],'#805c3c',2);}
    c.restore();
  }
  fieldPoint(base){return BASE_POINTS[Math.max(0,Math.min(4,base))]||BASE_POINTS[0];}
  drawField(scene={}){
    const c=this.ctx,playback=scene.playback||null,time=scene.time||0,p=playback?bounded(playback.progress||0):0,kind=playback?.kind||'';
    const offense=Boolean(scene.offense),defenseColor=offense?C.away:C.home,runnerColor=offense?C.home:C.away;
    const positions=[{x:480,y:304,pos:'P'},{x:480,y:437,pos:'C'},{x:638,y:315,pos:'1B'},{x:552,y:267,pos:'2B'},{x:407,y:265,pos:'SS'},{x:320,y:315,pos:'3B'},{x:285,y:175,pos:'LF'},{x:480,y:132,pos:'CF'},{x:675,y:175,pos:'RF'}];
    c.clearRect(0,0,960,480);c.drawImage(this.fieldBackground,0,0);
    [121,837].forEach((x,i)=>{this.line(c,[[x,154],[x,207]],'#c0cdd0',2);const flutter=Math.sin(time/240+i)*2;this.poly(c,[[x+1,154],[x+22,157+flutter],[x+1,165]],offense?C.away:C.home);});
    const target=playback?.target||{x:480,y:250},start=playback?.fielder||{x:407,y:226};
    let active=positions.reduce((best,pos,index)=>Math.hypot(pos.x-start.x,pos.y-start.y)<Math.hypot(positions[best].x-start.x,positions[best].y-start.y)?index:best,0);
    const phases=playback?.phases||{flightEnd:.52,fieldEnd:.72,runnersEnd:.94};
    const chaseEnd=['groundout','flyout'].includes(kind)?phases.flightEnd:phases.fieldEnd;
    const chase=playback?bounded((p-.08)/Math.max(.1,chaseEnd-.08)):0,fieldTarget={x:target.x,y:kind==='homerun'?Math.max(100,target.y+35):target.y};
    const ball=playback?sampleBall(playback,p):null,onSteal=kind==='stolen'||kind==='caught';if(onSteal)active=1;
    const throwingPlay=Boolean(playback&&!['homerun','foul','walk'].includes(kind));
    const receiverTarget=playback?.throwTarget||{x:480,y:190};let receiver=receiverTarget.x===626&&receiverTarget.y===304?2:receiverTarget.x===334&&receiverTarget.y===304?5:receiverTarget.x===480&&receiverTarget.y===190?3:0;if(receiver===active)receiver=active===3?4:3;
    const cover=throwingPlay?bounded((p-.4)/.34):0,motion=[];
    if(playback)(playback.runners||[]).forEach((runner,index)=>{
      if(runner.from===runner.to)return;c.save();c.strokeStyle=runner.scored?'rgba(255,220,131,.5)':'rgba(223,239,230,.28)';c.lineWidth=2;c.setLineDash([3,5]);c.beginPath();const a=this.fieldPoint(runner.from);c.moveTo(a.x,a.y);for(let base=runner.from+1;base<=runner.to;base++){const b=this.fieldPoint(base);c.lineTo(b.x,b.y);}c.stroke();c.restore();
      const delay=index*.015,progress=bounded((p-.12-delay)/Math.max(.1,phases.runnersEnd-.12-delay));motion.push({...runnerPosition(runner.from,runner.to,progress),runner,progress});
    });
    const renderPlayers=[];
    positions.forEach((pos,index)=>{
      const selected=Boolean(playback&&index===active&&!['foul','walk'].includes(kind)),covers=throwingPlay&&index===receiver;
      let x=selected&&!onSteal?lerp(pos.x,fieldTarget.x,chase):pos.x,y=selected&&!onSteal?lerp(pos.y,fieldTarget.y,chase):pos.y;
      if(covers){x=lerp(pos.x,receiverTarget.x,cover);y=lerp(pos.y,receiverTarget.y,cover);}
      renderPlayers.push({x,y,color:defenseColor,options:{time,running:selected&&!onSteal&&chase>0&&chase<1||covers&&cover>0&&cover<1,selected,glove:true,throwing:selected&&ball?.segment==='throw',catching:Boolean(ball?.caught)&&((selected&&p<.75)||(covers&&cover===1))},pos:pos.pos});
    });
    const occupied=playback?(p>=.995?(playback.displayBases||playback.afterBases||[]):playback.beforeBases||[]):scene.bases||[];
    occupied.forEach((on,index)=>{if(!on)return;if(playback&&p<.995&&(playback.runners||[]).some(r=>r.from===index+1))return;const a=this.fieldPoint(index+1);renderPlayers.push({x:a.x+9,y:a.y-3,color:runnerColor,options:{runner:true,time}});this.ellipse(c,a.x,a.y,9,5,'rgba(239,211,122,.26)');});
    motion.forEach(({x,y,runner,progress})=>{if(p>=.995||runner.out&&progress>.85||runner.scored&&progress>=1)return;renderPlayers.push({x:x+(runner.from===0?0:6),y:y-2,color:runnerColor,options:{running:progress>0&&progress<1,runner:true,time}});});
    const movingBatter=playback&&(playback.runners||[]).some(r=>r.from===0);if(!movingBatter&&!['single','double','triple','homerun','flyout','groundout'].includes(kind))renderPlayers.push({x:456,y:425,color:runnerColor,options:{bat:true,runner:true,time}});
    renderPlayers.sort((a,b)=>a.y-b.y).forEach(player=>{this.fieldPlayer(c,player.x,player.y,player.color,player.options);if(player.pos&&player.pos!=='C'&&!player.options.selected)this.text(c,player.pos,player.x,player.y+15,7,'rgba(231,240,224,.48)','center',500);});
    if(ball&&ball.visible!==false){const z=ball.z||0,x=ball.x,y=ball.y,screenY=Math.max(24,y-z);this.shadow(c,x,y+3,8+z*.025,3+z*.005,.35);const size=ball.segment==='throw'?7:z>100?10:8;
      if(ball.segment==='flight'||ball.segment==='bounce'){const home=this.fieldPoint(0);c.save();c.strokeStyle='rgba(255,247,207,.5)';c.lineWidth=2;c.setLineDash([3,5]);c.beginPath();c.moveTo(home.x,home.y-8);c.quadraticCurveTo((home.x+x)/2,Math.max(25,(home.y+y)/2-z*.7),x,screenY);c.stroke();c.restore();}
      this.ball(c,x,screenY,size);if(p>.15&&p<.65){this.roundRect(c,x+10,screenY-10,34,15,4,'rgba(14,39,49,.78)');this.text(c,'BALL',x+27,screenY+1,8,'#f8f4df','center',700);}
    }
    if(!playback&&scene.phase==='pitch'){const progress=Math.min(1.25,scene.progress||0);this.ball(c,480,302+(421-302)*progress,9);}
    this.broadcastTag(c,14,12,playback?'BALL IN PLAY':'FIELD CAMERA');
    if(playback){this.broadcastTag(c,739,12,playback.event?.label||playback.label||kind.toUpperCase(),207,true);
      const runs=playback.event?.scored||0;if(p>.9&&runs>0){this.roundRect(c,532,397,107,23,5,'rgba(18,50,47,.9)');this.text(c,`+${runs} RUN${runs===1?'':'S'}`,585,413,12,'#f4d995','center',700);if(kind==='homerun')for(let i=0;i<22;i++){const x=365+(i*53)%240,y=91+(i*31+time/45)%85;this.ellipse(c,x,y,1.6,2.4,i%2?'#f6da8e':'#accab9');}}
      if(p>.76&&kind==='groundout'){this.roundRect(c,640,267,43,18,4,'rgba(27,48,54,.88)');this.text(c,'OUT',662,280,10,'#f7c2a8','center',700);}
      if(p>=.995)this.text(c,'PLAY COMPLETE',480,454,10,'#e9e3c4','center',600);
    }
  }
  broadcastTag(c,x,y,label,width=155,gold=false){this.roundRect(c,x,y,width,25,6,'rgba(16,39,53,.82)');this.ellipse(c,x+11,y+12,3,3,gold?'#e1c477':'#86bfaf');this.text(c,label,x+22,y+17,10,gold?'#f3db9b':'#e8f0e9','left',650);}
  draw(scene={}){
    if(scene.view==='field'||scene.playback){this.drawField(scene);return;}
    const c=this.ctx,{time=0,phase='ready',offense=false,progress=0,ball=null,swingProgress=-1,aim=null,hit=null}=scene;
    c.clearRect(0,0,960,480);c.drawImage(this.background,0,0);
    const pitcherColor=offense?C.away:C.home,batterColor=offense?C.home:C.away;
    [[322,270],[835,274],[512,266]].forEach(([x,y])=>this.player(c,x,y,pitcherColor,{small:true,time}));
    this.player(c,122,360,pitcherColor,{catcher:true,time});this.player(c,160,367,batterColor,{swing:swingProgress,time});this.player(c,672,342,pitcherColor,{pitcher:true,throwing:phase==='pitch'&&progress<.2,time});
    if(!hit&&phase!=='result'){
      const z=FIELD.zone;c.save();c.strokeStyle=offense?'rgba(255,249,221,.28)':'rgba(255,242,195,.48)';c.lineWidth=1.5;c.setLineDash([4,4]);c.strokeRect(z.x,z.y,z.w,z.h);c.restore();
      if(aim&&!offense){c.save();c.strokeStyle='rgba(243,223,158,.85)';c.lineWidth=2;c.beginPath();c.arc(aim.x,aim.y,8,0,Math.PI*2);c.stroke();this.line(c,[[aim.x-13,aim.y],[aim.x-6,aim.y]],'#faecc6',1.5);this.line(c,[[aim.x+6,aim.y],[aim.x+13,aim.y]],'#faecc6',1.5);this.line(c,[[aim.x,aim.y-13],[aim.x,aim.y-6]],'#faecc6',1.5);this.line(c,[[aim.x,aim.y+6],[aim.x,aim.y+13]],'#faecc6',1.5);c.restore();}
    }
    if(ball){const approach=bounded((FIELD.release.x-ball.x)/(FIELD.release.x-FIELD.plate.x));const bx=Math.max(24,Math.min(936,ball.x)),by=ball.y;this.shadow(c,bx,358+(ball.x-182)*-.028,8,2,.28);
      c.save();c.strokeStyle='rgba(255,252,224,.35)';c.lineWidth=2;c.beginPath();c.moveTo(bx+32,by-3);c.quadraticCurveTo(bx+15,by-1,bx,by);c.stroke();c.restore();this.ball(c,bx,by,6+approach*6);
    }
    if(hit){const p=bounded(hit.progress||0),q=hit.quality??.7,x=182+p*(500+q*320)*(hit.direction<0?.6:1),y=329-Math.sin(p*Math.PI*.86)*(125+q*150)-p*50;this.ball(c,x,Math.max(20,y),8-p*3);}
    this.broadcastTag(c,16,14,offense?'AT THE PLATE':'ON THE MOUND',166);
    if(phase==='pitch'){this.roundRect(c,775,14,169,27,6,'rgba(16,39,53,.78)');this.text(c,'LIVE PITCH',858,33,11,'#f2f5e8','center',650);}
  }
}
