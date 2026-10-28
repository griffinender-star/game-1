import { sampleBall, runnerPosition, BASE_POINTS } from './playback.js';

/** Broadcast views share the same logical field so input and replay stay aligned. */
export const FIELD = Object.freeze({
  width:960, height:480,
  release:{x:662,y:302}, plate:{x:182,y:336}, zone:{x:151,y:275,w:62,h:77},
});
const C={home:'#2979c8',homeShade:'#17436c',away:'#ba4243',awayShade:'#6f2b35',navy:'#122a39',skin:'#cc9776',white:'#f9f9f1',pants:'#e8eeeb'};
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
  castShadow(c,x,y,length=30,width=5){
    c.save();c.translate(x,y);c.rotate(-.28);
    const g=c.createRadialGradient(-length*.25,0,1,-length*.4,0,length*.65);g.addColorStop(0,'rgba(12,32,29,.23)');g.addColorStop(.62,'rgba(12,32,29,.13)');g.addColorStop(1,'rgba(12,32,29,0)');
    this.ellipse(c,-length*.4,0,length*.65,width,g);c.restore();
  }
  cloud(c,x,y,s=1){
    c.save();c.translate(x,y);c.scale(s,s);
    [[0,2,66,21],[-26,-5,37,24],[14,-15,44,30],[48,3,42,19]].forEach(([a,b,rx,ry])=>{
      const g=c.createRadialGradient(a,b,0,a,b,rx);g.addColorStop(0,'rgba(255,249,235,.53)');g.addColorStop(.5,'rgba(252,247,235,.27)');g.addColorStop(1,'rgba(245,246,235,0)');this.ellipse(c,a,b,rx,ry,g);
    });c.restore();
  }
  texture(c,x,y,w,h,count,light,dark){
    // Static, deterministic detail is painted only into cached stadium backgrounds.
    for(let i=0;i<count;i++){const tx=x+((i*137.31+31.7)%w),ty=y+((i*87.23+11.9)%h);this.ellipse(c,tx,ty,.45+(i%4)*.22,.22+(i%3)*.1,i%3?light:dark);}
  }
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
    const g=c.createLinearGradient(0,top,0,bottom);g.addColorStop(0,'#243841');g.addColorStop(.42,'#1d353d');g.addColorStop(1,'#0e2631');this.rect(c,0,top,960,bottom-top,g);
    const colors=['#829697','#bdc6bd','#597c8e','#986d66','#bead8d','#527a8f','#839e8b','#9d8d83','#c2b8a5'];
    const spacing=(bottom-top-4)/rows;
    for(let row=0;row<rows;row++){
      const y=top+3+row*spacing;this.line(c,[[0,y+spacing-1],[960,y+spacing-1]],'rgba(126,149,153,.25)',.8);
      for(let col=0;col<137;col++){
        const jitter=Math.sin(col*7.3+row*2.7),x=col*7.15+(row%2)*2.8+jitter*1.4,py=y+2+jitter*.8;
        const color=colors[(col*13+row*7)%colors.length];c.globalAlpha=.48+((col*17+row*7)%5)*.085;
        this.ellipse(c,x+2,py+1,1.15,1.45,['#ae8e73','#c3a78c','#80644e'][(col+row)%3]);
        this.ellipse(c,x+2,py+3.8,2.2,2.8,color);
        if((col+row)%5===0)this.line(c,[[x-1,py+3],[x+5,py+3.5]],color,1);c.globalAlpha=1;
      }
    }
    [95,262,477,697,867].forEach(x=>{this.poly(c,[[x,top],[x+4,top],[x+13,bottom],[x-5,bottom]],'#5a6e72');for(let y=top+5;y<bottom;y+=6)this.line(c,[[x-2,y],[x+10,y]],'rgba(187,195,187,.43)',.8);});
    this.line(c,[[0,top],[960,top]],'#6c858b',1.3);this.line(c,[[0,bottom],[960,bottom]],'#091e29',3);
  }
  sign(c,x,y,w,h,label,bg='#123c50',fg='#f3f5e9'){
    this.roundRect(c,x,y,w,h,2,bg);this.line(c,[[x+3,y+2],[x+w-3,y+2]],'rgba(255,255,255,.25)',1);this.text(c,label,x+w/2,y+h*.69,Math.min(12,w/(label.length*.65)),fg,'center',700);
  }
  buildBackground(c){
    const sky=c.createLinearGradient(0,0,0,240);sky.addColorStop(0,'#718fa4');sky.addColorStop(.55,'#adc0c5');sky.addColorStop(1,'#e4d6bd');this.rect(c,0,0,960,480,sky);
    const sun=c.createRadialGradient(760,67,5,760,67,220);sun.addColorStop(0,'rgba(255,237,194,.9)');sun.addColorStop(.18,'rgba(254,222,174,.35)');sun.addColorStop(1,'rgba(251,222,181,0)');this.rect(c,510,0,450,270,sun);
    this.cloud(c,143,60,1.7);this.cloud(c,433,42,1.05);this.cloud(c,776,87,1.55);this.skyline(c,158);
    this.lights(c,48,37,.83);this.lights(c,899,37,.91);
    // Glass suites and cantilevered roof replace the old pixel-style grandstand.
    const glass=c.createLinearGradient(0,145,0,171);glass.addColorStop(0,'#486570');glass.addColorStop(1,'#243f4c');this.rect(c,0,145,960,30,glass);
    for(let x=6;x<960;x+=43){this.rect(c,x,150,35,18,'rgba(198,208,195,.19)');this.line(c,[[x+9,151],[x+18,167]],'rgba(236,229,207,.12)',2);}
    this.poly(c,[[0,137],[960,137],[960,147],[0,151]],'#172f3c');this.line(c,[[0,137],[960,137]],'#81969b',2);
    this.grandstand(c,173,230,5);
    this.rect(c,0,229,960,30,'#163f49');this.line(c,[[0,230],[960,230]],'#e6d6b4',2);this.line(c,[[0,258],[960,258]],'#072b32',4);
    this.sign(c,19,237,135,15,'NORTHSTAR ATHLETICS','#203f53');this.sign(c,173,237,178,15,'NEW YORK KNIGHTS','#e5e6db','#294550');this.sign(c,369,237,131,15,'KNIGHTS PARK','#a4493e');this.sign(c,517,237,164,15,'THE NATIONAL GAME','#e3ddc7','#294a4f');this.sign(c,699,237,133,15,'GOOD SPORT','#2d5658');this.text(c,'400',905,251,13,'#e0e6cd','center',700);
    const grass=c.createLinearGradient(0,259,0,480);grass.addColorStop(0,'#618b4c');grass.addColorStop(.45,'#4a7840');grass.addColorStop(1,'#305e34');this.rect(c,0,259,960,221,grass);
    for(let i=0;i<18;i++){const x=i*70-170;this.poly(c,[[i*61,259],[i*61+30,259],[x+122,480],[x+74,480]],i%2?'rgba(156,180,104,.12)':'rgba(21,61,35,.07)');}
    this.texture(c,0,260,960,220,3700,'rgba(183,201,127,.12)','rgba(14,45,31,.12)');
    // A sunlit infield with a shallow bevel and granular clay, cached once.
    const dirt=c.createLinearGradient(0,327,0,452);dirt.addColorStop(0,'#bd9671');dirt.addColorStop(.5,'#ad805e');dirt.addColorStop(1,'#8b6148');
    const dirtPoints=[[0,418],[151,325],[960,369],[960,435],[157,375],[21,480],[0,480]];this.poly(c,dirtPoints,dirt);
    this.line(c,[[0,418],[151,325],[960,369]],'rgba(58,74,35,.36)',2);this.poly(c,[[0,427],[154,341],[960,389],[960,403],[153,355],[0,457]],'rgba(224,189,144,.18)');
    c.save();c.beginPath();dirtPoints.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();this.texture(c,0,325,960,155,2400,'rgba(237,207,163,.2)','rgba(75,49,32,.13)');c.restore();
    this.line(c,[[177,356],[960,403]],'#e8e5cf',1.7);this.line(c,[[177,356],[0,479]],'#e8e5cf',1.7);
    this.ellipse(c,705,362,57,16,'rgba(69,46,32,.38)');this.ellipse(c,704,357,55,16,'#b58c66');this.ellipse(c,700,353,36,10,'rgba(218,181,137,.27)');this.roundRect(c,692,354,26,3,1,'#f5f0dd');
    this.ellipse(c,165,360,52,25,'#b88c66');this.poly(c,[[170,350],[185,350],[185,356],[177,362],[170,356]],'#f9f7ec');
    c.strokeStyle='rgba(246,234,208,.8)';c.lineWidth=1.3;c.strokeRect(127,344,29,30);
    const vignette=c.createRadialGradient(510,290,180,510,290,620);vignette.addColorStop(0,'rgba(10,24,36,0)');vignette.addColorStop(1,'rgba(10,24,36,.25)');this.rect(c,0,0,960,480,vignette);
    this.text(c,'KNIGHTS PARK',935,457,10,'rgba(221,234,211,.66)','right',500);
  }
  limb(c,points,color,width=8){this.line(c,points,color,width);}
  player(c,x,y,color,opts={}){
    const {small=false,pitcher=false,swing=-1,time=0,throwing=false,catcher=false,windup=1,flight=0}=opts;
    c.save();c.translate(x,y);if(small)c.scale(.40,.40);
    this.castShadow(c,0,2,57,7);this.shadow(c,8,3,32,6,.32);
    const skin=C.skin,dark=color===C.home?C.homeShade:C.awayShade;
    const uniform=(x1,y1,x2,y2)=>{const g=c.createLinearGradient(x1,y1,x2,y2);g.addColorStop(0,'#f3f4ed');g.addColorStop(.45,'#e3e9e5');g.addColorStop(1,'#a8b9b9');return g;};
    const jersey=c.createLinearGradient(-13,-72,17,-37);jersey.addColorStop(0,color);jersey.addColorStop(.5,color);jersey.addColorStop(1,dark);
    if(catcher){
      // Crouched catcher with shin guards, mask and an open receiving mitt.
      this.limb(c,[[-4,-35],[-18,-20],[-12,-4]],uniform(-20,-35,2,0),8);this.limb(c,[[9,-35],[25,-20],[21,-4]],uniform(0,-35,25,0),8);
      this.limb(c,[[-18,-19],[-12,-4]],'#253948',5);this.limb(c,[[25,-19],[21,-4]],'#253948',5);this.roundRect(c,-20,-4,16,5,2,'#132a37');this.roundRect(c,16,-4,18,5,2,'#132a37');
      this.poly(c,[[-11,-55],[-4,-59],[9,-58],[16,-48],[12,-31],[-9,-31]],jersey);this.roundRect(c,-6,-52,17,24,4,'#1c3040');this.line(c,[[-1,-48],[-1,-33]],'#475e6b',1.3);this.line(c,[[6,-48],[6,-33]],'#475e6b',1.3);
      this.ellipse(c,2,-66,7.6,9.2,skin);this.ellipse(c,2,-72,10,4.6,'#173248');this.roundRect(c,-9,-69,23,14,4,'rgba(22,43,55,.5)');
      for(let i=0;i<3;i++)this.line(c,[[-8,-67+i*5],[12,-67+i*5]],'#91a1a4',1);this.line(c,[[-4,-71],[-4,-54]],'#91a1a4',1);this.line(c,[[8,-71],[8,-54]],'#91a1a4',1);
      this.limb(c,[[12,-49],[25,-40],[34,-38]],color,7);this.limb(c,[[25,-40],[34,-38]],skin,5.5);this.glove(c,36,-38,1.05);c.restore();return;
    }
    let hipX=0,hipY=-38,shoulderX=0,shoulderY=-69,headX=1,headY=-85;
    let rearFoot={x:12,y:0},frontFoot={x:-10,y:0},frontKnee={x:-12,y:-20},rearKnee={x:13,y:-20};
    let leftElbow={x:-14,y:-53},leftHand={x:13,y:-51},rightElbow={x:21,y:-55},rightHand={x:20,y:-49};
    if(pitcher){
      // Windup is supplied by the game clock; release stays aligned to FIELD.release.
      const load=Math.sin(bounded(windup)*Math.PI),delivery=bounded((windup-.55)/.45),follow=bounded(flight/.24);
      hipX=-delivery*7-follow*5;shoulderX=-delivery*15-follow*7;shoulderY=-69+delivery*6+follow*5;headX=shoulderX+2;headY=shoulderY-16;
      frontKnee={x:-12-load*6-delivery*16,y:-20-load*23};frontFoot={x:-10-load*3-delivery*29,y:-load*19};rearKnee={x:13+delivery*3,y:-20};rearFoot={x:17+delivery*8,y:0};
      leftElbow={x:-16-delivery*11,y:-50-delivery*5};leftHand={x:-5-delivery*21,y:-47+delivery*3};
      rightElbow={x:20-delivery*47,y:-56-load*23+delivery*2};rightHand={x:7-delivery*49,y:-47-load*31-delivery*10};
      if(windup>=1){rightElbow={x:-29-follow*5,y:-61+follow*11};rightHand={x:-42-follow*7,y:-57+follow*20};}
    }else if(swing>=0){
      const turn=Math.sin(bounded(swing)*Math.PI),follow=bounded(swing);
      hipX=turn*3;shoulderX=turn*5;headX=2+turn*2;frontFoot.x=-13;rearFoot.x=15;
      leftElbow={x:-9+turn*15,y:-54};leftHand={x:17+turn*15,y:-52+turn*7};rightElbow={x:20+turn*8,y:-57+turn*3};rightHand={x:21+turn*15,y:-50+turn*6};
      rearKnee.x=13-turn*7;
    }else {const breath=Math.sin(time/630)*.5;shoulderY+=breath;headY+=breath;}
    this.limb(c,[[hipX-5,hipY],[frontKnee.x,frontKnee.y],[frontFoot.x,frontFoot.y]],uniform(-18,-40,2,0),8);
    this.limb(c,[[hipX+6,hipY],[rearKnee.x,rearKnee.y],[rearFoot.x,rearFoot.y]],uniform(0,-40,24,0),8.2);
    this.line(c,[[hipX-9,hipY+1],[frontKnee.x-3,frontKnee.y],[frontFoot.x-2,frontFoot.y-2]],'rgba(101,127,136,.55)',1);
    this.line(c,[[hipX+10,hipY+1],[rearKnee.x+3,rearKnee.y],[rearFoot.x+3,rearFoot.y-2]],'rgba(108,133,140,.45)',1);
    this.roundRect(c,frontFoot.x-7,frontFoot.y-3,15,5,2,'#172d38');this.roundRect(c,rearFoot.x-5,rearFoot.y-3,17,5,2,'#172d38');
    this.line(c,[[frontFoot.x-6,frontFoot.y+1],[frontFoot.x+7,frontFoot.y+1]],'#afbab6',.8);this.line(c,[[rearFoot.x-3,rearFoot.y+1],[rearFoot.x+11,rearFoot.y+1]],'#afbab6',.8);
    this.poly(c,[[shoulderX-11,shoulderY+1],[shoulderX-5,shoulderY-4],[shoulderX+8,shoulderY-3],[shoulderX+15,shoulderY+4],[hipX+10,hipY],[hipX-9,hipY]],jersey);
    this.line(c,[[shoulderX+1,shoulderY+1],[hipX+2,hipY-2]],'rgba(238,244,243,.72)',1);this.line(c,[[shoulderX-5,shoulderY-3],[shoulderX+1,shoulderY+3],[shoulderX+7,shoulderY-3]],'rgba(230,239,236,.7)',1);
    for(let i=0;i<3;i++)this.ellipse(c,shoulderX+2,shoulderY+8+i*7,.7,.7,'#d5e2de');this.text(c,pitcher?'24':'7',shoulderX+8,shoulderY+20,8,'#f1f4ed','center',600);
    this.line(c,[[hipX-9,hipY],[hipX+10,hipY]],'#203745',3);this.roundRect(c,hipX,hipY-1,3.4,3,1,'#a6b4b2');
    this.limb(c,[[shoulderX-9,shoulderY+4],[leftElbow.x,leftElbow.y]],dark,7.5);this.limb(c,[[leftElbow.x,leftElbow.y],[leftHand.x,leftHand.y]],skin,5.3);
    this.limb(c,[[shoulderX+11,shoulderY+5],[rightElbow.x,rightElbow.y]],color,7.5);this.limb(c,[[rightElbow.x,rightElbow.y],[rightHand.x,rightHand.y]],skin,5.5);
    if(pitcher)this.glove(c,leftHand.x,leftHand.y,.85);
    this.roundRect(c,headX-2,headY+7,7,10,2,'#b77e61');
    const face=c.createLinearGradient(headX-7,headY-7,headX+8,headY+9);face.addColorStop(0,'#e0b38d');face.addColorStop(.55,skin);face.addColorStop(1,'#9d6c54');this.ellipse(c,headX,headY,7.1,9.5,face);this.ellipse(c,headX-6,headY+1,1.8,2.8,'#b17b5b');
    const brimDirection=pitcher?-1:1;this.ellipse(c,headX+brimDirection*6.7,headY+1,1.7,2,'#c58d69');this.ellipse(c,headX+brimDirection*3,headY-1.5,.8,.8,'#2c3030');this.line(c,[[headX+brimDirection*2,headY+5],[headX+brimDirection*5,headY+5]],'#855d4b',.7);
    const helmet=c.createLinearGradient(headX-9,headY-12,headX+8,headY-3);helmet.addColorStop(0,'#3b6176');helmet.addColorStop(.48,'#213d51');helmet.addColorStop(1,'#102a3b');
    c.beginPath();c.ellipse(headX,headY-7,8.4,5.7,0,Math.PI,Math.PI*2);c.lineTo(headX+8.5,headY-3);c.lineTo(headX-8.5,headY-3);c.closePath();c.fillStyle=helmet;c.fill();this.roundRect(c,headX+(pitcher?-17:3),headY-5,14,2.6,1.3,'#132e40');this.line(c,[[headX-5,headY-10],[headX+2,headY-11]],'rgba(173,197,201,.4)',1);
    if(!pitcher){
      const batPivot={x:(leftHand.x+rightHand.x)/2,y:(leftHand.y+rightHand.y)/2};c.save();c.translate(batPivot.x,batPivot.y);
      const angle=swing<0?-.38:-.38+Math.sin(bounded(swing)*Math.PI)*2.8;c.rotate(angle);
      const bat=c.createLinearGradient(-3,0,4,0);bat.addColorStop(0,'#94724c');bat.addColorStop(.4,'#e7cf9e');bat.addColorStop(1,'#9b794e');
      this.roundRect(c,-2.5,-52,5.5,39,2.6,bat);this.roundRect(c,-1.4,-15,3,20,1.2,'#70513b');this.ellipse(c,0,6,3,1.3,'#76563b');
      if(swing>0&&swing<.78){c.strokeStyle='rgba(247,230,179,.26)';c.lineWidth=6;c.beginPath();c.arc(0,0,44,-1.15,.9);c.stroke();}c.restore();
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
    const concrete=c.createLinearGradient(0,0,0,480);concrete.addColorStop(0,'#233d49');concrete.addColorStop(1,'#102b34');this.rect(c,0,0,960,480,concrete);
    this.grandstand(c,14,243,18);
    // Curved terraces and a continuous LED ribbon follow the stadium bowl.
    c.save();c.beginPath();c.ellipse(480,265,530,234,0,Math.PI,Math.PI*2);c.strokeStyle='#526c76';c.lineWidth=7;c.stroke();c.beginPath();c.ellipse(480,265,526,218,0,Math.PI,Math.PI*2);c.strokeStyle='#142b37';c.lineWidth=12;c.stroke();c.beginPath();c.ellipse(480,265,525,218,0,Math.PI,Math.PI*2);c.strokeStyle='rgba(122,180,191,.6)';c.lineWidth=1.2;c.stroke();c.restore();
    const foul=c.createLinearGradient(0,220,0,480);foul.addColorStop(0,'#385d3b');foul.addColorStop(1,'#284c34');this.rect(c,0,226,960,254,foul);
    for(let i=0;i<16;i++)this.poly(c,[[i*85-190,226],[i*85-149,226],[i*99+114,480],[i*99+54,480]],i%2?'rgba(143,165,105,.07)':'rgba(15,44,32,.06)');
    this.texture(c,0,226,960,254,1900,'rgba(174,192,120,.09)','rgba(12,43,27,.11)');
    c.save();this.fieldShape(c);c.clip();const turf=c.createLinearGradient(0,55,0,440);turf.addColorStop(0,'#60834c');turf.addColorStop(.6,'#4c753d');turf.addColorStop(1,'#3c6636');this.rect(c,90,35,780,420,turf);
    for(let i=0;i<17;i++){const x=i*56-70;this.poly(c,[[x,25],[x+28,25],[x+136,450],[x+73,450]],i%2?'rgba(180,197,127,.11)':'rgba(20,58,34,.08)');}
    this.texture(c,100,40,760,410,5100,'rgba(190,205,139,.13)','rgba(15,51,27,.13)');
    c.beginPath();c.moveTo(127,192);c.quadraticCurveTo(480,-106,833,192);c.lineWidth=26;c.strokeStyle='#aa8968';c.stroke();c.restore();
    c.beginPath();c.moveTo(127,192);c.quadraticCurveTo(480,-106,833,192);c.lineWidth=12;c.strokeStyle='#24474c';c.stroke();c.beginPath();c.moveTo(127,186);c.quadraticCurveTo(480,-112,833,186);c.lineWidth=2.4;c.strokeStyle='#b0c4ba';c.stroke();
    c.save();this.fieldShape(c);c.clip();c.beginPath();c.moveTo(127,198);c.quadraticCurveTo(480,-100,833,198);c.lineWidth=14;c.strokeStyle='rgba(7,26,29,.13)';c.stroke();c.restore();
    const fieldLight=c.createRadialGradient(666,143,10,666,143,367);fieldLight.addColorStop(0,'rgba(244,221,159,.10)');fieldLight.addColorStop(.75,'rgba(244,221,159,.025)');fieldLight.addColorStop(1,'rgba(244,221,159,0)');c.save();this.fieldShape(c);c.clip();this.rect(c,90,40,780,410,fieldLight);c.restore();
    // Batter's eye, stadium identity and low-key outfield advertisements.
    this.roundRect(c,405,42,150,24,2,'#1d333b');this.sign(c,363,13,234,20,'DUGOUT  /  KNIGHTS PARK','#142e3a','#e1ece6');this.sign(c,183,103,105,17,'NORTHSTAR','#d2d6c6','#28434a');this.sign(c,673,103,105,17,'GOOD SPORT','#955746','#ecdfc8');this.text(c,'400',480,82,10,'#d2ddc2','center',650);this.text(c,'330',153,184,9,'#d1dec6','center');this.text(c,'330',807,184,9,'#d1dec6','center');
    const path=[[480,421],[626,304],[480,190],[334,304],[480,421]];
    // Wider clay arc behind the bases gives the infield depth and a natural edge.
    c.save();c.beginPath();c.moveTo(321,308);c.bezierCurveTo(349,232,418,179,480,172);c.bezierCurveTo(542,179,611,232,639,308);c.lineTo(615,321);c.lineTo(480,208);c.lineTo(345,321);c.closePath();
    const backDirt=c.createLinearGradient(0,175,0,327);backDirt.addColorStop(0,'#b5946f');backDirt.addColorStop(1,'#ad805b');c.fillStyle=backDirt;c.fill();c.clip();this.texture(c,315,172,330,160,900,'rgba(234,203,154,.25)','rgba(81,49,27,.11)');c.restore();
    this.line(c,path,'#896344',41);this.line(c,path,'#b58b63',36);this.line(c,path,'rgba(223,187,138,.28)',24);
    c.save();c.beginPath();path.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.lineWidth=36;c.strokeStyle='#b58b63';c.stroke();c.restore();
    for(let i=0;i<480;i++){const x=318+(i*47)%324,y=174+(i*67)%260,d=Math.abs(x-480)/160+Math.abs(y-304)/126;if(d<1.12&&d>.80)this.ellipse(c,x,y,.8,.45,i%2?'rgba(78,48,29,.15)':'rgba(246,216,164,.19)');}
    this.line(c,[[480,421],[120,177]],'#edeed9',1.65);this.line(c,[[480,421],[840,177]],'#edeed9',1.65);
    const homeDirt=c.createRadialGradient(478,414,4,480,420,41);homeDirt.addColorStop(0,'#c39f75');homeDirt.addColorStop(1,'#a47a54');this.ellipse(c,480,420,39,25,homeDirt);
    this.ellipse(c,482,306,21,13,'rgba(74,47,28,.25)');this.ellipse(c,480,303,20,13,'#b78e63');this.ellipse(c,477,300,15,8,'#c4a076');this.roundRect(c,473,300,14,3,1,'#eeeedd');
    [[626,304],[480,190],[334,304]].forEach(([x,y])=>{this.shadow(c,x+1,y+2,9,3,.35);this.poly(c,[[x,y-5],[x+7,y],[x,y+5],[x-7,y]],'#f5f4e9');this.line(c,[[x-5,y+1],[x,y+4],[x+5,y+1]],'#c2c8bc',1);});
    this.poly(c,[[474,418],[486,418],[486,424],[480,430],[474,424]],'#f6f4e7');c.strokeStyle='rgba(234,231,204,.82)';c.lineWidth=1;c.strokeRect(451,408,17,28);c.strokeRect(492,408,17,28);c.strokeRect(648,327,27,14);c.strokeRect(285,327,27,14);
    // Dugouts, rails and warmup circles are part of the ballpark instead of floating labels.
    [[27,307,105,44,'VISITORS'],[828,307,105,44,'KNIGHTS']].forEach(([x,y,w,h,label])=>{this.poly(c,[[x,y],[x+w,y-9],[x+w,y+h-9],[x,y+h]],'#193b3c');this.poly(c,[[x-4,y-4],[x+w+3,y-13],[x+w+3,y-4],[x-4,y+5]],'#547c71');this.line(c,[[x+4,y+17],[x+w-4,y+8]],'#8ca897',1.5);for(let i=0;i<7;i++)this.line(c,[[x+10+i*13,y+18-i],[x+10+i*13,y+33-i]],'#617f73',1);this.text(c,label,x+w/2,y+43,9,'#b6ccbc','center',550);});
    c.strokeStyle='rgba(202,218,184,.35)';c.lineWidth=1;c.beginPath();c.ellipse(384,427,14,7,0,0,Math.PI*2);c.stroke();c.beginPath();c.ellipse(576,427,14,7,0,0,Math.PI*2);c.stroke();
    const glow=c.createRadialGradient(440,225,70,480,240,540);glow.addColorStop(0,'rgba(250,227,168,.03)');glow.addColorStop(1,'rgba(6,24,30,.24)');this.rect(c,0,0,960,480,glow);
    this.text(c,'NEW YORK BASEBALL',20,463,9,'rgba(201,221,207,.55)');this.text(c,'KNIGHTS PARK',940,463,9,'rgba(201,221,207,.55)','right');
  }
  fieldPlayer(c,x,y,color,opts={}){
    const {running=false,time=0,selected=false,glove=false,throwing=false,catching=false,runner=false,bat=false}=opts;
    c.save();c.translate(x,y);this.castShadow(c,0,2,23,3.5);this.shadow(c,3,2,13,3.6,.30);
    if(selected){c.strokeStyle='rgba(194,229,212,.72)';c.lineWidth=1.2;c.beginPath();c.ellipse(1,2,10.5,3.5,0,0,Math.PI*2);c.stroke();}
    const stride=running?Math.sin(time/83)*4.1:0,lean=running?Math.sin(time/166)*1.1:0,hip=-12,shoulder=-24.5;
    this.limb(c,[[-2,hip],[-3-stride*.35,-5.5],[-3+stride,1]],'#cddbd7',3.8);this.limb(c,[[3,hip],[4+stride*.35,-5.5],[4-stride,1]],'#e6ece4',3.8);
    this.roundRect(c,-6+stride,0,5.8,2.4,1,'#142d37');this.roundRect(c,2-stride,0,6.8,2.4,1,'#142d37');
    const jersey=c.createLinearGradient(-5,-25,7,-12);jersey.addColorStop(0,color);jersey.addColorStop(.5,color);jersey.addColorStop(1,color===C.home?C.homeShade:C.awayShade);this.poly(c,[[-5+lean,shoulder],[-2+lean,shoulder-2],[3+lean,shoulder-2],[6+lean,shoulder+1],[5,hip],[-4,hip]],jersey);this.line(c,[[lean+1,shoulder+1],[1,hip-1]],'rgba(233,241,235,.5)',.65);this.text(c,runner?'7':'2',4,hip-3,4.1,'#e3ede4','center',650);
    const headX=lean+.5;this.ellipse(c,headX,-30.4,3.6,4.7,C.skin);const cap=c.createLinearGradient(-4,-36,4,-30);cap.addColorStop(0,'#3e6373');cap.addColorStop(1,'#153247');this.ellipse(c,headX,-33.5,4.4,2.5,cap);this.roundRect(c,headX+1,-33,5.8,1.5,.7,'#142d41');
    const leftLift=catching?-10:throwing?-7:running?stride:0,rightLift=throwing?-13:running?-stride:0;
    this.limb(c,[[-4+lean,-23],[-8,-19+leftLift*.55],[-8.5,-15+leftLift]],color,3.3);this.limb(c,[[5+lean,-23],[8,-19+rightLift*.55],[9,-15+rightLift]],color,3.3);
    this.limb(c,[[-8,-18+leftLift*.55],[-8.5,-14+leftLift]],C.skin,2.3);this.limb(c,[[8,-18+rightLift*.55],[9,-14+rightLift]],C.skin,2.3);
    if(glove){this.ellipse(c,-9,-14+leftLift,3.1,3.6,'#906841');this.line(c,[[-10,-17+leftLift],[-8,-12+leftLift]],'#bd9a65',.7);}
    if(bat){this.line(c,[[9,-18],[17,-34]],'#c8ac7d',2.1);this.line(c,[[9,-18],[12,-23]],'#624d38',1.5);}
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
    if(ball&&ball.visible!==false){const z=ball.z||0,x=ball.x,y=ball.y,screenY=Math.max(24,y-z);this.shadow(c,x,y+3,8+z*.025,3+z*.005,.35);const size=ball.segment==='throw'?9:z>100?13:11;
      if(ball.segment==='flight'||ball.segment==='bounce'){const home=this.fieldPoint(0);c.save();c.strokeStyle='rgba(245,238,204,.34)';c.lineWidth=1.8;c.beginPath();c.moveTo(home.x,home.y-8);c.quadraticCurveTo((home.x+x)/2,Math.max(25,(home.y+y)/2-z*.7),x,screenY);c.stroke();c.restore();}
      this.ball(c,x,screenY,size);if(p>.15&&p<.65){this.roundRect(c,x+10,screenY-10,34,15,4,'rgba(14,39,49,.78)');this.text(c,'BALL',x+27,screenY+1,8,'#f8f4df','center',700);}
    }
    if(!playback&&scene.phase==='pitch'){const progress=Math.min(1.25,scene.progress||0);this.ball(c,480,302+(421-302)*progress,9);}
    const view=this.viewport||{left:0,width:960};this.broadcastTag(c,view.left+14,12,playback?'BALL IN PLAY':'FIELD CAMERA');
    if(playback){this.broadcastTag(c,view.left+view.width-221,12,playback.event?.label||playback.label||kind.toUpperCase(),207,true);
      const runs=playback.event?.scored||0;if(p>.9&&runs>0){this.roundRect(c,532,397,107,23,5,'rgba(18,50,47,.9)');this.text(c,`+${runs} RUN${runs===1?'':'S'}`,585,413,12,'#f4d995','center',700);if(kind==='homerun')for(let i=0;i<22;i++){const x=365+(i*53)%240,y=91+(i*31+time/45)%85;this.ellipse(c,x,y,1.6,2.4,i%2?'#f6da8e':'#accab9');}}
      if(p>.76&&kind==='groundout'){this.roundRect(c,640,267,43,18,4,'rgba(27,48,54,.88)');this.text(c,'OUT',662,280,10,'#f7c2a8','center',700);}
      if(p>=.995)this.text(c,'PLAY COMPLETE',480,454,10,'#e9e3c4','center',600);
    }
  }
  broadcastTag(c,x,y,label,width=155,gold=false){this.roundRect(c,x,y,width,25,6,'rgba(16,39,53,.82)');this.ellipse(c,x+11,y+12,3,3,gold?'#e1c477':'#86bfaf');this.text(c,label,x+22,y+17,10,gold?'#f3db9b':'#e8f0e9','left',650);}
  draw(scene={}){
    // A narrower mobile camera removes outer stands while preserving players and all
    // physical pitch/base coordinates. The CSS box uses contain, never stretched art.
    const boxWidth=this.canvas.clientWidth||960,boxHeight=this.canvas.clientHeight||480;
    const narrow=boxWidth<1000&&boxWidth/boxHeight<1.65,width=narrow?760:960;
    const field=scene.view==='field'||Boolean(scene.playback),left=narrow?(field?100:80):0;
    if(this.canvas.width!==width||this.canvas.height!==480){this.canvas.width=width;this.canvas.height=480;this.ctx.imageSmoothingEnabled=true;}
    this.viewport={left,width};this.ctx.save();this.ctx.translate(-left,0);
    try{this.drawScene(scene);}finally{this.ctx.restore();}
  }
  drawScene(scene={}){
    if(scene.view==='field'||scene.playback){this.drawField(scene);return;}
    const c=this.ctx,{time=0,phase='ready',offense=false,progress=0,ball=null,swingProgress=-1,aim=null,hit=null,windup=1}=scene;
    c.clearRect(0,0,960,480);c.drawImage(this.background,0,0);
    const pitcherColor=offense?C.away:C.home,batterColor=offense?C.home:C.away;
    [[322,270],[835,274],[512,266]].forEach(([x,y])=>this.player(c,x,y,pitcherColor,{small:true,time}));
    this.player(c,122,360,pitcherColor,{catcher:true,time});this.player(c,160,367,batterColor,{swing:swingProgress,time});this.player(c,704,359,pitcherColor,{pitcher:true,throwing:phase==='pitch'&&progress<.2,windup:phase==='pitch'?windup:0,flight:progress,time});
    if(!hit&&phase!=='result'){
      const z=FIELD.zone;c.save();c.strokeStyle=offense?'rgba(234,244,237,.5)':'rgba(234,244,237,.58)';c.lineWidth=1.35;c.strokeRect(z.x,z.y,z.w,z.h);c.strokeStyle='rgba(234,244,237,.13)';for(let n=1;n<3;n++){this.line(c,[[z.x+z.w*n/3,z.y],[z.x+z.w*n/3,z.y+z.h]],'rgba(234,244,237,.13)',.7);this.line(c,[[z.x,z.y+z.h*n/3],[z.x+z.w,z.y+z.h*n/3]],'rgba(234,244,237,.13)',.7);}c.restore();
      if(aim&&!offense){c.save();c.strokeStyle='rgba(243,223,158,.85)';c.lineWidth=2;c.beginPath();c.arc(aim.x,aim.y,8,0,Math.PI*2);c.stroke();this.line(c,[[aim.x-13,aim.y],[aim.x-6,aim.y]],'#faecc6',1.5);this.line(c,[[aim.x+6,aim.y],[aim.x+13,aim.y]],'#faecc6',1.5);this.line(c,[[aim.x,aim.y-13],[aim.x,aim.y-6]],'#faecc6',1.5);this.line(c,[[aim.x,aim.y+6],[aim.x,aim.y+13]],'#faecc6',1.5);c.restore();}
    }
    if(ball){const approach=bounded((FIELD.release.x-ball.x)/(FIELD.release.x-FIELD.plate.x));const bx=Math.max(24,Math.min(936,ball.x)),by=ball.y;this.shadow(c,bx,358+(ball.x-182)*-.028,8,2,.28);
      c.save();c.strokeStyle='rgba(255,252,224,.35)';c.lineWidth=2;c.beginPath();c.moveTo(bx+32,by-3);c.quadraticCurveTo(bx+15,by-1,bx,by);c.stroke();c.restore();const glow=c.createRadialGradient(bx,by,2,bx,by,11+approach*5);glow.addColorStop(0,'rgba(250,246,219,.24)');glow.addColorStop(1,'rgba(250,246,219,0)');this.ellipse(c,bx,by,11+approach*5,11+approach*5,glow);this.ball(c,bx,by,9+approach*9);
    }
    if(phase==='impact'&&hit){const fade=1-bounded((hit.progress||0)/.2),x=FIELD.plate.x,y=329;c.save();c.globalAlpha=fade*.65;const flash=c.createRadialGradient(x,y,1,x,y,27);flash.addColorStop(0,'rgba(255,250,217,.75)');flash.addColorStop(1,'rgba(255,250,217,0)');this.ellipse(c,x,y,27,27,flash);c.strokeStyle='rgba(243,239,209,.6)';c.lineWidth=1.2;c.beginPath();c.ellipse(x,y,9+(1-fade)*17,9+(1-fade)*17,0,0,Math.PI*2);c.stroke();c.restore();}
    if(hit){const p=bounded(hit.progress||0),q=hit.quality??.7,x=182+p*(500+q*320)*(hit.direction<0?.6:1),y=329-Math.sin(p*Math.PI*.86)*(125+q*150)-p*50;this.ball(c,x,Math.max(20,y),8-p*3);}
    const view=this.viewport||{left:0,width:960};this.broadcastTag(c,view.left+16,14,offense?'AT THE PLATE':'ON THE MOUND',166);
    if(phase==='pitch'){this.roundRect(c,view.left+view.width-185,14,169,27,6,'rgba(16,39,53,.78)');this.text(c,'LIVE PITCH',view.left+view.width-102,33,11,'#f2f5e8','center',650);}
  }
}
