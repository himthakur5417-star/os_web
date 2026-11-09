"use client";

/**
 * Nimbus UI · Liquid Accordion — "Spillway"
 * The same water as Waterline (Nimbus 01) and Surface Tension (Nimbus 02), poured
 * vertically. The open question holds a pool of water; open another and the pool
 * stretches down to it, pinches into droplets on long jumps and lands with a ripple.
 * The pool's front pours down into the answer as it opens, and drains back into the
 * little "+" drop when you close it. Water is drawn by a tiny WebGL shader (paused
 * off-screen); without WebGL it falls back to a CSS pool. No dependencies besides React.
 * by guglielmogiannattasio.it
 */

import * as React from "react";

export type LiquidAccordionItem = {
  question: string;
  answer: React.ReactNode;
  id?: string;
};

export type LiquidAccordionProps = {
  items?: LiquidAccordionItem[];
  /** index open at start (null = all closed) */
  defaultOpen?: number | null;
  /** controlled open index */
  open?: number | null;
  onOpenChange?: (index: number | null) => void;
  /** allow closing the open item (default true) */
  collapsible?: boolean;
  /** "light" water for bright backgrounds, "dark" for dark ones */
  tone?: "light" | "dark";
  /** soft synthesized "plip" on open (no audio files) */
  sound?: boolean;
  /** heading level of each question (default 3) */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
  style?: React.CSSProperties;
};

const DEFAULT_ITEMS: LiquidAccordionItem[] = [
  { question: "What is this?", answer: "An accordion made of water. Open a question and the pool flows to it." },
  { question: "Does it need WebGL?", answer: "No. Without WebGL it falls back to a soft CSS pool." },
  { question: "Is it accessible?", answer: "Yes: real buttons, aria-expanded, arrow keys and reduced motion." },
];

const PAD = 14; // canvas bleed around the card, for shadows and ripples
const R = 20; // pool corner radius

/* ---------- styles ---------- */
const NF_CSS = `
.nimbus-faq{--f-tint:rgba(255,255,255,.16);--f-fg:#0B132B;--f-soft:rgba(11,19,43,.64);--f-line:rgba(11,19,43,.08);--f-rim:rgba(255,255,255,.72);
  position:relative;box-sizing:border-box;width:100%;max-width:640px;padding:8px;border-radius:28px;isolation:isolate;
  font-family:ui-sans-serif,-apple-system,"SF Pro Text","Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
.nimbus-faq[data-tone="dark"]{--f-tint:rgba(10,18,40,.28);--f-fg:#F1F7FF;--f-soft:rgba(241,247,255,.66);--f-line:rgba(241,247,255,.09);--f-rim:rgba(255,255,255,.3)}
.nf-glass{position:absolute;inset:0;border-radius:inherit;z-index:-2;overflow:hidden;background:var(--f-tint);
  -webkit-backdrop-filter:blur(12px) saturate(1.2) brightness(1.06);backdrop-filter:blur(12px) saturate(1.2) brightness(1.06);
  box-shadow:inset 0 1px 1px var(--f-rim),inset 0 0 0 1px rgba(255,255,255,.2),0 18px 44px -20px rgba(0,40,90,.5),0 2px 6px rgba(0,40,90,.08)}
.nimbus-faq[data-tone="dark"] .nf-glass{box-shadow:inset 0 1px 1px var(--f-rim),inset 0 0 0 1px rgba(255,255,255,.1),0 18px 44px -20px rgba(0,0,0,.7)}
.nf-water{position:absolute;left:${-PAD}px;top:${-PAD}px;z-index:-1;pointer-events:none}
.nimbus-faq[data-gl="off"] .nf-water{display:none}
.nf-pool{display:none;position:absolute;left:8px;right:8px;top:0;border-radius:${R}px;z-index:-1;pointer-events:none;
  transition:transform .5s cubic-bezier(.3,1.3,.4,1),height .5s cubic-bezier(.25,.9,.3,1),opacity .3s;
  background:radial-gradient(120% 90% at 30% 0%,rgba(255,255,255,.7),rgba(255,255,255,0) 55%),rgba(255,255,255,.34);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.95),inset 0 -2px 8px rgba(0,162,255,.2),inset 0 0 0 1px rgba(255,255,255,.55),0 8px 20px -10px rgba(0,70,140,.45)}
.nimbus-faq[data-tone="dark"] .nf-pool{background:radial-gradient(120% 90% at 30% 0%,rgba(255,255,255,.3),rgba(255,255,255,0) 55%),rgba(140,200,255,.18)}
.nimbus-faq[data-gl="off"] .nf-pool{display:block}
.nf-item{position:relative}
.nf-item+.nf-item::before{content:"";position:absolute;left:22px;right:22px;top:0;height:1px;background:var(--f-line);transition:opacity .3s}
.nf-item[data-open="true"]::before,.nf-item[data-open="true"]+.nf-item::before{opacity:0}
.nf-h{margin:0;font:inherit}
.nf-q{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:16px;width:100%;min-height:58px;padding:14px 14px 14px 22px;border-radius:${R}px;cursor:pointer;
  color:var(--f-fg);font-weight:560;font-size:15px;line-height:1.35;letter-spacing:-.01em;user-select:none;-webkit-user-select:none}
.nf-q:focus-visible{outline:2px solid #00A2FF;outline-offset:-2px}
.nf-qt{flex:1;min-width:0}
.nf-ico{position:relative;flex:none;width:28px;height:28px;border-radius:50%;color:var(--f-fg);
  background:radial-gradient(120% 120% at 30% 15%,rgba(255,255,255,.9),rgba(255,255,255,0) 60%),rgba(255,255,255,.28);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.95),inset 0 -2px 4px rgba(0,162,255,.2),inset 0 0 0 1px rgba(255,255,255,.55),0 3px 8px -3px rgba(0,60,130,.4);
  transition:transform .55s cubic-bezier(.3,1.6,.5,1)}
.nimbus-faq[data-tone="dark"] .nf-ico{background:radial-gradient(120% 120% at 30% 15%,rgba(255,255,255,.45),rgba(255,255,255,0) 60%),rgba(140,200,255,.16);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.55),inset 0 0 0 1px rgba(255,255,255,.22),0 3px 8px -3px rgba(0,0,0,.6)}
.nf-ico::before,.nf-ico::after{content:"";position:absolute;left:50%;top:50%;width:11px;height:1.8px;margin:-.9px 0 0 -5.5px;border-radius:2px;background:currentColor;
  transition:transform .45s cubic-bezier(.3,1.6,.5,1)}
.nf-ico::after{transform:rotate(90deg)}
.nf-item[data-open="true"] .nf-ico{transform:rotate(180deg)}
.nf-item[data-open="true"] .nf-ico::after{transform:rotate(90deg) scaleX(0)}
.nf-ico[data-fx="drip"]{animation:nfDrip .7s cubic-bezier(.4,0,.3,1)}
@keyframes nfDrip{0%{translate:0 0;scale:1}25%{translate:0 -5px;scale:.9 1.1}50%{translate:0 2px;scale:1.18 .84}72%{translate:0 -1px;scale:.96 1.04}100%{translate:0 0;scale:1}}
.nf-panel{display:grid;grid-template-rows:0fr;transition:grid-template-rows .5s cubic-bezier(.25,.9,.3,1)}
.nf-item[data-open="true"]>.nf-panel{grid-template-rows:1fr}
.nf-inner{min-height:0;overflow:hidden;visibility:hidden;transition:visibility 0s .5s}
.nf-item[data-open="true"] .nf-inner{visibility:visible;transition:visibility 0s}
.nf-a{padding:0 64px 22px 22px;color:var(--f-soft);font-size:14px;line-height:1.62;opacity:0;transform:translateY(-6px);transition:opacity .25s,transform .4s}
.nf-a>*:first-child{margin-top:0}.nf-a>*:last-child{margin-bottom:0}
.nf-item[data-open="true"] .nf-a{opacity:1;transform:none;transition:opacity .4s .1s,transform .5s .06s cubic-bezier(.25,.9,.3,1)}
@media (max-width:520px){.nf-q{padding-left:18px;font-size:14.5px}.nf-a{padding:0 18px 20px 18px}}
@media (prefers-reduced-motion:reduce){.nf-panel,.nf-inner,.nf-a,.nf-ico,.nf-ico::before,.nf-ico::after,.nf-pool,.nf-item::before{transition:none!important;animation:none!important}}
`;

/* ---------- the water shader (Waterline engine, vertical pool) ---------- */
const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FRAG = `precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uCard;
uniform vec4 uBox[2];uniform float uBoxR[2];uniform vec4 uSat[4];uniform vec4 uRip[6];uniform vec3 uMouse;uniform vec3 uFront;
uniform float uDark;uniform float uAmb;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float dropD(vec2 p){float d=1e4;
 for(int i=0;i<2;i++){vec4 B=uBox[i];if(B.z>.5){vec2 q=p;
  if(i==int(uFront.z)){float f=exp(-pow(q.y-uFront.x,2.)/260.);q.y+=f*uFront.y*(sin(q.x*.075+uTime*6.)+.5*sin(q.x*.19-uTime*4.3));}
  d=smin(d,sdRB(q-B.xy,B.zw,uBoxR[i]),13.);}}
 for(int i=0;i<4;i++){vec4 S=uSat[i];if(S.z>.5){d=smin(d,length(p-S.xy)-S.z,13.);}}
 return d;}
float cardD(vec2 p){vec2 h=uCard.zw*.5;return sdRB(p-uCard.xy-h,h,28.);}
float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}
float waves(vec2 p){float w=0.;
 for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}
 vec2 m=p-uMouse.xy;w+=uMouse.z*3.6*exp(-dot(m,m)/1400.);
 w+=uAmb*(sin(p.x*.04+p.y*.02+uTime*1.1)*.45+sin(p.x*.11-uTime*.8+p.y*.13)*.25);return w;}
float H(vec2 p){float dc=cardD(p);return lens(dc,18.)*2.4+lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,9.,-dc);}
float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;
 float dp=cardD(p);if(dp>16.){gl_FragColor=vec4(0.);return;}
 float dd=dropD(p);
 float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));
 vec3 V=vec3(0.,0.,1.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);
 float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;
 float fres=clamp((1.-n.z)*4.,0.,1.);
 vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*.85+p.x*.0028+p.y*.0015+uTime*.035));
 float pm=smoothstep(1.,-1.,dp);float dm=smoothstep(1.,-1.,dd)*smoothstep(1.,-2.,dp);
 float sh=smoothstep(9.,-9.,dropD(p-vec2(0.,5.)))*(1.-dm)*pm*(.11+.07*uDark);
 vec3 c=vec3(0.,.14,.36)*sh;float a=sh;
 float pa=clamp(pm*(fres*.5+spec*.9+spec2),0.,1.);
 c=mix(vec3(1.),irid,.5*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);
 float th=lens(dd,11.);
 float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);
 vec3 tint=mix(vec3(.80,.95,1.),vec3(.55,.82,1.),uDark);
 float rim=dm*(1.-smoothstep(0.,8.,-dd));
 float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);
 float body=.5+.5*clamp(-n.y*3.,-1.,1.);
 float da=dm*(.26+.14*body)*(1.-.35*uDark);vec3 dc=mix(tint,vec3(1.),body*.6);
 float la=rim*.22;vec3 lc=mix(vec3(0.,.42,.78),vec3(.1,.55,.95),uDark);dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);
 la=clamp(cres*.7+smoothstep(.6,1.,cs)*.28*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=clamp(dm*(spec*1.2+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=dm*smoothstep(-2.,0.,dd)*.4;dc=mix(vec3(1.),irid,.35)*la+dc*(1.-la);da=la+da*(1.-la);
 c=dc+c*(1.-da);a=da+a*(1.-da);
 gl_FragColor=vec4(c,a);
}`;

type Box = { x: number; y: number; w: number; h: number; vx: number; vy: number; vw: number; vh: number };
type Sat = { x: number; y: number; vx: number; vy: number; r: number; k: number };
type Rip = { x: number; y: number; age: number; amp: number };
type GLC = { gl: WebGLRenderingContext; u: Record<string, WebGLUniformLocation | null> };
type Target = { x: number; y: number; w: number; h: number };

const box = (): Box => ({ x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0 });

function makeState() {
  return {
    a: box(),
    b: box(),
    lead: 0 as 0 | 1,
    lagUntil: 0,
    sats: [] as Sat[],
    rips: [] as Rip[],
    mouse: { x: 0, y: 0, s: 0, on: false },
    open: null as number | null,
    lastIdx: 0,
    moving: false,
    split: false,
    ready: false,
    w: 0,
    h: 0,
    ch: 0,
    visible: true,
    reduce: false,
    raf: 0,
    last: 0,
    time: 0,
    glc: null as GLC | null,
  };
}
function initGL(canvas: HTMLCanvasElement): GLC | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }) as WebGLRenderingContext | null;
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT);
  const fs = sh(gl.FRAGMENT_SHADER, FRAG);
  const p = gl.createProgram();
  if (!vs || !fs || !p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(p, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ["uRes", "uDpr", "uTime", "uCard", "uBox", "uBoxR", "uSat", "uRip", "uMouse", "uFront", "uDark", "uAmb"]) u[n] = gl.getUniformLocation(p, n);
  return { gl, u };
}

export function LiquidAccordion({
  items = DEFAULT_ITEMS,
  defaultOpen = 0,
  open,
  onOpenChange,
  collapsible = true,
  tone = "light",
  sound = false,
  headingLevel = 3,
  className,
  style,
}: LiquidAccordionProps) {
  const [inner, setInner] = React.useState<number | null>(defaultOpen);
  const current = open !== undefined ? open : inner;
  const uid = React.useId().replace(/:/g, "");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const poolRef = React.useRef<HTMLSpanElement>(null);
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const btnRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const iconRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const audio = React.useRef<AudioContext | null>(null);
  const st = React.useRef(makeState());
  const [gl, setGl] = React.useState<"on" | "off">("on");
  const [fx, setFx] = React.useState({ i: -1, n: 0 });
  const darkRef = React.useRef(0);
  darkRef.current = tone === "dark" ? 1 : 0;
  const H = `h${headingLevel}` as "h3";

  /* where the pool should be right now (follows the answer while it opens) */
  const target = React.useCallback((): Target | null => {
    const s = st.current;
    const root = rootRef.current;
    if (!root) return null;
    if (s.open !== null) {
      const el = itemRefs.current[s.open];
      if (!el) return null;
      return { x: PAD + s.w / 2, y: PAD + el.offsetTop + el.offsetHeight / 2, w: s.w / 2 - 8, h: Math.max(4, el.offsetHeight / 2 - 1) };
    }
    const ic = iconRefs.current[s.lastIdx];
    if (!ic) return null;
    const r = root.getBoundingClientRect(), b = ic.getBoundingClientRect();
    return { x: PAD + b.left - r.left + b.width / 2, y: PAD + b.top - r.top + b.height / 2, w: 0, h: 0 };
  }, []);

  /* ---- drawing ---- */
  const draw = React.useCallback(() => {
    const s = st.current;
    const head = s.lead === 0 ? s.a : s.b;
    const tail = s.lead === 0 ? s.b : s.a;
    const gap = Math.abs(head.y - tail.y) - (head.h + tail.h);
    const thin = Math.max(0, Math.min(1, (gap + 80) / 70));
    const shape = (B: Box, k: number) => {
      const w = B.w * (1 - k * thin);
      const h = B.h;
      const r = Math.max(0, Math.min(R + (Math.min(w, h) - R) * thin, w, h));
      return { w, h, r };
    };
    const hs = shape(head, 0.22), ts = shape(tail, 0.5);
    if (s.glc) {
      const { gl: c, u } = s.glc;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      c.viewport(0, 0, c.drawingBufferWidth, c.drawingBufferHeight);
      c.uniform2f(u.uRes, s.w + PAD * 2, s.ch);
      c.uniform1f(u.uDpr, dpr);
      c.uniform1f(u.uTime, s.time);
      c.uniform4f(u.uCard, PAD, PAD, s.w, s.h);
      const on = (B: { w: number; h: number }) => B.w > 1 && B.h > 1;
      c.uniform4fv(u.uBox, new Float32Array([
        head.x, head.y, on(hs) ? hs.w : 0, hs.h,
        tail.x, tail.y, on(ts) ? ts.w : 0, ts.h,
      ]));
      c.uniform1fv(u.uBoxR, new Float32Array([hs.r, ts.r]));
      const sats = new Float32Array(16);
      s.sats.slice(0, 4).forEach((d, i) => sats.set([d.x, d.y, d.r, 0], i * 4));
      c.uniform4fv(u.uSat, sats);
      const rips = new Float32Array(24);
      s.rips.slice(-6).forEach((p, i) => rips.set([p.x, p.y, p.age, p.amp], i * 4));
      c.uniform4fv(u.uRip, rips);
      c.uniform3f(u.uMouse, s.mouse.x, s.mouse.y, s.mouse.s);
      c.uniform3f(u.uFront, head.y + head.h, s.reduce ? 0 : Math.min(Math.abs(head.vh) * 0.012, 4.5), 0);
      c.uniform1f(u.uDark, darkRef.current);
      c.uniform1f(u.uAmb, s.reduce ? 0 : 1);
      c.clearColor(0, 0, 0, 0);
      c.clear(c.COLOR_BUFFER_BIT);
      c.drawArrays(c.TRIANGLES, 0, 3);
    } else if (poolRef.current) {
      const p = poolRef.current;
      const T = target();
      if (s.open !== null && T) {
        p.style.opacity = "1";
        p.style.height = `${T.h * 2}px`;
        p.style.transform = `translateY(${T.y - T.h - PAD}px)`;
      } else p.style.opacity = "0";
    }
  }, [target]);

  /* ---- physics ---- */
  const step = React.useCallback((dt: number, now: number) => {
    const s = st.current;
    s.time += dt;
    const T = target();
    let still = true;
    if (T) {
      const bodies = [s.a, s.b];
      if (s.reduce) {
        for (const B of bodies) Object.assign(B, T, { vx: 0, vy: 0, vw: 0, vh: 0 });
        s.sats = [];
      } else {
        bodies.forEach((B, i) => {
          const lead = i === s.lead;
          const k = lead ? 210 : 60;
          const c = lead ? 25 : 13;
          const f = !lead && now < s.lagUntil ? 0.04 : 1;
          const kh = lead ? 260 : 90; // height follows the opening answer a bit stiffer
          B.vx += (k * (T.x - B.x) - c * B.vx) * dt * f;
          B.vy += (k * (T.y - B.y) - c * B.vy) * dt * f;
          B.vw += (k * (T.w - B.w) - c * B.vw) * dt * f;
          B.vh += (kh * (T.h - B.h) - (lead ? 22 : 14) * B.vh) * dt * f;
          B.x += B.vx * dt; B.y += B.vy * dt; B.w += B.vw * dt; B.h += B.vh * dt;
          B.w = Math.max(0, B.w); B.h = Math.max(0, B.h);
          if (Math.abs(T.y - B.y) > 0.3 || Math.abs(T.h - B.h) > 0.3 || Math.abs(T.w - B.w) > 0.3 || Math.abs(B.vy) + Math.abs(B.vh) > 3) still = false;
        });
        // pinch off droplets in the gap on long jumps
        const head = bodies[s.lead], tail = bodies[1 - s.lead];
        const gap = Math.abs(head.y - tail.y) - (head.h + tail.h);
        if (!s.split && s.moving && gap > 4 && s.open !== null) {
          s.split = true;
          const top = Math.min(head.y, tail.y) + (head.y < tail.y ? head.h : tail.h);
          ;[0.25, 0.55, 0.85].forEach((t, j) => {
            s.sats.push({
              x: head.x + (Math.random() - 0.5) * s.w * 0.35,
              y: top + gap * t,
              vx: (Math.random() - 0.5) * 80,
              vy: (head.vy + tail.vy) * 0.4,
              r: 9 - j * 1.5 + Math.random() * 2,
              k: 60 + Math.random() * 80,
            });
          });
        }
        s.sats = s.sats.filter((d) => {
          d.vx += (25 * (head.x - d.x) - 6 * d.vx) * dt;
          d.vy += (d.k * (head.y - d.y) - 9 * d.vy) * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          if (Math.abs(head.y - d.y) < head.h * 0.85 || head.h < 6) d.r -= dt * 30;
          return d.r > 0.6;
        });
        if (s.sats.length) still = false;
      }
      if (s.moving && still) {
        s.moving = false;
        if (!s.reduce && s.open !== null) s.rips.push({ x: T.x, y: T.y - T.h + 22, age: 0, amp: s.split ? 1.1 : 0.6 });
      }
    }
    s.rips.forEach((p) => (p.age += dt));
    s.rips = s.rips.filter((p) => p.age < 2.4);
    s.mouse.s += ((s.mouse.on ? 1 : 0) - s.mouse.s) * Math.min(1, dt * 7);
  }, [target]);

  const loop = React.useCallback(() => {
    const s = st.current;
    if (s.raf) return;
    s.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - s.last) / 1000, 1 / 30);
      s.last = now;
      step(dt, now);
      draw();
      const busy = s.moving || s.rips.length || s.sats.length || s.mouse.s > 0.01;
      if (s.visible && (!s.reduce || busy)) s.raf = requestAnimationFrame(tick);
      else s.raf = 0;
    };
    s.raf = requestAnimationFrame(tick);
  }, [draw, step]);

  /* ---- layout ---- */
  const resize = React.useCallback(() => {
    const root = rootRef.current;
    const cv = canvasRef.current;
    if (!root) return;
    const s = st.current;
    s.w = root.offsetWidth;
    s.h = root.offsetHeight;
    if (cv) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const W = s.w + PAD * 2;
      const Hc = Math.ceil((s.h + PAD * 2) / 96) * 96; // grow in steps, not every frame of an opening answer
      if (Hc !== s.ch || cv.width !== Math.round(W * dpr)) {
        s.ch = Hc;
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(Hc * dpr);
        cv.style.width = `${W}px`;
        cv.style.height = `${Hc}px`;
      }
    }
    if (!s.ready) {
      const T = target();
      if (T) {
        Object.assign(s.a, T);
        Object.assign(s.b, T);
        s.ready = true;
      }
    }
    loop();
  }, [loop, target]);

  React.useEffect(() => {
    const s = st.current;
    s.reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const cv = canvasRef.current;
    s.glc = cv ? initGL(cv) : null;
    if (!s.glc) setGl("off");
    const lost = (e: Event) => { e.preventDefault(); s.glc = null; setGl("off") };
    cv?.addEventListener("webglcontextlost", lost);
    const io = new IntersectionObserver(([e]) => { s.visible = e.isIntersecting; if (s.visible) loop() });
    if (rootRef.current) io.observe(rootRef.current);
    const vis = () => { s.visible = document.visibilityState === "visible"; if (s.visible) loop() };
    document.addEventListener("visibilitychange", vis);
    const ro = new ResizeObserver(() => resize());
    if (rootRef.current) ro.observe(rootRef.current);
    return () => {
      cv?.removeEventListener("webglcontextlost", lost);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [loop, resize]);

  /* follow the open index */
  React.useLayoutEffect(() => {
    const s = st.current;
    if (!s.ready) {
      s.open = current;
      if (current !== null) s.lastIdx = current;
      resize();
      return;
    }
    if (s.open === current) return;
    const from = s.open;
    s.open = current;
    if (current !== null) {
      s.lastIdx = current;
      if (from === null) {
        // grow out of the "+" drop
        const ic = iconRefs.current[current], root = rootRef.current;
        if (ic && root) {
          const r = root.getBoundingClientRect(), b = ic.getBoundingClientRect();
          const x = PAD + b.left - r.left + b.width / 2, y = PAD + b.top - r.top + b.height / 2;
          for (const B of [s.a, s.b]) Object.assign(B, { x, y, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0 });
        }
      }
    }
    const T = target();
    if (T) s.lead = Math.abs(T.y - s.a.y) <= Math.abs(T.y - s.b.y) ? 0 : 1;
    s.lagUntil = performance.now() + (from === null || current === null ? 0 : 120);
    s.moving = true;
    s.split = false;
    loop();
  }, [current, loop, resize, target]);

  React.useEffect(() => { loop() }, [tone, items.length, loop]);

  /* ---- interaction ---- */
  const local = (clientX: number, clientY: number) => {
    const r = rootRef.current?.getBoundingClientRect();
    return r ? { x: clientX - r.left + PAD, y: clientY - r.top + PAD } : { x: 0, y: 0 };
  };
  const plip = () => {
    if (!sound) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = (audio.current ||= new AC());
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(420 + Math.random() * 80, t);
      o.frequency.exponentialRampToValueAtTime(1500, t + 0.07);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.18);
    } catch {
      /* audio is optional */
    }
  };

  const toggle = (i: number) => {
    const next = current === i ? (collapsible ? null : i) : i;
    if (next === current) return;
    if (next !== null) { plip(); setFx((f) => ({ i, n: f.n + 1 })) }
    if (open === undefined) setInner(next);
    onOpenChange?.(next);
  };

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const n = items.length;
    let j = -1;
    if (e.key === "ArrowDown") j = (i + 1) % n;
    else if (e.key === "ArrowUp") j = (i - 1 + n) % n;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    if (j < 0) return;
    e.preventDefault();
    btnRefs.current[j]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={["nimbus-faq", className].filter(Boolean).join(" ")}
      data-tone={tone}
      data-gl={gl}
      style={style}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const s = st.current;
        const p = local(e.clientX, e.clientY);
        s.mouse.x = p.x;
        s.mouse.y = p.y;
        s.mouse.on = true;
        loop();
      }}
      onPointerLeave={() => { st.current.mouse.on = false; loop() }}
      onPointerDown={(e) => {
        const s = st.current;
        if (s.reduce) return;
        const p = local(e.clientX, e.clientY);
        s.rips.push({ x: p.x, y: p.y, age: 0, amp: 0.7 });
        loop();
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: NF_CSS }} />
      <span className="nf-glass" aria-hidden="true" />
      <canvas className="nf-water" ref={canvasRef} aria-hidden="true" />
      <span className="nf-pool" ref={poolRef} aria-hidden="true" />
      {items.map((it, i) => {
        const isOpen = current === i;
        const base = `${uid}-${it.id ?? i}`;
        return (
          <div className="nf-item" key={it.id ?? i} data-open={isOpen} ref={(el) => { itemRefs.current[i] = el }}>
            <H className="nf-h">
              <button
                ref={(el) => { btnRefs.current[i] = el }}
                type="button"
                id={`${base}-q`}
                className="nf-q"
                aria-expanded={isOpen}
                aria-controls={`${base}-a`}
                aria-disabled={isOpen && !collapsible ? true : undefined}
                onClick={() => toggle(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <span className="nf-qt">{it.question}</span>
                <span
                  className="nf-ico"
                  aria-hidden="true"
                  key={fx.i === i ? fx.n : 0}
                  data-fx={fx.i === i ? "drip" : undefined}
                  ref={(el) => { iconRefs.current[i] = el }}
                />
              </button>
            </H>
            <div className="nf-panel" id={`${base}-a`} role="region" aria-labelledby={`${base}-q`}>
              <div className="nf-inner">
                <div className="nf-a">{it.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** alias for registries that import { Component } */
export { LiquidAccordion as Component };

export default LiquidAccordion;
