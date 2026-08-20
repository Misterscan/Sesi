// Native data-driven Canvas game module for Sesi.
import type { RuntimeFunction, RuntimeValue } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { spawn } from 'child_process';
import { ensureSafePath } from './builtins';

type RuntimeContext = { safeMode: boolean; allowLocalFs: boolean; allowedPaths: string[] };
type Data = Record<string, any>;

function builtin(name: string, params: string[], fn: (...args: RuntimeValue[]) => RuntimeValue | Promise<RuntimeValue>): RuntimeFunction {
  return { type: 'function', name, params: params.map(name => ({ name })), body: {} as any, closure: {} as any, isBuiltin: true, builtin: fn as any };
}

function object(value: RuntimeValue, label: string): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} expects an object`);
  return value as Data;
}

function positive(value: any, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number`);
  return value;
}

function isRemote(asset: string): boolean { return /^(https?:|data:)/i.test(asset); }

function mimeType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' } as Record<string, string>)[ext] || 'application/octet-stream';
}

function serializable(value: any): any {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(serializable);
  if (typeof value === 'object') {
    const out: Data = Object.create(null);
    for (const [key, item] of Object.entries(value)) out[key] = serializable(item);
    return out;
  }
  return null;
}

function runtimeHtml(definition: Data): string {
  const encoded = JSON.stringify(definition).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(definition.title || 'Sesi Game')}</title>
<style>html,body{height:100%;margin:0;background:#111;color:#fff;font-family:system-ui,sans-serif}body{display:grid;place-items:center}#game-wrap{position:relative}canvas{display:block;max-width:100vw;max-height:100vh;image-rendering:auto}#hud{position:absolute;inset:0;pointer-events:none;padding:12px;font-weight:700;white-space:pre}</style></head>
<body><div id="game-wrap"><canvas id="game"></canvas><div id="hud"></div></div><script>
(() => {
  const game = ${encoded}; const canvas=document.querySelector('#game'), ctx=canvas.getContext('2d'), hud=document.querySelector('#hud');
  canvas.width=game.width; canvas.height=game.height; const keys=new Set(), pressed=new Set(), pointer={x:0,y:0,down:false};
  const entities=game.entities.map(e=>({...e,x:+e.x||0,y:+e.y||0,vx:+e.vx||0,vy:+e.vy||0,gravity:+e.gravity||0,alive:true})); const scores={...(game.scores||{})};
  const images={}; for(const e of entities) if(e.asset&&e.shape==='sprite'){const img=new Image();img.src=e.asset;images[e.id]=img;}
  addEventListener('keydown',e=>{if(!keys.has(e.key))pressed.add(e.key);keys.add(e.key);}); addEventListener('keyup',e=>keys.delete(e.key));
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left)*canvas.width/r.width;pointer.y=(e.clientY-r.top)*canvas.height/r.height}); canvas.addEventListener('pointerdown',()=>pointer.down=true); addEventListener('pointerup',()=>pointer.down=false);
  const byId=id=>entities.find(e=>e.id===id), tagged=tag=>entities.filter(e=>(e.tags||[]).includes(tag)); const matches=(e, ref)=>ref===e.id||(e.tags||[]).includes(ref);
  const overlap=(a,b)=>a.x<(b.x+(b.width||b.radius*2||0))&&a.x+(a.width||a.radius*2||0)>b.x&&a.y<(b.y+(b.height||b.radius*2||0))&&a.y+(a.height||a.radius*2||0)>b.y;
  function audio(rule){ if(typeof rule.sound==='string'){const clip=new Audio(rule.sound);clip.play().catch(()=>{});return} const ac=new (window.AudioContext||window.webkitAudioContext)(); const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=rule.frequency||440;g.gain.value=.08;o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+(rule.duration||90)/1000); }
  function targets(ref){return ref?tagged(ref).concat(byId(ref)?[byId(ref)]:[]):[]}
  function act(rule, subject, other){ const target=rule.target==='other'?other:subject; if(rule.action==='destroy'&&target)target.alive=false; if(rule.action==='reverseVelocity'&&target){target.vx=-target.vx;target.vy=-target.vy} if(rule.action==='set'&&target&&rule.property)target[rule.property]=rule.value; if(rule.action==='addScore')scores[rule.score||'score']=(scores[rule.score||'score']||0)+(+rule.value||1); if(rule.action==='spawn'&&rule.entity){entities.push({...rule.entity,x:+rule.entity.x||0,y:+rule.entity.y||0,vx:+rule.entity.vx||0,vy:+rule.entity.vy||0,gravity:+rule.entity.gravity||0,alive:true})} if(rule.action==='sound')audio(rule); }
  function rules(event, subject, other){for(const r of game.rules)if(r.event===event&&(!r.source||matches(subject,r.source))&&(!r.targetRef||!other||matches(other,r.targetRef)))act(r,subject,other)}
  function control(e,dt){if(!e.control)return;const c=e.control,s=+c.speed||200;const bind=game.input||{};let dx=0,dy=0;const down=a=>(bind[a]||[]).some(k=>keys.has(k));if(down(c.left||'left'))dx--;if(down(c.right||'right'))dx++;if(down(c.up||'up'))dy--;if(down(c.down||'down'))dy++;e.vx=dx*s;e.vy=dy*s;}
  function bounds(e){const w=e.width||e.radius*2||0,h=e.height||e.radius*2||0;if(e.x<0||e.y<0||e.x+w>game.width||e.y+h>game.height){rules('bounds',e);if(e.bounds==='wrap'){if(e.x+w<0)e.x=game.width;if(e.x>game.width)e.x=-w;if(e.y+h<0)e.y=game.height;if(e.y>game.height)e.y=-h}else if(e.bounds==='bounce'){if(e.x<0||e.x+w>game.width)e.vx=-e.vx;if(e.y<0||e.y+h>game.height)e.vy=-e.vy;e.x=Math.max(0,Math.min(game.width-w,e.x));e.y=Math.max(0,Math.min(game.height-h,e.y))}else if(e.bounds==='clamp'){e.x=Math.max(0,Math.min(game.width-w,e.x));e.y=Math.max(0,Math.min(game.height-h,e.y));}}}
  function draw(e){ctx.save();ctx.globalAlpha=e.opacity==null?1:e.opacity;ctx.fillStyle=e.color||'#fff';if(e.shape==='circle'){ctx.beginPath();ctx.arc(e.x+(e.radius||0),e.y+(e.radius||0),e.radius||0,0,Math.PI*2);ctx.fill()}else if(e.shape==='text'){ctx.font=e.font||'20px sans-serif';ctx.fillText(e.text||'',e.x,e.y)}else if(e.shape==='sprite'&&images[e.id])ctx.drawImage(images[e.id],e.x,e.y,e.width,e.height);else ctx.fillRect(e.x,e.y,e.width,e.height);ctx.restore()}
  const timerMarks=new WeakMap();let last=performance.now();function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;for(const e of entities.filter(e=>e.alive)){control(e,dt);e.vy+=e.gravity*dt;e.x+=e.vx*dt;e.y+=e.vy*dt;bounds(e)}for(let i=0;i<entities.length;i++)for(let j=i+1;j<entities.length;j++){const a=entities[i],b=entities[j];if(a.alive&&b.alive&&a.collider&&b.collider&&overlap(a,b)){rules('collision',a,b);rules('collision',b,a)}}for(const r of game.rules)if(r.event==='timer'&&now-(timerMarks.get(r)||0)>=(+r.every||1000)){timerMarks.set(r,now);act(r,null,null)}for(const e of entities)for(const key of pressed)rules('key',e,{id:key,tags:[key]});ctx.fillStyle=game.background||'#000';ctx.fillRect(0,0,game.width,game.height);entities.filter(e=>e.alive).forEach(draw);hud.textContent=Object.entries(scores).map(([k,v])=>k+': '+v).join('\\n');pressed.clear();requestAnimationFrame(frame)}requestAnimationFrame(frame);
})();</script></body></html>`;
}

function escapeHtml(value: string): string { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }

export function createGameModule(context: RuntimeContext): Map<string, RuntimeValue> {
  const exports = new Map<string, RuntimeValue>();
  exports.set('create', builtin('create', ['config'], (configVal) => {
    const config = object(configVal, 'Game.create'); const width = positive(config.width, 'Game width'); const height = positive(config.height, 'Game height');
    const game: Data = { width, height, title: typeof config.title === 'string' ? config.title : 'Sesi Game', background: typeof config.background === 'string' ? config.background : '#000', input: serializable(config.input || {}), scores: serializable(config.scores || {}), entities: [], rules: [] };
    const gameObj: Data = Object.create(null);
    gameObj.add = builtin('add', ['entity'], (entityVal) => { const entity = object(entityVal, 'game.add'); const id = entity.id; const shape = entity.shape || 'rect'; if (typeof id !== 'string' || id === '') throw new Error('Game entity requires a non-empty id'); if (!['rect', 'circle', 'sprite', 'text'].includes(shape)) throw new Error(`Unsupported game entity shape: ${shape}`); if (game.entities.some((e: Data) => e.id === id)) throw new Error(`Duplicate game entity id: ${id}`); if (shape === 'circle') positive(entity.radius, `Entity ${id} radius`); else if (shape !== 'text') { positive(entity.width, `Entity ${id} width`); positive(entity.height, `Entity ${id} height`); } if (entity.asset !== undefined) { if (typeof entity.asset !== 'string') throw new Error(`Entity ${id} asset must be a string path or URL`); if (!isRemote(entity.asset)) { const assetPath = ensureSafePath(entity.asset, context); if (!fs.existsSync(assetPath) || fs.statSync(assetPath).isDirectory()) throw new Error(`Entity ${id} asset was not found: ${entity.asset}`); entity.asset = `data:${mimeType(assetPath)};base64,${fs.readFileSync(assetPath).toString('base64')}`; } } game.entities.push(serializable(entity)); return gameObj as RuntimeValue; });
    gameObj.rule = builtin('rule', ['rule'], (ruleVal) => { const rule = object(ruleVal, 'game.rule'); if (!['collision', 'key', 'timer', 'bounds'].includes(rule.event)) throw new Error('Game rule event must be collision, key, timer, or bounds'); if (!['destroy', 'spawn', 'set', 'addScore', 'reverseVelocity', 'sound'].includes(rule.action)) throw new Error('Game rule action must be destroy, spawn, set, addScore, reverseVelocity, or sound'); if (typeof rule.source !== 'string' && rule.event !== 'timer') throw new Error('Game rule requires a source entity id or tag'); if (rule.action === 'spawn' && (!rule.entity || typeof rule.entity !== 'object')) throw new Error('Spawn game rules require an entity'); game.rules.push(serializable(rule)); return gameObj as RuntimeValue; });
    const validate = () => {
      const refs = new Set<string>();
      for (const entity of game.entities) { refs.add(entity.id); for (const tag of entity.tags || []) if (typeof tag === 'string') refs.add(tag); }
      for (const rule of game.rules) {
        if (rule.event !== 'timer' && !refs.has(rule.source)) throw new Error(`Game rule source does not match an entity id or tag: ${rule.source}`);
        if (rule.targetRef && rule.event !== 'key' && !refs.has(rule.targetRef)) throw new Error(`Game rule targetRef does not match an entity id or tag: ${rule.targetRef}`);
      }
    };
    const render = () => { validate(); return runtimeHtml(game); };
    gameObj.build = builtin('build', ['filePath'], (fileVal) => { if (typeof fileVal !== 'string' || !fileVal.endsWith('.html')) throw new Error('game.build expects an .html output path'); const output = ensureSafePath(fileVal, context); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, render(), 'utf8'); return fileVal; });
    gameObj.run = builtin('run', ['options'], async (optionsVal = null) => { if (context.safeMode) throw new Error('Security Violation: std/game run is disabled in Sesi safe mode.'); const options = optionsVal === null ? {} : object(optionsVal, 'game.run'); const port = options.port === undefined ? 0 : options.port; if (typeof port !== 'number' || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Preview port must be an integer from 0 to 65535'); const server = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(render()); }); await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); const address = server.address() as any; const url = () => `http://127.0.0.1:${address.port}/`; if (options.open !== false) { const target = url(); if (process.platform === 'darwin') spawn('open', [target], { detached: true, stdio: 'ignore' }).unref(); else if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore', shell: true }).unref(); else spawn('xdg-open', [target], { detached: true, stdio: 'ignore' }).unref(); } const preview: Data = Object.create(null); preview.url = builtin('url', [], () => url()); preview.stop = builtin('stop', [], () => { server.close(); return null; }); return preview as RuntimeValue; });
    return gameObj as RuntimeValue;
  }));
  return exports;
}
