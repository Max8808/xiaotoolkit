// ===== 小功能 =====
// Author: 张三
// 小功能：热门排序 + 收藏歌单自动切换 + 单击播放 + 歌词界面完全沉浸 + 隐藏听歌识曲 + 顶部插件按钮 + 10种桌面特效 + 歌单自适应布局 + 搜索历史
// 注意：右键下载已独立为单独插件，如需使用请安装 right-click-download
// 在插件设置面板中可独立开关每个功能

var ctx = null;
var disposeSettings = null;

// ================== 7. 桌面特效 ==================
// 使用 OffscreenCanvas + Web Worker，粒子渲染跑在独立线程，切歌不卡

var _effectWorker = null;
var _effectCanvas = null;
var _effectCount = 80;
var _effectMode = 'snow';

// 生成 Worker 脚本（Blob URL），避免单独文件
function _eBuildWorker() {
  var code = [
    'var MODES=' + JSON.stringify(_effectModes) + ';',
    'var COUNT=' + _effectCount + ';',
    'var mode="' + _effectMode + '";',
    'var canvas=null,ctx=null,w=0,h=0,particles=[],animId=null,cfg=null,shape="",color="";',
    'var lastTime=0;',
    // Worker 没有 window，用 getter 代理到 w/h
    'var window={get innerWidth(){return w},get innerHeight(){return h}};',
    'function rand(a,b){return a+Math.random()*(b-a)}',
    'function mkParticle(){',
    '  var c=cfg,s=rand(c.sizeRange[0],c.sizeRange[1]);',
    '  return{x:Math.random()*w,y:mode==="fire"?h+Math.random()*h*0.2:-s-Math.random()*h*0.4,r:s,speed:rand(c.speedRange[0],c.speedRange[1]),wind:rand(c.windRange[0],c.windRange[1]),opacity:rand(c.opacityRange[0],c.opacityRange[1]),gravity:c.gravity,rot:Math.random()*Math.PI*2,rotSpeed:rand(-0.03,0.03),phase:Math.random()*Math.PI*2}',
    '}',
    // 嵌入绘制函数（精简版，与主线程相同逻辑）
    _edrawSnowflake.toString().replace(/function _edrawSnowflake/, 'function drSnow'),
    _edrawOval.toString().replace(/function _edrawOval/, 'function drOval'),
    _edrawHeart.toString().replace(/function _edrawHeart/, 'function drHeart'),
    _edrawConfetti.toString().replace(/function _edrawConfetti/, 'function drConf'),
    _edrawStar.toString().replace(/function _edrawStar/, 'function drStar'),
    _edrawMaple.toString().replace(/function _edrawMaple/, 'function drMaple'),
    _edrawSakura.toString().replace(/function _edrawSakura/, 'function drSaku'),
    _edrawRosePetal.toString().replace(/function _edrawRosePetal/, 'function drPetal'),
    _edrawAurora.toString().replace(/function _edrawAurora/, 'function drAuro'),
    _edrawFire.toString().replace(/function _edrawFire/, 'function drFire'),
    _edrawLine.toString().replace(/function _edrawLine/, 'function drLine'),
    'function frame(now){',
    '  if(!ctx)return;',
    '  var dt=Math.min((now||0)-lastTime,50);lastTime=now||0;var f=dt/16.667;',
    '  ctx.clearRect(0,0,w,h);',
    '  for(var i=0;i<particles.length;i++){',
    '    var p=particles[i];',
    '    p.y+=(p.speed*p.gravity+0.2)*f;p.x+=(p.wind+Math.sin(p.phase)*0.2)*f;p.rot+=p.rotSpeed*f;p.phase+=0.01*f;',
    '    if(p.y>h+p.r*2||(mode==="fire"&&p.y<-p.r*2)){particles[i]=mkParticle();continue}',
    '    if(p.x>w+p.r)p.x=-p.r;if(p.x<-p.r)p.x=w+p.r;',
    '    switch(shape){',
    '      case"snowflake":drSnow(ctx,p,color);break;',
    '      case"circle":ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle="rgba("+color+","+p.opacity+")";ctx.fill();break;',
    '      case"maple":drMaple(ctx,p,color);break;',
    '      case"petal":drPetal(ctx,p,color);break;',
    '      case"sakura":drSaku(ctx,p,color);break;',
    '      case"heart":drHeart(ctx,p,color);break;',
    '      case"confetti":drConf(ctx,p);break;',
    '      case"fire":drFire(ctx,p,color);break;',
    '      case"line":drLine(ctx,p,color);break;',
    '      case"colorstar":drStar(ctx,p,"colorstar");break;',
    '      case"aurora":drAuro(ctx,p);break;',
    '    }',
    '  }',
    '  animId=requestAnimationFrame(frame);',
    '}',
    'function restart(nm){',
    '  if(animId){cancelAnimationFrame(animId);animId=null}',
    '  mode=nm||mode;cfg=MODES[mode]||MODES.snow;',
    '  shape=mode==="snow"?"snowflake":cfg.shape;color=cfg.color;',
    '  particles=[];',
    '  for(var i=0;i<COUNT;i++)particles.push(mkParticle());',
    '  lastTime=0;animId=requestAnimationFrame(frame);',
    '}',
    'self.onmessage=function(e){',
    '  var d=e.data;',
    '  if(d.type==="init"){',
    '    canvas=d.canvas;ctx=canvas.getContext("2d");w=canvas.width;h=canvas.height;',
    '    restart(mode);',
    '  }else if(d.type==="switch"){',
    '    restart(d.mode);',
    '  }else if(d.type==="resize"){',
    '    w=d.w;h=d.h;canvas.width=w;canvas.height=h;',
    '    restart(mode);',
    '  }else if(d.type==="stop"){',
    '    if(animId){cancelAnimationFrame(animId);animId=null}',
    '    particles=[];ctx=null;canvas=null;',
    '  }',
    '}',
  ].join('\n');
  return new Blob([code], { type: 'application/javascript' });
}

var _effectModes = {
  snow: { label: '❄️ 下雪', color: '255,255,255', sizeRange: [2, 6], speedRange: [0.4, 1.6], windRange: [-0.3, 0.8], opacityRange: [0.4, 0.9], gravity: 1, shape: 'circle' },
  sakura: { label: '🌸 樱花', color: '255,182,193', sizeRange: [3, 7], speedRange: [0.3, 1.2], windRange: [-0.6, 0.6], opacityRange: [0.5, 0.9], gravity: 0.8, shape: 'sakura' },
  heart: { label: '💖 爱心', color: '255,105,180', sizeRange: [4, 9], speedRange: [0.3, 1.2], windRange: [-0.5, 0.5], opacityRange: [0.5, 0.9], gravity: 0.5, shape: 'heart' },
  confetti: { label: '🎉 彩纸', color: '', sizeRange: [2, 5], speedRange: [0.5, 1.5], windRange: [-0.8, 0.8], opacityRange: [0.6, 1.0], gravity: 1.1, shape: 'confetti' },
  fire: { label: '🔥 火花', color: '255,150,50', sizeRange: [2, 5], speedRange: [0.5, 2.0], windRange: [-0.2, 0.2], opacityRange: [0.6, 1.0], gravity: -0.5, shape: 'fire' },
  rain: { label: '🌧️ 下雨', color: '180,200,255', sizeRange: [1, 2], speedRange: [3, 6], windRange: [-0.3, 0.3], opacityRange: [0.3, 0.6], gravity: 3, shape: 'line' },
  leaf: { label: '🍁 枫叶', color: '220,80,60', sizeRange: [4, 9], speedRange: [0.2, 1.0], windRange: [-0.7, 0.7], opacityRange: [0.5, 0.9], gravity: 0.6, shape: 'maple' },
  colorstar: { label: '⭐ 星星', color: '255,215,0', sizeRange: [3, 7], speedRange: [0.3, 1.0], windRange: [-0.4, 0.4], opacityRange: [0.5, 1.0], gravity: 0.6, shape: 'colorstar' },
  petal: { label: '🌹 花瓣', color: '220,30,30', sizeRange: [3, 7], speedRange: [0.3, 1.2], windRange: [-0.5, 0.5], opacityRange: [0.5, 0.9], gravity: 0.7, shape: 'petal' },

  aurora: { label: '🌌 极光', color: '100,200,255', sizeRange: [8, 16], speedRange: [0.1, 0.3], windRange: [-0.2, 0.2], opacityRange: [0.1, 0.4], gravity: 0, shape: 'aurora' },
};

function _erand(min, max) { return min + Math.random() * (max - min); }

function _ecreateParticle(w, h, m) {
  var cfg = _effectModes[m];
  var sz = _erand(cfg.sizeRange[0], cfg.sizeRange[1]);
  return { x: Math.random() * w, y: m === 'fire' ? h + Math.random() * h * 0.2 : -sz - Math.random() * h * 0.4, r: sz, speed: _erand(cfg.speedRange[0], cfg.speedRange[1]), wind: _erand(cfg.windRange[0], cfg.windRange[1]), opacity: _erand(cfg.opacityRange[0], cfg.opacityRange[1]), gravity: cfg.gravity, rot: Math.random() * Math.PI * 2, rotSpeed: _erand(-0.03, 0.03), phase: Math.random() * Math.PI * 2 };
}

function _edrawOval(g, p, c) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, 0.4); g.beginPath(); g.arc(0, 0, p.r, 0, Math.PI * 2); g.fillStyle = 'rgba(' + c + ',' + p.opacity + ')'; g.fill(); g.restore(); }
function _edrawHeart(g, p, c) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(p.r * 0.06, p.r * 0.06); g.beginPath(); g.moveTo(0, -3); g.bezierCurveTo(-5, -8, -12, -3, 0, 5); g.bezierCurveTo(12, -3, 5, -8, 0, -3); g.fillStyle = 'rgba(' + c + ',' + p.opacity + ')'; g.fill(); g.restore(); }
function _edrawConfetti(g, p) { var cs = ['255,100,100','100,200,100','100,150,255','255,200,50','200,100,255','255,150,50']; var cc = cs[Math.floor(Math.abs(p.x + p.y + p.rot) % cs.length)]; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = 'rgba(' + cc + ',' + p.opacity + ')'; g.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); g.restore(); }
function _edrawSnowflake(g, p, c) { var r = p.r; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.strokeStyle = 'rgba(' + c + ',' + p.opacity + ')'; g.lineWidth = Math.max(2, r * 0.3); g.stroke(); var bx = Math.cos(a) * r * 0.5, by = Math.sin(a) * r * 0.5; for (var s = -1; s <= 1; s += 2) { var sa = a + s * Math.PI / 6; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(sa) * r * 0.4, by + Math.sin(sa) * r * 0.4); g.strokeStyle = 'rgba(' + c + ',' + (p.opacity * 0.7) + ')'; g.lineWidth = Math.max(1.5, r * 0.2); g.stroke(); } } g.restore(); }
function _edrawStar(g, p, c) { var r = p.r; var cs = ['255,215,0','255,100,100','100,200,255','255,200,50','200,100,255','100,255,100']; var cc = cs[Math.floor(Math.abs(p.x + p.y + p.rot) % cs.length)]; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); for (var i = 0; i < 5; i++) { var a = (i * 4 * Math.PI / 5) - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = 'rgba(' + cc + ',' + p.opacity + ')'; g.fill(); g.restore(); }
function _edrawMaple(g, p, c) { var r = p.r * 0.8; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, 0.7); g.beginPath(); for (var i = 0; i < 5; i++) { var a = (i * 2 * Math.PI / 5) - Math.PI / 2; g.lineTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); var a2 = a + Math.PI / 5; g.lineTo(Math.cos(a2) * r * 0.5, Math.sin(a2) * r * 0.5); } g.closePath(); g.fillStyle = 'rgba(' + c + ',' + p.opacity + ')'; g.fill(); g.restore(); }
function _edrawSakura(g, p, c) { var r = p.r * 0.6; g.save(); g.translate(p.x, p.y); for (var i = 0; i < 5; i++) { var a = (i * 2 * Math.PI / 5) - Math.PI / 2; g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(r * 0.4, -r * 0.15, r * 0.7, -r * 0.35); g.quadraticCurveTo(r * 0.85, -r * 0.2, r, 0); g.quadraticCurveTo(r * 0.85, r * 0.2, r * 0.7, r * 0.35); g.quadraticCurveTo(r * 0.4, r * 0.15, 0, 0); g.closePath(); g.fillStyle = 'rgba(' + c + ',' + p.opacity + ')'; g.fill(); g.beginPath(); g.moveTo(r * 0.65, 0); g.lineTo(r, 0); g.strokeStyle = 'rgba(255,255,255,' + (p.opacity * 0.15) + ')'; g.lineWidth = 0.5; g.stroke(); g.restore(); } g.beginPath(); g.arc(0, 0, r * 0.12, 0, Math.PI * 2); g.fillStyle = 'rgba(255,220,220,' + p.opacity + ')'; g.fill(); g.restore(); }
function _edrawRosePetal(g, p, c) { var r = p.r * 0.75; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); g.moveTo(0, -r); g.bezierCurveTo(r * 0.8, -r * 0.6, r * 0.85, r * 0.1, r * 0.4, r * 0.85); g.bezierCurveTo(r * 0.2, r, 0, r * 0.9, 0, r * 0.75); g.bezierCurveTo(0, r * 0.9, -r * 0.2, r, -r * 0.4, r * 0.85); g.bezierCurveTo(-r * 0.85, r * 0.1, -r * 0.8, -r * 0.6, 0, -r); g.closePath(); var grd = g.createRadialGradient(0, r * 0.2, 0, 0, r * 0.2, r * 1.2); grd.addColorStop(0, 'rgba(255,200,200,' + p.opacity + ')'); grd.addColorStop(0.3, 'rgba(240,30,30,' + p.opacity + ')'); grd.addColorStop(0.7, 'rgba(200,10,10,' + p.opacity + ')'); grd.addColorStop(1, 'rgba(120,0,0,' + (p.opacity * 0.8) + ')'); g.fillStyle = grd; g.fill(); g.beginPath(); g.moveTo(0, -r * 0.3); g.quadraticCurveTo(r * 0.15, r * 0.1, 0, r * 0.5); g.quadraticCurveTo(-r * 0.15, r * 0.1, 0, -r * 0.3); g.fillStyle = 'rgba(255,220,220,' + (p.opacity * 0.2) + ')'; g.fill(); g.restore(); }
function _edrawAurora(g, p) { var w = window.innerWidth; var x = p.x % w; if (x < 0) x += w; var h = window.innerHeight; g.save(); g.globalAlpha = p.opacity * 0.3; var grd = g.createRadialGradient(x, p.y, 0, x, p.y, p.r * 3); var cs = ['100,200,255','150,255,100','255,100,200','100,255,200','200,100,255']; var cc = cs[Math.floor(Math.abs(p.x * 0.01 + p.y * 0.01) % cs.length)]; grd.addColorStop(0, 'rgba(' + cc + ',1)'); grd.addColorStop(0.5, 'rgba(' + cc + ',0.3)'); grd.addColorStop(1, 'rgba(' + cc + ',0)'); g.fillStyle = grd; g.fillRect(x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6); g.restore(); }
function _edrawFire(g, p, c) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); g.moveTo(0, -p.r); g.bezierCurveTo(p.r, -p.r * 0.3, p.r * 0.6, p.r * 0.5, 0, p.r); g.bezierCurveTo(-p.r * 0.6, p.r * 0.5, -p.r, -p.r * 0.3, 0, -p.r); g.fillStyle = 'rgba(' + c + ',' + p.opacity + ')'; g.fill(); g.beginPath(); g.arc(0, -p.r * 0.2, p.r * 0.4, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,200,' + (p.opacity * 0.6) + ')'; g.fill(); g.restore(); }
function _edrawLine(g, p, c) { g.beginPath(); g.moveTo(p.x, p.y - p.r); g.lineTo(p.x, p.y + p.r); g.strokeStyle = 'rgba(' + c + ',' + p.opacity + ')'; g.lineWidth = 1.5; g.stroke(); }

function startEffect(mode) {
  var newMode = mode || _effectMode;
  if (!_effectModes[newMode]) newMode = 'snow';

  // 已有 Worker 且同模式 → 跳过
  if (_effectWorker && _effectMode === newMode) return;
  _effectMode = newMode;

  // 创建 canvas（首次）
  if (!_effectCanvas) {
    var c = document.createElement('canvas');
    c.id = 'zhs-effect-canvas';
    c.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;transform:translateZ(0);will-change:transform;contain:strict;';
    document.body.appendChild(c);
    _effectCanvas = c;
  }
  _effectCanvas.style.display = 'block';

  // 已有 Worker → 发送切换指令（走 postMessage，不碰 canvas）
  if (_effectWorker) {
    _effectWorker.postMessage({ type: 'switch', mode: newMode });
    return;
  }

  // 创建 canvas + Worker（首次）
  var w = window.innerWidth, h = window.innerHeight;
  _effectCanvas.width = w; _effectCanvas.height = h;

  try {
    var offscreen = _effectCanvas.transferControlToOffscreen();
    var blob = _eBuildWorker();
    var url = URL.createObjectURL(blob);
    _effectWorker = new Worker(url);
    URL.revokeObjectURL(url);
    _effectWorker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);
    _effectWorker.postMessage({ type: 'switch', mode: newMode });
  } catch (e) {
    console.warn('[xiaotoolkit] OffscreenCanvas 不可用，回退主线程渲染:', e);
    _effectWorker = null;
    _effectFallbackRender(newMode);
  }
}

// 回退方案：主线程渲染（delta-time）
var _effectAnimId = null;
var _effectParticles = [];
function _effectFallbackRender(mode) {
  if (_effectAnimId) { cancelAnimationFrame(_effectAnimId); _effectAnimId = null; }
  var cfg = _effectModes[mode] || _effectModes.snow;
  var c = _effectCanvas;
  var w = window.innerWidth, h = window.innerHeight;
  c.width = w; c.height = h;
  var g = c.getContext('2d');
  var shape = mode === 'snow' ? 'snowflake' : cfg.shape;
  var color = cfg.color;
  _effectParticles = [];
  for (var i = 0; i < _effectCount; i++) _effectParticles.push(_ecreateParticle(w, h, mode));
  var lastTime = performance.now();
  function draw(now) {
    var dt = Math.min((now || performance.now()) - lastTime, 50);
    lastTime = now || performance.now();
    var f = dt / 16.667;
    g.clearRect(0, 0, w, h);
    for (var i = 0; i < _effectParticles.length; i++) {
      var p = _effectParticles[i];
      p.y += (p.speed * p.gravity + 0.2) * f; p.x += (p.wind + Math.sin(p.phase) * 0.2) * f; p.rot += p.rotSpeed * f; p.phase += 0.01 * f;
      if (p.y > h + p.r * 2 || (mode === 'fire' && p.y < -p.r * 2)) { _effectParticles[i] = _ecreateParticle(w, h, mode); continue; }
      if (p.x > w + p.r) p.x = -p.r; if (p.x < -p.r) p.x = w + p.r;
      switch (shape) {
        case 'snowflake': _edrawSnowflake(g, p, color); break;
        case 'circle': g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fillStyle = 'rgba(' + color + ',' + p.opacity + ')'; g.fill(); break;
        case 'maple': _edrawMaple(g, p, color); break;
        case 'petal': _edrawRosePetal(g, p, color); break;
        case 'sakura': _edrawSakura(g, p, color); break;
        case 'heart': _edrawHeart(g, p, color); break;
        case 'confetti': _edrawConfetti(g, p); break;
        case 'fire': _edrawFire(g, p, color); break;
        case 'line': _edrawLine(g, p, color); break;
        case 'colorstar': _edrawStar(g, p, 'colorstar'); break;
        case 'aurora': _edrawAurora(g, p); break;
      }
    }
    _effectAnimId = requestAnimationFrame(draw);
  }
  draw(performance.now());
}

function stopEffect() {
  if (_effectWorker) {
    _effectWorker.postMessage({ type: 'stop' });
    _effectWorker.terminate();
    _effectWorker = null;
  }
  if (_effectAnimId) { cancelAnimationFrame(_effectAnimId); _effectAnimId = null; }
  if (_effectCanvas) {
    _effectCanvas.remove();
    _effectCanvas = null;
  }
  _effectParticles = [];
}

// ================== 6. 顶部插件快捷按钮 ==================

var pbBtn = null;
var pbStyle = null;
var pbCheckLoop = null;

function startPluginBtn() {
  if (pbCheckLoop) return;
  if (!document.getElementById('zhs-pb-style')) {
    var s = document.createElement('style');
    s.id = 'zhs-pb-style';
    s.textContent = [
      '.zhs-plugin-btn {',
      '  width: 34px; height: 34px;',
      '  display: flex; align-items: center; justify-content: center;',
      '  border-radius: 50%;',
      '  transition: all 0.2s;',
      '  background: transparent; border: none;',
      '  color: var(--color-text-main); opacity: 0.6;',
      '  cursor: pointer; flex-shrink: 0;',
      '  margin-left: 2px;',
      '}',
      '.zhs-plugin-btn:hover {',
      '  opacity: 1;',
      '  background-color: var(--control-hover-bg);',
      '}',
      '.zhs-plugin-btn svg {',
      '  width: 18px; height: 18px;',
      '}',
    ].join('\n');
    document.head.appendChild(s);
    pbStyle = s;
  }
  pbCheckLoop = setInterval(function() {
    var nav = document.querySelector('.titlebar-nav');
    if (!nav) return;
    var searchBox = nav.querySelector('.tb-search');
    if (!searchBox) return;
    if (document.getElementById('zhs-pb-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'zhs-pb-btn';
    btn.className = 'zhs-plugin-btn nav-btn';
    btn.title = '插件管理';
    btn.innerHTML = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"',
      '  stroke-linecap="round" stroke-linejoin="round">',
      '  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
      '</svg>',
    ].join('');
    btn.addEventListener('click', function() {
      if (ctx && ctx.router) {
        ctx.router.push('/main/settings/plugins');
      }
    });
    searchBox.parentNode.insertBefore(btn, searchBox.nextSibling);
    pbBtn = btn;
    clearInterval(pbCheckLoop);
    pbCheckLoop = null;
  }, 800);
}

function stopPluginBtn() {
  if (pbCheckLoop) {
    clearInterval(pbCheckLoop);
    pbCheckLoop = null;
  }
  if (pbBtn) {
    pbBtn.remove();
    pbBtn = null;
  }
  if (pbStyle) {
    pbStyle.remove();
    pbStyle = null;
  }
  var s = document.getElementById('zhs-pb-style');
  if (s) s.remove();
}

// ===================== 1. 热门排序 =====================

var _asTimer = null;
var _asLoop = null;
var _asDoneUrl = '';

function startArtistSort() {
  if (_asLoop) return;
  
  _asTimer = setTimeout(function() {
    _asTimer = null;
    
    _asLoop = setInterval(function() {
      try {
        var container = document.querySelector('.artist-detail-container');
        if (!container) {
          _asDoneUrl = '';
          return;
        }
        
        var currentUrl = window.location.pathname;
        
        if (_asDoneUrl === currentUrl) return;
        
        var trigger = container.querySelector('.artist-sort-trigger');
        if (!trigger) return;
        
        var triggerText = trigger.textContent || '';
        var isHot = triggerText.indexOf('热门') !== -1;
        
        if (isHot) {
          _asDoneUrl = currentUrl;
          return;
        }
        
        trigger.click();
        
        _asDoneUrl = currentUrl;
        
        setTimeout(function() {
          try {
            var menuItems = document.querySelectorAll('.artist-sort-menu-item');
            for (var i = 0; i < menuItems.length; i++) {
              var item = menuItems[i];
              if ((item.textContent || '').trim().indexOf('热门') !== -1) {
                item.click();
                console.log('[zhs] 已切换排序为热门');
                break;
              }
            }
          } catch(e) { /* silent */ }
        }, 80);
        
      } catch(e) { /* silent */ }
    }, 1200);
    
  }, 3000);
}

function stopArtistSort() {
  if (_asTimer) { clearTimeout(_asTimer); _asTimer = null; }
  if (_asLoop) { clearInterval(_asLoop); _asLoop = null; }
  _asDoneUrl = '';
}

// ================ 3. 单击任意位置播放 ================
// 单击歌曲列表的任意位置（歌名、歌手等）即可播放
// 不影响已有按钮操作（播放图标、菜单等）

var _clickDispose = null;

function skipClick(el) {
  if (!el) return true;
  if (el.closest('button, a, [role="menuitem"]')) return true;
  if (el.closest('.context-menu, .song-context-menu, .song-list-meta-link')) return true;
  if (el.matches('.cursor-pointer') || el.closest('.cursor-pointer')) return true;
  return false;
}

function startClickToPlay() {
  if (_clickDispose) return;
  function onRowClick(e) {
    var row = e.target.closest('[data-song-row]');
    if (!row) return;
    if (skipClick(e.target)) return;
    var firstCol = row.querySelector('.song-list-row-inner > div:first-child');
    if (!firstCol) return;
    var playBtn = firstCol.querySelector('.cursor-pointer');
    if (!playBtn) return;
    playBtn.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true,
      clientX: e.clientX, clientY: e.clientY,
    }));
  }
  document.addEventListener('click', onRowClick, true);
  _clickDispose = function() { document.removeEventListener('click', onRowClick, true); };
}

function stopClickToPlay() {
  if (_clickDispose) { _clickDispose(); _clickDispose = null; }
}

// ================ 4. 首页卡片一键播放 ================
// （已移至自用插件 ziyong）
// 此功能已迁移到自用插件中，xiaotoolkit 不再包含

// ================ 5. 歌词界面完全沉浸 ================

var lhStyle = null;
var lhLoop = null;
var lhTimer = null;
var lhMoveTarget = null;

function lhInjectCSS() {
  if (document.getElementById('zhs-lh-style')) return;
  var s = document.createElement('style');
  s.id = 'zhs-lh-style';
  s.textContent = [
    // 7 个按钮统一隐藏类
    '.zhs-lh-hidden {',
    '  visibility: hidden !important;',
    '  opacity: 0 !important;',
    '  transition: visibility 0s 2s, opacity 0.5s ease !important;',
    '}',
    // 底部控制栏独立过渡
    '.lyric-page-body .lyric-bar {',
    '  transition: visibility 0s 0.5s, opacity 0.5s ease !important;',
    '}',
    '.lyric-page-body.idle .lyric-bar {',
    '  visibility: hidden !important;',
    '  opacity: 0 !important;',
    '  transition: visibility 0s 2s, opacity 0.5s ease !important;',
    '}',
  ].join('\n');
  document.head.appendChild(s);
  lhStyle = s;
}

function lhRemoveCSS() {
  if (lhStyle) { lhStyle.remove(); lhStyle = null; }
}

function lhReset() {
  var body = document.querySelector('.lyric-page-body');
  if (!body) return;
  body.classList.remove('idle');
  document.querySelectorAll('.lyric-page-toolbar, .overlay-header, .lyric-page-tools').forEach(function(el) {
    el.classList.remove('zhs-lh-hidden');
  });
  clearTimeout(lhTimer);
  lhTimer = setTimeout(function() {
    body.classList.add('idle');
    document.querySelectorAll('.lyric-page-toolbar, .overlay-header, .lyric-page-tools').forEach(function(el) {
      el.classList.add('zhs-lh-hidden');
    });
  }, 2000);
}

function lhOnMove() { lhReset(); }

function lhCleanup() {
  clearTimeout(lhTimer);
  lhTimer = null;
  if (lhMoveTarget) {
    lhMoveTarget.removeEventListener('mousemove', lhOnMove);
    lhMoveTarget = null;
  }
  var body = document.querySelector('.lyric-page-body');
  if (body) body.classList.remove('idle');
  document.querySelectorAll('.lyric-page-toolbar, .overlay-header, .lyric-page-tools').forEach(function(el) {
    el.classList.remove('zhs-lh-hidden');
  });
}

function startLyricHide() {
  if (lhLoop) return;
  lhInjectCSS();
  lhLoop = setInterval(function() {
    var body = document.querySelector('.lyric-page-body');
    if (!body) { lhCleanup(); return; }
    if (body !== lhMoveTarget) {
      if (lhMoveTarget) lhMoveTarget.removeEventListener('mousemove', lhOnMove);
      lhMoveTarget = body;
      body.addEventListener('mousemove', lhOnMove, { passive: true });
      lhReset();
    }
  }, 800);
}

function stopLyricHide() {
  if (lhLoop) { clearInterval(lhLoop); lhLoop = null; }
  lhRemoveCSS();
  lhCleanup();
}
// ================== 7. 歌词对齐切换 ==================

var laStyle = null;
var laTimer = null;

function laGetCSS(align, spacing, padding) {
  var rowJustify = align === 'center' ? 'center' : (align === 'left' ? 'flex-start' : 'flex-end');
  padding = padding || 180;
  var rules = [
    '.lyric-scroller .lyric-row { justify-content: ' + rowJustify + ' !important; position: relative; }',
    '.lyric-scroller .lyric-line { text-align: ' + align + ' !important; }',
    align === 'left' ? '.lyric-scroller { padding-left: ' + padding + 'px !important; }' : (align === 'right' ? '.lyric-scroller { padding-right: ' + padding + 'px !important; }' : undefined),
    '.lyric-mode .song-header { text-align: ' + align + ' !important; }',
    '.static-lyric-list { text-align: ' + align + ' !important; }',
    '.static-lyric-row { text-align: ' + align + ' !important; }',
    align === 'left' ? '.cover-mode .lyric-side { padding-left: 108px !important; }' : undefined,
  ];
  // 当前演唱行前加引导圆点
  if (align === 'left') {
    rules.push('.lyric-scroller .lyric-line[data-echo-lyric-current=\"true\"]::before { content: \"\"; position: absolute; left: -34px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; border-radius: 50%; background: var(--color-primary); opacity: 0.8; pointer-events: none; }');
  } else if (align === 'right') {
    rules.push('.lyric-scroller .lyric-line[data-echo-lyric-current=\"true\"]::before { content: \"\"; position: absolute; right: -34px; left: auto; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; border-radius: 50%; background: var(--color-primary); opacity: 0.8; pointer-events: none; }');
  }
  // 行距（0 = 不覆盖，使用默认）
  if (spacing !== undefined && spacing !== 0) {
    rules.push('.lyric-scroller .lyric-row:not(:last-child) { margin-bottom: ' + spacing + 'px !important; }');
  }
  return rules.filter(function(s) { return s; }).join('\n');
}

function laApply(align, spacing) {
  laRemove();
  var padding = 180;
  var s = document.createElement('style');
  s.id = 'zhs-la-style';
  s.textContent = laGetCSS(align, spacing, padding);
  document.head.appendChild(s);
  laStyle = s;
}

function laRemove() {
  if (laStyle) { laStyle.remove(); laStyle = null; }
}

function startLyricAlign(align) {
  align = align || 'center';
  var spacing = featureState.lyricSpacing || 0;
  if (laTimer) return;
  laTimer = setInterval(function() {
    var scroller = document.querySelector('.lyric-scroller');
    if (scroller) {
      laApply(align, spacing);
    }
  }, 500);
}

function stopLyricAlign() {
  if (laTimer) { clearInterval(laTimer); laTimer = null; }
  laRemove();
}

// ================== 9. 歌单自适应布局 ==================

var dcTimer = null;
var dcLastWidth = 0;
var dcCSS_ID = 'zhs-dc-style';
var DC_MIN_WIDTH = 320;

function dcGetCols(w) {
  if (w <= 0) return 1;
  var c = Math.floor(w / DC_MIN_WIDTH);
  return Math.max(2, Math.min(6, c));
}

function dcInjectCSS(cols) {
  var el = document.getElementById(dcCSS_ID);
  if (el) el.remove();

  var pct = (100 / cols).toFixed(4) + '%';

  var css = [
    '.song-list-inner {',
    '  height: auto !important;',
    '  min-height: 100% !important;',
    '}',
    '.will-change-transform {',
    '  display: flex !important;',
    '  flex-wrap: wrap !important;',
    '  align-content: flex-start !important;',
    '}',
    '.song-list-row {',
    '  flex: 0 0 ' + pct + ' !important;',
    '  max-width: ' + pct + ' !important;',
    '  box-sizing: border-box !important;',
    '  padding: 0 8px !important;',
    '  margin: 0 !important;',
    '}',
    '.song-list-row-inner {',
    '  grid-template-columns: 40px minmax(0, 1fr) !important;',
    '}',
    '.song-list-sticky .h-11.grid { display: none !important; }',
    'button[title="详情及评论"] { display: none !important; }',
    '.song-list-row-inner > .song-list-meta-link,',
    '.song-list-row-inner > button,',
    '.song-list-row-inner > .pl-2.text-\\[12px\\].opacity-60 { display: none !important; }',
    '.song-card { flex: 1 !important; min-width: 0 !important; }',
    '.song-content { flex: 1 !important; min-width: 0 !important; }',
    '.song-actions {',
    '  margin-left: auto !important; display: flex !important;',
    '  align-items: center !important; gap: 4px !important;',
    '  flex-shrink: 0 !important; padding-left: 8px !important;',
    '}',
    'button[title="播放 MV"] { order: 1 !important; }',
    '.song-action-favorite { order: 2 !important; }',
    'button[title="播放 MV"] {',
    '  opacity: 0 !important; visibility: hidden !important;',
    '  transition: opacity 0.15s, visibility 0.15s !important;',
    '}',
    '.song-list-row:hover button[title="播放 MV"] {',
    '  opacity: 1 !important; visibility: visible !important;',
    '}',
    '.song-action-favorite, .song-action-favorite.is-active { opacity: 1 !important; }',
    '.song-title-row { flex-wrap: nowrap !important; overflow: hidden !important; gap: 4px !important; }',
    '.song-name, .song-title { white-space: nowrap !important; overflow: visible !important; text-overflow: clip !important; flex-shrink: 0 !important; }',
    '.song-tag { flex-shrink: 0 !important; }',
  ].join('\n');

  var style = document.createElement('style');
  style.id = dcCSS_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

function dcInitSS() {
  if (!window.__ss || typeof window.__ss !== 'object') {
    window.__ss = { value: 0.1 };
  } else if (window.__ss.value !== 0.1) {
    window.__ss.value = 0.1;
  }
}

function dcUpdateLayout(w) {
  var cols = dcGetCols(w);
  dcInjectCSS(cols);
  dcInitSS();
}

function dcPollLayout() {
  var container = document.querySelector('.song-list-container');
  if (!container) return;
  var w = container.clientWidth;
  if (w > 0 && w !== dcLastWidth) {
    dcLastWidth = w;
    dcUpdateLayout(w);
  }
}

function startPlaylistLayout() {
  if (dcTimer) return;
  dcTimer = setInterval(dcPollLayout, 300);
  // 立即执行一次
  dcPollLayout();
}

function stopPlaylistLayout() {
  if (dcTimer) { clearInterval(dcTimer); dcTimer = null; }
  dcLastWidth = 0;
  var el = document.getElementById(dcCSS_ID);
  if (el) el.remove();
  if (window.__ss && typeof window.__ss === 'object' && 'value' in window.__ss) {
    window.__ss.value = 60;
  }
}

// ================== 10. 搜索历史 ==================

var _shInputSelectors = ['.search-input', '.tb-search-input'];
var _shOverlayWidth = 280;
var _shOverlays = {};
var _shInputs = {};
var _shHandlers = {};
var _shRepositionHandlers = {};
var _shHideTimers = {};
var _shPollTimer = null;
var _shBodyObserver = null;

function _shCancelHide(id) {
  if (id != null && _shHideTimers[id]) { clearTimeout(_shHideTimers[id]); delete _shHideTimers[id]; }
}
function _shCancelAllHide() { for (var k in _shHideTimers) _shCancelHide(k); }
function _shScheduleHide(id, delay) {
  _shCancelHide(id);
  _shHideTimers[id] = setTimeout(function(){ _shHideDropdown(id); delete _shHideTimers[id]; }, delay);
}
function _shInputAlive(id) { return _shInputs[id] && _shInputs[id].isConnected; }

function _shMakeOverlay(history) {
  var o = document.createElement('div');
  o.className = 'search-history-overlay';
  o.style.cssText = 'z-index:999999;box-sizing:border-box;background:color-mix(in srgb,var(--bg-main,#f0f0f0)75%,transparent);border:1px solid var(--border-subtle,rgba(128,128,128,0.15));border-radius:14px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);padding:6px 8px;font-size:14px;color:var(--color-text-main,#333);pointer-events:auto;box-shadow:0 4px 24px rgba(0,0,0,0.1);';
  o.addEventListener('mouseenter', function(){
    for (var k in _shOverlays) { if (_shOverlays[k] === o) { _shCancelHide(k); break; } }
  });
  o.addEventListener('mouseleave', function(){
    for (var k in _shOverlays) { if (_shOverlays[k] === o) { _shScheduleHide(k, 300); break; } }
  });
  o.addEventListener('pointerdown', function(e){ e.preventDefault(); });

  var h = document.createElement('div');
  h.style.cssText = 'padding:0 0 4px 0;font-size:12px;opacity:0.5;font-weight:600;display:flex;align-items:center;pointer-events:auto;';
  var hLabel = document.createElement('span');
  hLabel.textContent = '历史搜索';
  var hClear = document.createElement('span');
  hClear.textContent = '清空';
  hClear.style.cssText = 'margin-left:auto;cursor:pointer;opacity:0.6;font-weight:400;font-size:11px;padding:2px 6px;border-radius:4px;';
  hClear.addEventListener('mouseenter', function(){ hClear.style.opacity='1'; hClear.style.background='var(--surface-elevated,color-mix(in srgb,var(--color-text-main)10%,transparent))'; });
  hClear.addEventListener('mouseleave', function(){ hClear.style.opacity='0.6'; hClear.style.background=''; });
  hClear.addEventListener('click', function(e){
    e.stopPropagation();
    if (ctx && ctx.stores && ctx.stores.settings) { ctx.stores.settings.clearSearchHistory(); _shHideAll(); }
  });
  h.appendChild(hLabel); h.appendChild(hClear); o.appendChild(h);

  var maxItems = Math.min(history.length, 9);
  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:5px;pointer-events:auto;';
  for (var i = 0; i < maxItems; i++) {
    var kw = history[i];
    var chip = document.createElement('span');
    chip.style.cssText = 'display:inline-flex;align-items:center;position:relative;padding:3px 8px;border-radius:14px;cursor:pointer;font-size:12px;line-height:1.5;color:color-mix(in srgb,var(--color-primary,#07c) 80%,var(--color-text-main,#333) 20%);background:color-mix(in srgb,var(--color-text-main)8%,transparent);transition:background 0.12s;user-select:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;';
    chip.innerHTML = '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">' + kw.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span><span class="__del" style="flex-shrink:0;margin-left:4px;display:none;width:14px;height:14px;line-height:14px;text-align:center;border-radius:50%;font-size:11px;cursor:pointer;opacity:0.6" title="删除">×</span>';
    var delBtn = chip.querySelector('.__del');
    chip.addEventListener('mouseenter', function(){ chip.style.background='color-mix(in srgb,var(--color-text-main)14%,transparent)'; if(delBtn)delBtn.style.display='inline-block'; });
    chip.addEventListener('mouseleave', function(){ chip.style.background='color-mix(in srgb,var(--color-text-main)8%,transparent)'; if(delBtn)delBtn.style.display='none'; });
    delBtn.addEventListener('click', function(e){
      e.stopPropagation();
      if (ctx && ctx.stores && ctx.stores.settings) {
        ctx.stores.settings.removeFromSearchHistory(kw);
        chip.remove();
        if (wrap.children.length === 0) { for (var k in _shOverlays) { if (_shOverlays[k] === o) { _shHideDropdown(k); break; } } }
      }
    });
    (function(keyword){
      chip.addEventListener('click', function(){
        var inputEl = null, inputId = null;
        for (var k in _shOverlays) { if (_shOverlays[k] && _shOverlays[k].isConnected) { inputEl = _shInputs[k]; inputId = k; break; } }
        if (!inputEl) return;
        _shHideAll();
        var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(inputEl, keyword);
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(function(){ inputEl.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true, cancelable:true })); }, 80);
      });
    })(kw);
    wrap.appendChild(chip);
  }
  o.appendChild(wrap);
  return o;
}

function _shMakeHandler(id) {
  if (_shHandlers[id]) return _shHandlers[id];
  _shHandlers[id] = {
    mouseenter: function(){
      _shCancelHide(id);
      _shInputs[id] = this;
      if (!this.value.trim()) { setTimeout(function(){ _shShowForInput(id, _shInputs[id]); }, 16); }
    },
    mouseleave: function(){ _shScheduleHide(id, 400); },
    focus: function(){ _shCancelHide(id); _shInputs[id] = this; },
    blur: function(){ _shScheduleHide(id, 250); },
    input: function(){
      _shInputs[id] = this;
      if (this.value.trim()) { _shHideDropdown(id); } else { _shShowForInput(id, this); }
    }
  };
  return _shHandlers[id];
}

function _shAttachToInput(id, el) {
  if (_shInputs[id] === el && _shInputAlive(id)) return;
  if (_shInputs[id] && _shInputs[id] !== el && _shHandlers[id]) {
    var h = _shHandlers[id];
    _shInputs[id].removeEventListener('mouseenter', h.mouseenter);
    _shInputs[id].removeEventListener('mouseleave', h.mouseleave);
    _shInputs[id].removeEventListener('focus', h.focus);
    _shInputs[id].removeEventListener('blur', h.blur);
    _shInputs[id].removeEventListener('input', h.input);
  }
  _shInputs[id] = el;
  var h = _shMakeHandler(id);
  el.addEventListener('mouseenter', h.mouseenter);
  el.addEventListener('mouseleave', h.mouseleave);
  el.addEventListener('focus', h.focus);
  el.addEventListener('blur', h.blur);
  el.addEventListener('input', h.input);
}

function _shShowForInput(id, inputEl) {
  if (!ctx || !ctx.stores || !ctx.stores.settings || !inputEl) return;
  if (_shOverlays[id] && _shOverlays[id].isConnected) return;
  var history = ctx.stores.settings.searchHistory || [];
  if (!history || history.length === 0) return;
  var isGlobal = id && id.indexOf('.tb-search-input') === 0;
  var parent = isGlobal ? (document.querySelector('.tb-search') || inputEl.offsetParent || document.body) : (inputEl.offsetParent || document.body);
  var overlay = _shMakeOverlay(history);
  overlay.style.position = 'absolute'; overlay.style.boxSizing = 'border-box';
  if (isGlobal) {
    var tbSearch = document.querySelector('.tb-search');
    if (tbSearch) {
      var inpRect = inputEl.getBoundingClientRect();
      var contRect = tbSearch.getBoundingClientRect();
      overlay.style.left = (inpRect.left - contRect.left) + 'px';
      overlay.style.top = (inpRect.bottom - contRect.top + 4) + 'px';
    } else { overlay.style.left = '0'; overlay.style.top = 'calc(100% + 6px)'; }
    overlay.style.width = Math.max(inputEl.offsetWidth, _shOverlayWidth) + 'px';
  } else {
    overlay.style.left = inputEl.offsetLeft + 'px';
    overlay.style.top = (inputEl.offsetTop + inputEl.offsetHeight + 4) + 'px';
    overlay.style.width = Math.max(inputEl.offsetWidth, _shOverlayWidth) + 'px';
  }
  parent.appendChild(overlay);
  _shOverlays[id] = overlay;
  var reposition = function(){
    if (!_shOverlays[id] || !_shOverlays[id].isConnected || !_shInputs[id] || !_shInputs[id].isConnected) return;
    try {
      if (isGlobal) {
        var tb2 = document.querySelector('.tb-search');
        if (tb2 && _shInputs[id]) {
          var ir = _shInputs[id].getBoundingClientRect();
          var cr = tb2.getBoundingClientRect();
          _shOverlays[id].style.left = (ir.left - cr.left) + 'px';
          _shOverlays[id].style.top = (ir.bottom - cr.top + 4) + 'px';
        }
        return;
      }
      var inp = _shInputs[id];
      var pr = inp.offsetParent || document.body;
      if (_shOverlays[id].parentElement !== pr) pr.appendChild(_shOverlays[id]);
      _shOverlays[id].style.left = inp.offsetLeft + 'px';
      _shOverlays[id].style.top = (inp.offsetTop + inp.offsetHeight + 4) + 'px';
      _shOverlays[id].style.width = Math.max(inp.offsetWidth, _shOverlayWidth) + 'px';
    } catch(e){}
  };
  _shRepositionHandlers[id] = reposition;
  window.addEventListener('scroll', reposition, { passive: true, capture: true });
  window.addEventListener('resize', reposition, { passive: true });
}

function _shHideDropdown(id) {
  _shCancelHide(id);
  if (_shOverlays[id]) {
    if (_shRepositionHandlers[id]) {
      window.removeEventListener('scroll', _shRepositionHandlers[id], true);
      window.removeEventListener('resize', _shRepositionHandlers[id]);
      delete _shRepositionHandlers[id];
    }
    try { _shOverlays[id].remove(); } catch(e) {}
    delete _shOverlays[id];
  }
}

function _shHideAll() { for (var k in _shOverlays) _shHideDropdown(k); }

function _shFindInputs() {
  for (var i = 0; i < _shInputSelectors.length; i++) {
    var sel = _shInputSelectors[i];
    var els = document.querySelectorAll(sel);
    for (var j = 0; j < els.length; j++) {
      var key = sel + '-' + j;
      if (!_shInputs[key] || !_shInputAlive(key)) _shAttachToInput(key, els[j]);
    }
  }
}

function startSearchHistory() {
  _shFindInputs();
  if (_shPollTimer) clearInterval(_shPollTimer);
  _shPollTimer = setInterval(_shFindInputs, 3000);
  if (_shBodyObserver) _shBodyObserver.disconnect();
  _shBodyObserver = new MutationObserver(function(){ _shFindInputs(); });
  _shBodyObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
}

function stopSearchHistory() {
  _shCancelAllHide();
  _shHideAll();
  if (_shPollTimer) { clearInterval(_shPollTimer); _shPollTimer = null; }
  if (_shBodyObserver) { _shBodyObserver.disconnect(); _shBodyObserver = null; }
  for (var k in _shHandlers) {
    if (_shInputs[k]) {
      _shInputs[k].removeEventListener('mouseenter', _shHandlers[k].mouseenter);
      _shInputs[k].removeEventListener('mouseleave', _shHandlers[k].mouseleave);
      _shInputs[k].removeEventListener('focus', _shHandlers[k].focus);
      _shInputs[k].removeEventListener('blur', _shHandlers[k].blur);
      _shInputs[k].removeEventListener('input', _shHandlers[k].input);
    }
  }
  _shInputs = {}; _shHandlers = {}; _shOverlays = {}; _shRepositionHandlers = {}; _shHideTimers = {};
}

var featureState = {};

async function loadFeatureState() {
  var saved = await ctx.storage.get('zhs-features');
  if (saved) {
    // 兼容旧版本，新功能默认启用
    if (saved.clickToPlay === undefined) saved.clickToPlay = true;
    if (saved.lyricAlign === undefined) saved.lyricAlign = 'center';
    if (saved.lyricSpacing === undefined) saved.lyricSpacing = 0;
    if (saved.duoColumn === undefined) saved.duoColumn = true;
    if (saved.searchHistory === undefined) saved.searchHistory = true;
    featureState = saved;
  } else {
    featureState = {
      artistSort: true,
      clickToPlay: true,
      lyricHide: true,
      pluginBtn: true,
      effect: false,
      effectMode: 'snow',
      lyricAlign: 'center',
      lyricSpacing: 0,
      duoColumn: true,
      searchHistory: true,
    };
  }
}

async function saveFeatureState() {
  await ctx.storage.set('zhs-features', featureState);
}

// ================== 入口 ==================

export async function activate(_ctx) {
  ctx = _ctx;

  await loadFeatureState();

  if (featureState.artistSort) startArtistSort();
  if (featureState.clickToPlay) startClickToPlay();
  if (featureState.lyricHide) startLyricHide();
  if (featureState.pluginBtn) startPluginBtn();
  if (featureState.duoColumn) startPlaylistLayout();
  if (featureState.searchHistory) startSearchHistory();
  if (featureState.effect) startEffect(featureState.effectMode || 'snow');
  startLyricAlign(featureState.lyricAlign || 'center');

  var h = ctx.vue.h;

  var SettingsComp = ctx.vue.defineComponent({
    name: 'ZhsSettings',
    setup: function() {
      var state = ctx.vue.reactive({
        features: [
          { id: 'artistSort', icon: '🔥', label: '歌手热门排序', desc: '歌手详情页默认按热门排序', enabled: featureState.artistSort },
          { id: 'clickToPlay', icon: '👆', label: '单击播放', desc: '单击歌曲任意位置即可播放', enabled: featureState.clickToPlay },
          { id: 'lyricHide', icon: '🙈', label: '歌词界面完全沉浸', desc: '控制栏和工具栏自动隐藏', enabled: featureState.lyricHide },
          { id: 'pluginBtn', icon: '🔧', label: '顶部插件管理入口', desc: '搜索框右侧添加插件快捷按钮', enabled: featureState.pluginBtn },
          { id: 'duoColumn', icon: '📐', label: '歌单自适应布局', desc: '歌单多列网格，自适应列数', enabled: featureState.duoColumn },
          { id: 'searchHistory', icon: '🕐', label: '搜索历史', desc: '搜索框显示历史搜索记录', enabled: featureState.searchHistory },
        ],
      });
      var currentEffectMode = ctx.vue.ref(featureState.effectMode || 'snow');
      var effectActive = ctx.vue.ref(!!featureState.effect);
      var currentAlign = ctx.vue.ref(featureState.lyricAlign || 'center');
      var currentSpacing = ctx.vue.ref(featureState.lyricSpacing || 0);

      ctx.vue.watch(function() {
        return state.features.map(function(f) { return f.enabled; });
      }, function() {
        state.features.forEach(function(f) { featureState[f.id] = f.enabled; });
        saveFeatureState();
        state.features.forEach(function(f) {
          if (f.id === 'artistSort') { f.enabled ? startArtistSort() : stopArtistSort(); }
          else if (f.id === 'clickToPlay') { f.enabled ? startClickToPlay() : stopClickToPlay(); }
          else if (f.id === 'lyricHide') { f.enabled ? startLyricHide() : stopLyricHide(); }
          else if (f.id === 'pluginBtn') { f.enabled ? startPluginBtn() : stopPluginBtn(); }
          else if (f.id === 'duoColumn') { f.enabled ? startPlaylistLayout() : stopPlaylistLayout(); }
          else if (f.id === 'searchHistory') { f.enabled ? startSearchHistory() : stopSearchHistory(); }
        });
      }, { deep: true });

      var effectHotkeys = [
        { mode: 'snow', icon: '❄️' },
        { mode: 'sakura', icon: '🌸' },
        { mode: 'heart', icon: '💖' },
        { mode: 'confetti', icon: '🎉' },
        { mode: 'fire', icon: '🔥' },
        { mode: 'rain', icon: '🌧️' },
        { mode: 'leaf', icon: '🍁' },
        { mode: 'colorstar', icon: '⭐' },
        { mode: 'petal', icon: '🌺' },
        { mode: 'aurora', icon: '🌌' },
      ];

      function toggleRow(icon, label, desc, isOn, onClick) {
        return h('div', {
          style: {
            display: 'flex', 'flex-direction': 'column', gap: '2px', cursor: 'pointer',
            padding: '8px', 'border-radius': '8px',
            background: 'var(--card-bg, rgba(255,255,255,0.04))',
            border: 'none',
            transition: 'all 0.15s',
          },
          onClick: onClick,
        }, [
          h('div', { style: { display: 'flex', 'align-items': 'center', gap: '6px' } }, [
            h('span', { style: { 'font-size': '14px', 'flex-shrink': '0', opacity: isOn ? '1' : '0.4' } }, icon),
            h('span', { style: { 'font-size': '13px', 'font-weight': '600', color: isOn ? 'var(--color-primary, #4caf50)' : 'var(--color-text-main)' } }, label),
          ]),
          h('span', { style: { 'font-size': '11px', color: 'var(--color-text-secondary)', 'line-height': '1.3', 'padding-left': '20px' } }, desc),
        ]);
      }

      return function() {
        return h('div', { style: { display: 'flex', 'flex-direction': 'column', gap: '6px' } }, [
          h('div', { style: { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '6px' } },
            state.features.map(function(f) {
              return toggleRow(f.icon, f.label, f.desc, f.enabled, function() { f.enabled = !f.enabled; });
            })
          ),
          // 歌词对齐 + 行距（同一排）
          h('div', { style: { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '6px', padding: '8px 6px', 'border-radius': '8px', background: 'var(--card-bg, rgba(255,255,255,0.04))' } }, [
            // 第一列：歌词对齐
            h('div', { style: { display: 'flex', 'align-items': 'center', gap: '4px' } }, [
              h('span', { style: { 'font-size': '11px', color: 'var(--color-text-secondary)', 'flex-shrink': '0' } }, '📝 歌词对齐'),
              ['left', 'center', 'right'].map(function(a) {
                var active = currentAlign.value === a;
                var label = { left: '左对齐', center: '居中', right: '右对齐' }[a];
                return h('div', {
                  key: a,
                  style: {
                    cursor: 'pointer', padding: '3px 8px', 'border-radius': '5px',
                    'font-size': '12px', 'font-weight': active ? '600' : '400',
                    background: active ? 'var(--color-primary, #4caf50)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-text-secondary)',
                    border: active ? '1px solid var(--color-primary, #4caf50)' : '1px solid transparent',
                    transition: 'all 0.15s',
                  },
                  onClick: function() {
                    currentAlign.value = a;
                    featureState.lyricAlign = a;
                    saveFeatureState();
                    stopLyricAlign();
                    startLyricAlign(a);
                  },
                }, label);
              }),
            ]),
            // 第二列：歌词行距
            h('div', { style: { display: 'flex', 'align-items': 'center', gap: '4px' } }, [
              h('span', { style: { 'font-size': '11px', color: 'var(--color-text-secondary)', 'flex-shrink': '0' } }, '📏 歌词行距'),
              h('input', {
                type: 'range',
                min: -20,
                max: 30,
                step: 1,
                value: currentSpacing.value,
                style: { flex: '1', height: '3px', cursor: 'pointer', 'accent-color': 'var(--color-primary, #4caf50)' },
                onInput: function(e) {
                  var v = parseInt(e.target.value) || 0;
                  currentSpacing.value = v;
                  featureState.lyricSpacing = v;
                  saveFeatureState();
                  stopLyricAlign();
                  startLyricAlign(currentAlign.value || 'center');
                },
              }),
              h('div', { style: { display: 'flex', 'align-items': 'center', gap: '2px' } }, [
                h('span', { style: { 'font-size': '11px', 'font-weight': '600', 'min-width': '24px', 'text-align': 'right', color: currentSpacing.value === 0 ? 'var(--color-text-secondary)' : 'var(--color-primary, #4caf50)' } },
                  currentSpacing.value === 0 ? '—' : currentSpacing.value + 'px'
                ),
                h('span', { style: { 'font-size': '10px', cursor: 'pointer', padding: '1px 5px', 'border-radius': '4px', color: currentSpacing.value === 0 ? 'var(--color-text-secondary)' : 'var(--color-primary, #4caf50)', border: '1px solid ' + (currentSpacing.value === 0 ? 'var(--color-text-secondary)' : 'var(--color-primary, #4caf50)'), opacity: '0.7' },
                  onClick: function() {
                    if (currentSpacing.value !== 0) {
                      currentSpacing.value = 0;
                      featureState.lyricSpacing = 0;
                      saveFeatureState();
                      stopLyricAlign();
                      startLyricAlign(currentAlign.value || 'center');
                    }
                  }
                }, '默认'),
              ]),
            ]),
          ]),
          h('div', {
            style: {
              display: 'flex', gap: '3px',
              padding: '6px 8px', 'border-radius': '8px',
              'overflow-x': 'auto', 'flex-shrink': '0',
              background: 'var(--card-bg, rgba(255,255,255,0.04))',
            },
          },
            effectHotkeys.map(function(item) {
              var key = item.mode;
              var active = effectActive.value && currentEffectMode.value === key;
              return h('div', {
                key: key,
                style: { display: 'flex', 'align-items': 'center', gap: '2px', cursor: 'pointer', padding: '2px 6px', 'border-radius': '5px', background: active ? 'var(--hover-bg, rgba(128,128,128,0.1))' : 'transparent', 'font-size': '11px', color: active ? 'var(--color-primary, #4caf50)' : 'var(--color-text-secondary)', border: active ? '1px solid var(--color-primary, #4caf50)' : '1px solid transparent' },
                onClick: function() {
                  if (featureState.effect && currentEffectMode.value === key) {
                    // 再次点击同一图标 → 取消特效，界面即时更新
                    effectActive.value = false;
                    featureState.effect = false;
                    saveFeatureState();
                    stopEffect();
                  } else {
                    // 点击不同图标或特效关闭时 → 切换/启用
                    currentEffectMode.value = key;
                    effectActive.value = true;
                    featureState.effect = true;
                    featureState.effectMode = key;
                    saveFeatureState();
                    stopEffect();
                    startEffect(key);
                  }
                },
              }, [
                h('span', {}, item.icon),
                h('span', { style: { 'font-size': '11px' } }, _effectModes[key].label.replace(/^[^\s]+\s/, '')),
              ]);
            })
          ),
        ]);
      };
    },
  });

  // （歌曲列表简洁模式已移至「歌单布局」插件）

  disposeSettings = ctx.ui.settings.define({
    id: 'xiaotoolkit',
    title: '小功能',
    description: '独立开关每个功能，改动即时生效',
    component: SettingsComp,
  });
}

export function deactivate() {
  stopArtistSort();
  stopClickToPlay();
  stopLyricHide();
  stopPluginBtn();
  stopPlaylistLayout();
  stopSearchHistory();
  stopEffect();
  stopLyricAlign();

  if (disposeSettings) { disposeSettings(); disposeSettings = null; }
  ctx = null;
}
