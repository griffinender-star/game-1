import { sampleBall, runnerPosition, BASE_POINTS } from './playback.js';

/** A self-contained pixel stadium. All coordinates use the 960 × 480 field. */
export const FIELD = Object.freeze({
  width: 960,
  height: 480,
  release: { x: 662, y: 302 },
  plate: { x: 182, y: 336 },
  zone: { x: 151, y: 275, w: 62, h: 77 },
});

const C = {
  sky: '#70c8d0', skyLight: '#a3dfdc', cloud: '#e8f3d4', cloudShade: '#c9e9dc',
  distant: '#66abb3', distantDark: '#57959f', navy: '#17384b', dark: '#143441',
  grass: '#72a94c', grassDark: '#609742', grassLight: '#7eb34f', grassShade: '#568b3c',
  dirt: '#cc9566', dirtLight: '#dfad7b', dirtDark: '#b77c55', chalk: '#efe4bb',
  home: '#f3cb70', homeShade: '#c6974a', away: '#e6795c', awayShade: '#ba5748',
  skin: '#e4ac80', skinShade: '#b47e59', white: '#f7eed3', pants: '#e7dfbf',
};

export class Stadium {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = FIELD.width;
    canvas.height = FIELD.height;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.background = canvas.ownerDocument.createElement('canvas');
    this.background.width = FIELD.width;
    this.background.height = FIELD.height;
    this.buildBackground(this.background.getContext('2d'));
    this.fieldBackground = canvas.ownerDocument.createElement('canvas');
    this.fieldBackground.width = FIELD.width;
    this.fieldBackground.height = FIELD.height;
    this.buildFieldBackground(this.fieldBackground.getContext('2d'));
  }

  rect(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  poly(c, points, color) {
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y)));
    c.closePath();
    c.fill();
  }

  text(c, text, x, y, size = 14, color = C.white, align = 'left') {
    c.fillStyle = color;
    c.textAlign = align;
    c.font = `900 ${size}px monospace`;
    c.fillText(text, Math.round(x), Math.round(y));
  }

  cloud(c, x, y, scale = 1) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    this.rect(c, 0, 15, 101, 14, C.cloudShade);
    this.rect(c, 8, 7, 79, 17, C.cloud);
    this.rect(c, 24, 0, 37, 14, C.cloud);
    this.rect(c, 85, 17, 19, 8, C.cloud);
    c.restore();
  }

  buildBackground(c) {
    // Wide bands preserve the feel of a tiny console palette.
    this.rect(c, 0, 0, 960, 480, C.sky);
    this.rect(c, 0, 70, 960, 51, '#83d1d3');
    this.rect(c, 0, 121, 960, 53, C.skyLight);
    this.rect(c, 803, 33, 42, 34, '#f5e9a0');
    this.rect(c, 795, 41, 58, 18, '#f5e9a0');
    this.cloud(c, 74, 35, 1.15);
    this.cloud(c, 359, 60, .7);
    this.cloud(c, 625, 23, 1.25);
    this.cloud(c, 881, 81, .6);

    // City roofs beyond the ballpark.
    for (let i = 0; i < 24; i++) {
      const x = i * 43 - 8;
      const h = 30 + ((i * 31) % 62);
      this.rect(c, x, 156 - h, 32 + i % 3 * 5, h, i % 3 ? C.distant : C.distantDark);
      if (i % 4 === 0) {
        this.rect(c, x + 9, 148 - h, 15, 8, C.distantDark);
        this.rect(c, x + 15, 132 - h, 3, 16, C.distantDark);
      }
      for (let j = 0; j < 3; j++) {
        this.rect(c, x + 6 + j * 8, 165 - h, 4, 6, '#a3d4cc');
        this.rect(c, x + 6 + j * 8, 182 - h, 4, 6, '#a3d4cc');
      }
    }
    // Floodlight pylons, drawn in distinct chunky steps.
    [42, 905].forEach(x => {
      this.rect(c, x + 17, 47, 5, 150, '#517d83');
      this.rect(c, x + 11, 52, 17, 3, '#3f6873');
      this.rect(c, x - 3, 29, 47, 25, C.navy);
      this.rect(c, x, 32, 41, 19, '#42626b');
      for (let k = 0; k < 5; k++) for (let row = 0; row < 2; row++) {
        this.rect(c, x + 3 + k * 7, 35 + row * 8, 5, 5, '#f5e6ad');
      }
      for (let k = 0; k < 5; k++) this.rect(c, x + 13, 65 + k * 24, 14, 3, '#385f6b');
    });

    // The grandstand: stepped seating, varied fans, and a dark canopy edge.
    this.poly(c, [[0, 150], [960, 150], [960, 216], [0, 216]], '#2d5a64');
    this.rect(c, 0, 147, 960, 7, '#54787d');
    const crowd = ['#e2bd79', '#e99470', '#69b6be', '#eadfc0', '#d87e69', '#94c07e'];
    for (let row = 0; row < 4; row++) {
      this.rect(c, 0, 161 + row * 13, 960, 3, '#143e4c');
      for (let j = 0; j < 77; j++) {
        const x = j * 13 + (row % 2) * 6;
        const y = 152 + row * 13;
        this.rect(c, x + 4, y, 4, 4, '#d8ac80');
        this.rect(c, x + 2, y + 4, 8, 6, crowd[(j * 17 + row * 11) % crowd.length]);
        if (j % 11 === 0) this.rect(c, x, y + 4, 2, 3, crowd[j % crowd.length]);
      }
    }
    [227, 485, 739].forEach(x => {
      this.rect(c, x, 151, 14, 62, '#668181');
      for (let j = 0; j < 6; j++) this.rect(c, x, 156 + j * 9, 14, 3, '#a0b6a6');
    });
    this.rect(c, 0, 207, 960, 39, '#1d5961');
    this.rect(c, 0, 207, 960, 5, '#e9d18d');
    this.rect(c, 0, 244, 960, 7, '#244d3c');
    this.sign(c, 23, 216, 134, 22, 'NIGHT OWL', '#e9c06d', C.navy);
    this.sign(c, 172, 216, 185, 22, 'KNIGHTS BASEBALL', '#163f4d', '#d9e6bc');
    this.sign(c, 371, 216, 127, 22, 'PLAY IT LOUD', '#dc775c', '#fff1cc');
    this.sign(c, 512, 216, 168, 22, 'PIXEL ATHLETICS', '#e0d6aa', '#224b5b');
    this.sign(c, 695, 216, 142, 22, 'GOOD SPORT', '#80b4a5', '#163e4c');
    this.text(c, '400', 893, 235, 15, '#f0dc9d', 'center');

    // Perspective field stripes and scalloped far edge.
    this.rect(c, 0, 251, 960, 229, C.grass);
    for (let i = 0; i < 8; i++) {
      const left = i * 143 - 220;
      this.poly(c, [[i * 125, 251], [i * 125 + 64, 251], [left + 140, 480], [left, 480]], i % 2 ? C.grassDark : C.grassLight);
    }
    this.rect(c, 0, 251, 960, 7, C.grassShade);
    // Distant fielders.
    this.player(c, 322, 270, C.away, { small: true });
    this.player(c, 835, 274, C.away, { small: true });
    this.player(c, 512, 266, C.away, { small: true });
    // Dirt baseline and home-plate area.
    this.poly(c, [[0, 415], [142, 321], [960, 366], [960, 438], [151, 372], [30, 480], [0, 480]], C.dirt);
    this.poly(c, [[0, 423], [147, 332], [960, 381], [960, 399], [151, 352], [0, 450]], C.dirtLight);
    this.poly(c, [[0, 469], [155, 365], [960, 424], [960, 438], [151, 372], [30, 480], [0, 480]], C.dirtDark);
    // Faint square grit, generated deterministically, never random flicker.
    for (let i = 0; i < 130; i++) {
      const x = (i * 137 + 29) % 960;
      const y = 341 + ((i * 43) % 69);
      if (y > 339 + x * .053 && y < 367 + x * .065) this.rect(c, x, y, 3, 2, i % 2 ? '#bf865a' : '#e0ab75');
    }
    // Chalk and pitcher's mound.
    this.poly(c, [[175, 353], [960, 400], [960, 403], [174, 356]], C.chalk);
    this.poly(c, [[175, 353], [0, 475], [0, 480], [176, 357]], C.chalk);
    this.poly(c, [[619, 345], [629, 329], [670, 321], [708, 329], [726, 345], [709, 355], [635, 353]], C.dirt);
    this.rect(c, 644, 336, 30, 4, '#f3e4b8');
    this.poly(c, [[170, 349], [185, 349], [185, 356], [177, 362], [170, 356]], '#fff4d5');
    this.poly(c, [[129, 348], [158, 350], [159, 375], [130, 373]], '#ead1a0');
    this.poly(c, [[132, 351], [155, 353], [156, 372], [133, 370]], C.dirt);
    this.rect(c, 0, 462, 960, 18, '#315e36');
    this.rect(c, 0, 460, 960, 3, '#7ca65d');
    this.text(c, 'KNIGHTS FIELD', 928, 449, 13, '#d7d89b', 'right');
    this.text(c, 'EST. 1987', 928, 465, 9, '#b5c389', 'right');
  }

  sign(c, x, y, w, h, label, bg, fg) {
    this.rect(c, x, y, w, h, bg);
    this.rect(c, x + 2, y + 2, w - 4, 1, fg);
    this.text(c, label, x + w / 2, y + h - 6, label.length > 14 ? 10 : 12, fg, 'center');
  }

  player(c, x, y, color, opts = {}) {
    const { small = false, pitcher = false, swing = -1, time = 0, throwing = false, catcher = false } = opts;
    c.save();
    c.translate(Math.round(x), Math.round(y));
    if (small) c.scale(.5, .5);
    const bob = !small && Math.sin(time / 390) > .9 ? -1 : 0;
    c.translate(0, bob);
    this.rect(c, -14, -2, 34, 5, '#284b3e66');
    const shade = color === C.home ? C.homeShade : C.awayShade;
    if (catcher) {
      this.rect(c, -14, -17, 12, 14, C.pants);
      this.rect(c, 6, -17, 12, 14, C.pants);
      this.rect(c, -15, -4, 13, 5, C.navy);
      this.rect(c, 7, -4, 15, 5, C.navy);
      this.rect(c, -10, -39, 24, 25, color);
      this.rect(c, -5, -37, 13, 23, C.navy);
      this.rect(c, -9, -52, 22, 16, C.skin);
      this.rect(c, -11, -56, 24, 7, C.navy);
      this.rect(c, -9, -48, 24, 3, '#3c5660');
      this.rect(c, -9, -40, 24, 3, '#3c5660');
      this.rect(c, 14, -33, 16, 10, '#8e643f');
      c.restore();
      return;
    }
    // Cleats, trouser legs and a three-pixel stripe.
    this.rect(c, -10, -26, 10, 23, C.pants);
    this.rect(c, 5, -26, 10, 23, C.pants);
    this.rect(c, -10, -26, 3, 21, '#c4c8ae');
    this.rect(c, 12, -26, 3, 21, '#c4c8ae');
    this.rect(c, -13, -5, 14, 6, C.navy);
    this.rect(c, 5, -5, 17, 6, C.navy);
    this.rect(c, -12, -52, 28, 29, color);
    this.rect(c, -12, -52, 7, 29, shade);
    this.rect(c, -10, -27, 24, 4, C.navy);
    this.rect(c, 2, -47, 3, 19, '#ffefc1');
    this.rect(c, 8, -43, 4, 7, '#ffefc1');
    this.rect(c, -6, -59, 17, 10, C.skinShade);
    this.rect(c, -8, -72, 23, 17, C.skin);
    this.rect(c, -9, -74, 25, 9, C.navy);
    this.rect(c, pitcher ? -16 : 12, -68, 11, 4, C.navy);
    this.rect(c, pitcher ? -7 : 10, -61, 3, 3, C.navy);
    if (small) {
      this.rect(c, -19, -48, 9, 19, shade);
      this.rect(c, 15, -48, 9, 19, color);
      this.rect(c, -21, -33, 12, 11, '#8e643f');
      this.rect(c, 16, -31, 9, 8, C.skin);
    } else if (pitcher) {
      const arm = throwing ? -11 : 1;
      this.rect(c, -20, -49 + arm, 12, 9, shade);
      this.rect(c, -27, -46 + arm, 12, 8, C.skin);
      this.rect(c, 14, -46, 10, 18, color);
      this.rect(c, -14, -46, 11, 12, '#88613f');
      if (throwing) {
        this.rect(c, -35, -57, 14, 7, C.skin);
        this.rect(c, -40, -60, 7, 8, C.skin);
      }
    } else {
      this.rect(c, 14, -49, 9, 16, color);
      this.rect(c, 16, -35, 13, 7, C.skin);
      this.rect(c, -16, -48, 9, 16, shade);
      this.rect(c, -12, -36, 29, 7, C.skin);
      c.save();
      c.translate(21, -35);
      const angle = swing < 0 ? -.45 : -.45 + Math.sin(Math.min(1, swing) * Math.PI) * 2.6;
      c.rotate(angle);
      this.rect(c, -3, -51, 7, 35, '#e1bd72');
      this.rect(c, -2, -17, 5, 23, '#ae794c');
      this.rect(c, -1, -50, 2, 28, '#f2d792');
      c.restore();
      if (swing > 0 && swing < .8) {
        c.strokeStyle = '#f8df9e';
        c.globalAlpha = .5;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(17, -33, 45, -1.3, 1.2);
        c.stroke();
      }
    }
    c.restore();
  }

  ball(c, x, y, size = 7) {
    x = Math.round(x); y = Math.round(y);
    this.rect(c, x - size / 2 + 1, y - size / 2 - 1, size - 2, size + 2, '#fff5d7');
    this.rect(c, x - size / 2 - 1, y - size / 2 + 1, size + 2, size - 2, '#fff5d7');
    this.rect(c, x + 1, y - 2, 2, 2, '#d46f56');
  }


  /** The complete diamond is cached separately from the close-up batting camera. */
  buildFieldBackground(c) {
    this.rect(c, 0, 0, 960, 480, '#1d4550');
    this.rect(c, 0, 0, 960, 26, '#73c5cd');
    for (let i=0;i<36;i++) {
      const height=7+(i*13)%16;
      this.rect(c,i*29,26-height,19,height,'#5ca5ac');
      if(i%4===0)this.rect(c,i*29+7,22-height,4,5,'#3e818d');
    }
    // The grandstand wraps around the outfield, behind the curved wall.
    this.rect(c, 0, 26, 960, 192, '#163b4a');
    const crowd=['#f0cd8c','#dd8268','#75b7bf','#d9e4bc','#7faf88','#ad91bb'];
    for(let row=0;row<13;row++) {
      this.rect(c,0,29+row*13,960,3,'#294e5a');
      for(let col=0;col<79;col++) {
        const x=col*13+(row%2?4:0),y=30+row*13;
        this.rect(c,x+3,y,4,4,'#cba77b');
        this.rect(c,x+1,y+4,8,5,crowd[(col*7+row*11)%crowd.length]);
      }
    }
    [93,252,704,866].forEach(x=>{
      this.rect(c,x,26,11,185,'#5c7c7c');
      for(let j=0;j<20;j++)this.rect(c,x,31+j*9,11,2,'#9db1a2');
    });
    this.rect(c,0,219,960,261,'#508b4b');
    // Foul territory receives a different cut so the white lines stay legible.
    for(let i=0;i<13;i++)this.poly(c,[[i*93-150,219],[i*93-100,219],[i*100+105,480],[i*100+45,480]],i%2?'#568f4a':'#5e974e');
    c.save();
    c.beginPath();c.moveTo(480,438);c.lineTo(127,192);c.quadraticCurveTo(480,-106,833,192);c.closePath();c.clip();
    this.rect(c,100,29,760,410,'#76ad50');
    for(let i=0;i<14;i++) {
      const x=i*68-15;
      this.poly(c,[[x,29],[x+34,29],[x+126,443],[x+64,443]],i%2?'#70a64a':'#80b657');
    }
    // A narrow warning track follows the wall, rather than filling the whole field.
    c.beginPath();c.moveTo(127,192);c.quadraticCurveTo(480,-106,833,192);c.strokeStyle='#bd9564';c.lineWidth=27;c.stroke();
    c.restore();
    // An outfield wall with a bright cap and small, original sponsor boards.
    c.beginPath();c.moveTo(127,192);c.quadraticCurveTo(480,-106,833,192);c.strokeStyle='#173e48';c.lineWidth=12;c.stroke();
    c.beginPath();c.moveTo(127,186);c.quadraticCurveTo(480,-112,833,186);c.strokeStyle='#f0ca77';c.lineWidth=4;c.stroke();
    this.rect(c,351,35,258,22,'#102e3c');
    this.text(c,'KNIGHTS PARK  •  EST. 1987',480,50,12,'#eadba9','center');
    this.sign(c,185,103,107,19,'GOOD SPORT','#e7c178','#23484f');
    this.sign(c,670,103,107,19,'PIXEL CLUB','#d67b5e','#fff0bd');
    this.text(c,'400',480,76,11,'#ffe2a0','center');
    this.text(c,'330',157,182,10,'#ffe2a0','center');
    this.text(c,'330',803,182,10,'#ffe2a0','center');
    // Dirt forms the running diamond. The centre remains grass.
    this.poly(c,[[480,442],[309,304],[480,168],[651,304]],'#bd895c');
    this.poly(c,[[480,432],[320,304],[480,178],[640,304]],'#d7a371');
    this.poly(c,[[480,389],[370,304],[480,217],[590,304]],'#71a54b');
    this.poly(c,[[480,381],[380,304],[480,225],[580,304]],'#7db052');
    // Chalk baselines continue into foul territory.
    this.poly(c,[[478,423],[120,176],[119,180],[480,426]],'#ede3bc');
    this.poly(c,[[482,423],[840,176],[841,180],[480,426]],'#ede3bc');
    this.poly(c,[[480,419],[626,304],[480,190],[334,304]],'#e8d5a0');
    this.poly(c,[[480,415],[620,304],[480,195],[340,304]],'#c79263');
    this.poly(c,[[480,391],[370,304],[480,218],[590,304]],'#79ab50');
    // Home and mound dirt are deliberately chunky instead of smooth gradients.
    this.poly(c,[[443,418],[451,401],[480,391],[508,401],[517,418],[507,437],[453,437]],'#ce9868');
    this.poly(c,[[462,305],[466,293],[480,288],[494,293],[499,305],[491,313],[470,313]],'#d4a174');
    this.rect(c,473,301,15,4,'#f4eaca');
    // Fine deterministic dirt flecks never flicker between frames.
    for(let i=0;i<160;i++) {
      const x=320+(i*47)%320,y=180+(i*67)%252;
      const d=Math.abs(x-480)/160+Math.abs(y-304)/126;
      if(d<1&&d>.75)this.rect(c,x,y,2,2,i%2?'#e2b17d':'#b78156');
    }
    const bases=[[626,304],[480,190],[334,304]];
    bases.forEach(([x,y])=>this.poly(c,[[x,y-6],[x+7,y],[x,y+6],[x-7,y]],'#fff4d2'));
    this.poly(c,[[474,418],[486,418],[486,424],[480,430],[474,424]],'#fff4d2');
    // Batter boxes and coaching boxes complete the field without noisy decoration.
    c.strokeStyle='#eadab3';c.lineWidth=2;
    c.strokeRect(451,408,17,28);c.strokeRect(492,408,17,28);
    c.strokeRect(648,327,27,14);c.strokeRect(285,327,27,14);
    this.text(c,'1ST',659,308,10,'#e7dfae');
    this.text(c,'2ND',480,177,10,'#e7dfae','center');
    this.text(c,'3RD',301,308,10,'#e7dfae','right');
    // Concourses, on-deck circles and tiny bullpen doors frame the playable grass.
    this.rect(c,0,465,960,15,'#183f43');
    this.rect(c,0,462,960,3,'#96b878');
    this.text(c,'PIXEL LEAGUE BASEBALL',23,456,11,'#cbd8a5');
    this.text(c,'THE WHOLE DIAMOND. EVERY PLAY.',935,456,10,'#cbd8a5','right');
    this.rect(c,16,268,102,26,'#23444a');
    this.text(c,'VISITORS',67,285,11,'#dbe3bc','center');
    this.rect(c,842,268,102,26,'#23444a');
    this.text(c,'KNIGHTS',893,285,11,'#eed9a2','center');
  }

  fieldPlayer(c,x,y,color,options={}) {
    const {running=false,time=0,selected=false,glove=false,throwing=false,catching=false,runner=false,bat=false}=options;
    const px=Math.round(x),py=Math.round(y),stride=running?(Math.floor(time/90)%2?3:-3):0;
    c.save();c.translate(px,py);
    this.rect(c,-8,0,18,4,'#254a385e');
    if(selected){
      this.poly(c,[[-5,-32],[5,-32],[0,-27]],'#fff0b1');
      c.strokeStyle='#fff0b199';c.lineWidth=1;c.strokeRect(-10,-26,22,31);
    }
    this.rect(c,-6,-10,5,11+Math.max(0,stride),'#e8e4c8');
    this.rect(c,3,-10,5,11+Math.max(0,-stride),'#e8e4c8');
    this.rect(c,-8,1+Math.max(0,stride),8,3,'#193b47');
    this.rect(c,3,1+Math.max(0,-stride),9,3,'#193b47');
    this.rect(c,-8,-22,18,14,color);
    this.rect(c,-8,-22,4,14,color===C.home?C.homeShade:C.awayShade);
    this.rect(c,0,-20,3,10,'#fff1c3');
    this.rect(c,-5,-29,12,10,C.skin);
    this.rect(c,-7,-32,16,6,'#183b4b');
    this.rect(c,6,-28,6,3,'#183b4b');
    const armLift=catching||throwing?-13:running?stride:0;
    this.rect(c,-12,-20+armLift,5,10,color);
    this.rect(c,10,-20-armLift*.4,5,10,color);
    this.rect(c,-12,-12+armLift,5,5,glove?'#916a3e':C.skin);
    this.rect(c,10,-12-armLift*.4,5,5,C.skin);
    if(bat)this.rect(c,17,-34,3,24,'#f2d18e');
    if(runner){this.rect(c,-4,-16,3,4,'#fff1c3');this.rect(c,4,-16,3,4,'#fff1c3');}
    c.restore();
  }

  fieldPoint(base) { return BASE_POINTS[Math.max(0,Math.min(4,base))]||BASE_POINTS[0]; }

  drawField(scene={}) {
    const c=this.ctx,playback=scene.playback||null,time=scene.time||0;
    const progress=playback?Math.max(0,Math.min(1,playback.progress||0)):0;
    const kind=playback?.kind||'';
    const offense=Boolean(scene.offense),defenseColor=offense?C.away:C.home,runnerColor=offense?C.home:C.away;
    const positions=[{x:480,y:304,pos:'P'},{x:480,y:437,pos:'C'},{x:638,y:315,pos:'1B'},{x:552,y:267,pos:'2B'},{x:407,y:265,pos:'SS'},{x:320,y:315,pos:'3B'},{x:285,y:175,pos:'LF'},{x:480,y:132,pos:'CF'},{x:675,y:175,pos:'RF'}];
    c.clearRect(0,0,960,480);c.drawImage(this.fieldBackground,0,0);
    // Flags react only to the decorative clock; game positions use playback progress.
    [121,837].forEach((x,i)=>{
      this.rect(c,x,156,3,53,'#dfd6aa');
      this.poly(c,[[x+3,157],[x+25,159+(Math.floor(time/180+i)%2)*3],[x+3,169]],offense?C.away:C.home);
    });
    const target=playback?.target||{x:480,y:250};
    const start=playback?.fielder||{x:407,y:226};
    let active=positions.reduce((best,p,index)=>Math.hypot(p.x-start.x,p.y-start.y)<Math.hypot(positions[best].x-start.x,positions[best].y-start.y)?index:best,0);
    const phases=playback?.phases||{flightEnd:.52,fieldEnd:.72,runnersEnd:.94};
    const chaseEnd=kind==='groundout'?phases.flightEnd:kind==='flyout'?phases.flightEnd:phases.fieldEnd;
    const chase=playback?Math.max(0,Math.min(1,(progress-.08)/Math.max(.1,chaseEnd-.08))):0;
    const fieldTarget={x:target.x,y:kind==='homerun'?Math.max(100,target.y+35):target.y};
    const currentBall=playback?sampleBall(playback,progress):null;
    const onSteal=kind==='stolen'||kind==='caught';
    if(onSteal)active=1;
    const throwingPlay=Boolean(playback&&!['homerun','foul','walk'].includes(kind));
    const receiverTarget=playback?.throwTarget||{x:480,y:190};
    let receiver=receiverTarget.x===626&&receiverTarget.y===304?2:receiverTarget.x===334&&receiverTarget.y===304?5:receiverTarget.x===480&&receiverTarget.y===190?3:0;
    if(receiver===active)receiver=active===3?4:3;
    const cover=throwingPlay?Math.max(0,Math.min(1,(progress-.4)/.34)):0;
    const motion=[];
    if(playback) {
      const runners=playback.runners||[];
      // Running paths make the current play readable at phone scale.
      runners.forEach((runner,index)=>{
        if(runner.from===runner.to)return;
        c.save();c.strokeStyle=runner.scored?'#ffe7a96b':'#ecf0bc40';c.lineWidth=3;c.setLineDash([4,7]);
        c.beginPath();const a=this.fieldPoint(runner.from);c.moveTo(a.x,a.y);
        for(let base=runner.from+1;base<=runner.to;base++){const b=this.fieldPoint(base);c.lineTo(b.x,b.y);}
        c.stroke();c.restore();
        const delay=index*.015,runProgress=Math.max(0,Math.min(1,(progress-.12-delay)/Math.max(.1,phases.runnersEnd-.12-delay)));
        const point=runnerPosition(runner.from,runner.to,runProgress);
        motion.push({...point,runner,runProgress});
      });
    }
    positions.forEach((pos,index)=>{
      const selected=Boolean(playback&&index===active&&!['foul','walk'].includes(kind));
      const covers=throwingPlay&&index===receiver;
      let x=selected&&!onSteal?pos.x+(fieldTarget.x-pos.x)*chase:pos.x;
      let y=selected&&!onSteal?pos.y+(fieldTarget.y-pos.y)*chase:pos.y;
      if(covers){x=pos.x+(receiverTarget.x-pos.x)*cover;y=pos.y+(receiverTarget.y-pos.y)*cover;}
      const throwing=selected&&currentBall?.segment==='throw';
      const catching=Boolean(currentBall?.caught)&&((selected&&progress<.75)||(covers&&cover===1));
      this.fieldPlayer(c,x,y,defenseColor,{time,running:selected&&!onSteal&&chase>0&&chase<1||covers&&cover>0&&cover<1,selected,glove:true,throwing,catching});
      if(!selected&&pos.pos!=='C')this.text(c,pos.pos,x,y+15,8,'#e4e6b87a','center');
    });
    // Occupied bases are always shown. A play holds its final bases until Continue.
    const occupied=playback?(progress>=.995?(playback.displayBases||playback.afterBases||[]):playback.beforeBases||[]):scene.bases||[];
    occupied.forEach((on,index)=>{
      if(!on)return;
      if(playback&&progress<.995&&(playback.runners||[]).some(r=>r.from===index+1))return;
      const p=this.fieldPoint(index+1);this.fieldPlayer(c,p.x+9,p.y-3,runnerColor,{runner:true,time});
      this.rect(c,p.x-5,p.y+3,10,3,'#f8d47c');
    });
    motion.forEach(({x,y,runner,runProgress})=>{
      if(progress>=.995)return;
      if(runner.out&&runProgress>.85)return;
      if(runner.scored&&runProgress>=1)return;
      this.fieldPlayer(c,x+(runner.from===0?0:6),y-2,runnerColor,{running:runProgress>0&&runProgress<1,runner:true,time});
    });
    const movingBatter=playback&&(playback.runners||[]).some(r=>r.from===0);
    if(!movingBatter&&!['single','double','triple','homerun','flyout','groundout'].includes(kind))this.fieldPlayer(c,456,425,runnerColor,{bat:true,runner:true,time});
    if(currentBall&&currentBall.visible!==false) {
      const z=currentBall.z||0,x=currentBall.x,y=currentBall.y,screenY=Math.max(27,y-z);
      this.rect(c,x-6,y+3,13,4,'#173c3c55');
      const size=z>100?9:8;
      // A high-contrast halo keeps the baseball distinct from the grass and crowd.
      this.rect(c,x-size/2-2,screenY-size/2-1,size+4,size+3,'#21463d80');
      this.ball(c,x,screenY,size);
      if(currentBall.segment==='flight'||currentBall.segment==='bounce') {
        c.save();c.strokeStyle='#fff3bb99';c.lineWidth=2;c.setLineDash([3,7]);
        const home=this.fieldPoint(0);c.beginPath();c.moveTo(home.x,home.y-8);c.quadraticCurveTo((home.x+x)/2,Math.max(27,(home.y+y)/2-z*.7),x,screenY);c.stroke();c.restore();
      }
      if(progress>.15&&progress<.65) {
        this.rect(c,x+13,screenY-8,33,15,'#163b43e8');this.text(c,'BALL',x+29,screenY+3,9,'#fff1b9','center');
      }
    }
    if(!playback&&scene.phase==='pitch') {
      const p=Math.min(1.25,(scene.progress||0)/.86);
      this.ball(c,480,302+(421-302)*p,8);
    }
    // The full-field camera has a small broadcast bug; nothing hides the diamond.
    this.rect(c,14,12,155,24,'#112e3de8');
    this.rect(c,22,20,6,6,'#f3ca73');
    this.text(c,playback?'BALL IN PLAY':'FIELD CAM',39,28,11,'#f2e7bd');
    if(playback) {
      const label=playback.event?.label||playback.label||kind.toUpperCase();
      this.rect(c,733,12,213,24,'#112e3de8');this.text(c,label,839,28,11,'#f2cd76','center');
      const runs=playback.event?.scored||0;
      if(progress>.9&&runs>0){
        this.rect(c,532,396,105,22,'#153f3ee8');this.text(c,`+${runs} RUN${runs===1?'':'S'}`,584,412,12,'#ffe3a0','center');
        // Pixel confetti celebrates the score without masking the players.
        if(kind==='homerun')for(let i=0;i<24;i++){
          const x=355+(i*53)%250,y=90+(i*31+Math.floor(time/45))%90;
          this.rect(c,x,y,3,5,i%2?'#ffe09b':'#c0e0a1');
        }
      }
      if(progress>.76&&kind==='groundout'){
        this.rect(c,640,266,43,18,'#183c45e8');this.text(c,'OUT',662,279,11,'#f5bea0','center');
      }
      if(progress>=.995){this.text(c,'PLAY COMPLETE',480,455,10,'#f2dfaa','center');}
    }
  }

  /** Paint one frame. `aim`, `ball`, and hit trajectories use FIELD coordinates. */
  draw(scene = {}) {
    if (scene.view === 'field' || scene.playback) { this.drawField(scene); return; }
    const c = this.ctx;
    const { time = 0, phase = 'ready', offense = false, progress = 0, ball = null,
      swingProgress = -1, aim = null, hit = null } = scene;
    c.clearRect(0, 0, 960, 480);
    c.drawImage(this.background, 0, 0);
    // Small moving pennants add life without blurring the pixel art.
    [82, 862].forEach((x, i) => {
      this.rect(c, x, 106, 3, 43, '#537f83');
      const flutter = Math.floor(time / 240 + i) % 2 ? 3 : 0;
      this.poly(c, [[x + 3, 107], [x + 26, 110 + flutter], [x + 3, 120]], C.home);
    });
    const pitcherColor = offense ? C.away : C.home;
    const batterColor = offense ? C.home : C.away;
    this.player(c, 122, 360, pitcherColor, { catcher: true });
    this.player(c, 160, 367, batterColor, { swing: swingProgress, time });
    this.player(c, 672, 342, pitcherColor, { pitcher: true, throwing: phase === 'pitch' && progress < .17, time });

    // A clear strike window remains readable on a narrow portrait screen.
    if (!hit && phase !== 'result') {
      const z = FIELD.zone;
      c.save();
      c.strokeStyle = offense ? '#fff0c06b' : '#f5d578b3';
      c.lineWidth = 2;
      c.setLineDash([5, 5]);
      c.strokeRect(z.x, z.y, z.w, z.h);
      c.setLineDash([]);
      c.restore();
      if (aim && !offense) {
        c.save();
        c.strokeStyle = '#ffedaf';
        c.lineWidth = 3;
        const ax = Math.round(aim.x), ay = Math.round(aim.y);
        c.strokeRect(ax - 9, ay - 9, 18, 18);
        this.rect(c, ax - 15, ay - 1, 9, 3, '#fff3c9');
        this.rect(c, ax + 7, ay - 1, 9, 3, '#fff3c9');
        this.rect(c, ax - 1, ay - 15, 3, 9, '#fff3c9');
        this.rect(c, ax - 1, ay + 7, 3, 9, '#fff3c9');
        c.restore();
      }
    }
    if (ball) {
      const dx = FIELD.release.x - ball.x;
      for (let i = 3; i > 0; i--) {
        c.globalAlpha = .15 + (3 - i) * .07;
        this.rect(c, ball.x + Math.sign(dx) * i * 9, ball.y - i * 2, 5, 4, '#fff9df');
      }
      c.globalAlpha = 1;
      this.ball(c, ball.x, ball.y, 8);
      this.rect(c, ball.x - 4, 355 + (ball.x - 182) * -.025, 9, 3, '#1d493b55');
    }
    if (hit) {
      const p = Math.min(1, Math.max(0, hit.progress || 0));
      const quality = hit.quality ?? .7;
      const direction = hit.direction ?? 1;
      const x = 182 + p * (500 + quality * 320) * (direction < 0 ? .6 : 1);
      const y = 329 - Math.sin(p * Math.PI * .86) * (125 + quality * 150) - p * 50;
      c.save();
      c.strokeStyle = '#fff2b866';
      c.lineWidth = 2;
      c.setLineDash([4, 9]);
      c.beginPath();
      c.moveTo(182, 329);
      c.quadraticCurveTo((182 + x) / 2, y - 90 * p, x, y);
      c.stroke();
      c.restore();
      this.ball(c, x, y, Math.max(3, 8 - p * 4));
      // Contact stars use tiny rectangles instead of soft particle effects.
      if (p < .2) for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        this.rect(c, 182 + Math.cos(a) * p * 170, 329 + Math.sin(a) * p * 130, 4, 4, '#ffe58c');
      }
    }
  }
}
