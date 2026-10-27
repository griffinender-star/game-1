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

  /** Paint one frame. `aim`, `ball`, and hit trajectories use FIELD coordinates. */
  draw(scene = {}) {
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
