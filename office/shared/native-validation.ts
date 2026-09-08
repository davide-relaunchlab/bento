// SPDX-License-Identifier: MIT
// Runtime shapes consumed directly by the hosted editors. Unknown extension
// fields survive; known fields must have the types their renderers require.
import {OfficeError} from './changes.ts';
type Obj=Record<string,any>;
const bad=():never=>{throw new OfficeError('invalid_document','Struttura del documento non valida per questo editor.',400);};
function obj(v:unknown):asserts v is Obj {if(!v||typeof v!=='object'||Array.isArray(v))bad();}
function str(v:unknown):asserts v is string {if(typeof v!=='string')bad();}
function num(v:unknown):asserts v is number {if(typeof v!=='number'||!Number.isFinite(v))bad();}
function bool(v:unknown){if(typeof v!=='boolean')bad();}
function range(v:unknown,lo:number,hi=Number.MAX_SAFE_INTEGER){num(v);if(v<lo||v>hi)bad();}
function integer(v:unknown,lo=0,hi=Number.MAX_SAFE_INTEGER){range(v,lo,hi);if(!Number.isInteger(v))bad();}
function list(v:unknown,check:(item:any)=>void,max=100000):asserts v is any[]{if(!Array.isArray(v))return bad();if(v.length>max)bad();for(const item of v)check(item);}
function optional(o:Obj,key:string,check:(value:any)=>void){if(o[key]!==undefined)check(o[key]);}
function strings(o:Obj,keys:string[]){for(const k of keys)optional(o,k,str);}
function numbers(o:Obj,keys:string[]){for(const k of keys)optional(o,k,num);}
function booleans(o:Obj,keys:string[]){for(const k of keys)optional(o,k,bool);}
function stringMap(v:unknown){obj(v);for(const item of Object.values(v))str(item);}
function choice(v:unknown,choices:string[]){if(typeof v!=='string'||!choices.includes(v))bad();}
const kinds=['para','h1','h2','h3','quote','ul','ol','cell','image','caption','toc','math','embed'];
function identity(v:unknown){str(v);if(!v||v.length>200)bad();}
function unique(v:unknown,check:(item:any)=>void,max=100000){const seen=new Set<string>();list(v,item=>{obj(item);identity(item.id);if(seen.has(item.id))bad();seen.add(item.id);check(item);},max);}
function layout(o:unknown){obj(o);strings(o,['align','family','color']);numbers(o,['sb','sa','lh','ind','size','weight']);booleans(o,['italic']);}
function mark(m:unknown,len:number){
  obj(m);choice(m.t,['b','i','u','s','code','link','math','ins','del','font']);integer(m.from,0,len);integer(m.to,m.from,len);
  strings(m,['href','by','at','family']);optional(m,'size',n=>range(n,1,1000));
}
function block(b:unknown){
  obj(b);identity(b.id);choice(b.kind,kinds);str(b.text);
  optional(b,'marks',m=>list(m,x=>mark(x,b.text.length)));
  optional(b,'notes',notes=>list(notes,n=>{obj(n);identity(n.id);integer(n.at,0,b.text.length);}));
  optional(b,'refs',refs=>list(refs,r=>{obj(r);identity(r.to);integer(r.at,0,b.text.length);optional(r,'style',x=>choice(x,['label','page','both']));}));
  optional(b,'cites',cites=>list(cites,c=>{obj(c);integer(c.at,0,b.text.length);list(c.keys,str);strings(c,['locator']);booleans(c,['suppressAuthor']);}));
  strings(b,['role','styleId']);layout(b);booleans(b,['keepNext','keepTogether','breakBefore']);optional(b,'level',n=>integer(n,0,5));
  optional(b,'cell',c=>{obj(c);identity(c.table);integer(c.cols,1,20);booleans(c,['head']);});
  if(b.kind==='cell'&&!b.cell)bad();
  optional(b,'image',im=>{obj(im);str(im.src);strings(im,['alt','align']);optional(im,'w',n=>range(n,Number.MIN_VALUE,1));});
  optional(b,'caption',c=>{obj(c);choice(c.kind,['table','figure']);strings(c,['of']);});
  optional(b,'embed',e=>{obj(e);str(e.app);str(e.view);numbers(e,['w','h']);booleans(e,['live']);});
}
function gradient(g:unknown){obj(g);num(g.angle);list(g.stops,s=>{obj(s);num(s.at);str(s.color);},1000);}
function shadow(s:unknown){obj(s);str(s.color);num(s.blur);numbers(s,['x','y']);}
function tableStyle(s:unknown,complete=false){
  obj(s);const text=['headerBg','headerColor','borderColor','color'];const numeric=['borderWidth','cellPadX','cellPadY','fontSize','radius'];
  if(complete){for(const k of text)str(s[k]);for(const k of numeric)num(s[k]);}
  strings(s,[...text,'zebra','fontFamily']);numbers(s,numeric);
}
function element(e:unknown){
  obj(e);identity(e.id);choice(e.type,['text','code','shape','image','svg','chart','table','media']);
  for(const k of ['x','y','w','h','rotation','opacity'])num(e[k]);
  strings(e,['morphId','blend','link','group','groupId','showOnHover','role']);numbers(e,['blur','backdropFilter']);
  optional(e,'themeRefs',stringMap);
  optional(e,'shadow',s=>Array.isArray(s)?list(s,shadow,100):shadow(s));
  optional(e,'fx',f=>{obj(f);strings(f,['enter','ambient']);numbers(f,['enterDur','order']);booleans(f,['countUp']);
    optional(f,'ken',k=>{obj(k);strings(k,['dir']);numbers(k,['scale','duration']);});
    optional(f,'loop',l=>{obj(l);str(l.type);strings(l,['path','ease']);numbers(l,['duration','delay','distance']);optional(l,'speeds',v=>list(v,num));});
  });
  if(e.type==='text'||e.type==='code'){
    str(e.type==='text'?e.html:e.content);str(e.fontFamily);str(e.color);num(e.fontSize);num(e.lineHeight);str(e.align);str(e.valign);
    if(e.type==='text'){num(e.fontWeight);strings(e,['placeholder']);numbers(e,['letterSpacing']);optional(e,'colorGradient',gradient);optional(e,'textStroke',s=>{obj(s);num(s.width);str(s.color);strings(s,['fill']);});}
    else strings(e,['grammarAssetId','grammarName','themeAssetId','themeName']);
  }else if(e.type==='shape'){
    choice(e.shape,['rect','ellipse','triangle','arrow','line','path']);str(e.fill);str(e.stroke);num(e.strokeWidth);num(e.radius);
    strings(e,['d','strokeStyle','lineStart','lineEnd']);numbers(e,['strokeDash']);optional(e,'fillGradient',gradient);
    optional(e,'pathBox',v=>{list(v,num,4);if(v.length!==4)bad();});
    for(const k of ['from','to'])optional(e,k,c=>{obj(c);identity(c.el);strings(c,['side']);});
  }else if(e.type==='image'){str(e.src);str(e.fit);num(e.radius);}
  else if(e.type==='svg'){strings(e,['asset','markup','css']);}
  else if(e.type==='media'){choice(e.kind,['video','audio']);str(e.src);strings(e,['poster','fit']);numbers(e,['radius']);booleans(e,['autoplay','loop','muted','controls']);}
  else if(e.type==='chart'){obj(e.option);strings(e,['preset']);optional(e,'source',s=>{obj(s);identity(s.tableId);});}
  else if(e.type==='table'){
    list(e.columns,c=>{obj(c);range(c.w,0);},10000);if(!e.columns.length)bad();
    list(e.rows,r=>{obj(r);list(r.cells,c=>{obj(c);str(c.html);strings(c,['align','color','bg']);booleans(c,['bold']);},10000);},10000);
    bool(e.header);tableStyle(e.style,true);
  }
}
function slide(s:unknown){
  obj(s);identity(s.id);str(s.background);str(s.notes);choice(s.transition,['none','fade','slide','zoom','morph']);unique(s.elements,element);
  strings(s,['name','stateOf']);booleans(s,['hidden']);optional(s,'themeRefs',stringMap);
  optional(s,'hover',h=>{obj(h);choice(h.type,['focus-group','reveal']);numbers(h,['dim']);strings(h,['default']);});
  optional(s,'comments',v=>unique(v,c=>{stringsRequired(c,['author','text','at']);strings(c,['elementId']);numbers(c,['x','y']);booleans(c,['resolved']);optional(c,'replies',r=>unique(r,m=>stringsRequired(m,['author','text','at'])));}));
}
function stringsRequired(o:Obj,keys:string[]){for(const k of keys)str(o[k]);}
/** Called after the generic JSON/depth/identity envelope checks. Never repairs. */
export function validateNativeShape(doc:unknown):void {
  obj(doc);const d=doc;
  if(d.format!=='bento/type'&&d.format!=='bento/slides')bad();
  optional(d,'assets',stringMap);optional(d,'meta',stringMap);strings(d,['modified']);
  optional(d,'fonts',fonts=>list(fonts,f=>{obj(f);str(f.family);str(f.asset);strings(f,['weight','style']);
    if(f.weight!==undefined&&!/^(normal|bold|[1-9]00(?: [1-9]00)?)$/.test(f.weight))bad();
    if(f.style!==undefined&&!/^(normal|italic|oblique)$/.test(f.style))bad();
  },1000));
  if(d.format==='bento/type'){
    obj(d.page);for(const k of ['width','height'])range(d.page[k],1,100000);for(const k of ['marginX','marginTop','marginBottom'])range(d.page[k],0,100000);numbers(d.page,['marginLeft','marginRight']);
    unique(d.body,block);if(!d.body.length)bad();stringMap(d.footnotes);strings(d,['subtitle']);booleans(d,['track']);
    optional(d,'layout',layout);optional(d,'type',layout);
    optional(d,'styles',styles=>{obj(styles);for(const s of Object.values(styles)){obj(s);stringsRequired(s,['id','name']);choice(s.kind,kinds);layout(s);}});
    list(d.revisions,r=>{obj(r);stringsRequired(r,['id','at','label']);unique(r.body,block);});
    list(d.signatures,s=>{obj(s);stringsRequired(s,['alg','pub','name','content','prev','sig']);strings(s,['at']);});
    optional(d,'comments',comments=>{obj(comments);for(const c of Object.values(comments)){obj(c);stringsRequired(c,['id','block','quote']);integer(c.from);integer(c.to,c.from);booleans(c,['resolved','orphan']);unique(c.messages,m=>stringsRequired(m,['author','at','text']));}});
  }else{
    obj(d.size);range(d.size.width,1,100000);range(d.size.height,1,100000);obj(d.theme);stringsRequired(d.theme,['background','color','accent','fontFamily']);strings(d.theme,['headingFamily']);
    optional(d.theme,'palette',stringMap);optional(d.theme,'chartPalette',p=>list(p,str));optional(d.theme,'table',tableStyle);
    unique(d.slides,slide,10000);if(!d.slides.length)bad();optional(d,'layouts',l=>unique(l,slide,10000));
    optional(d,'present',p=>{obj(p);booleans(p,['numberHidden','slideNumber','controls','progress']);numbers(p,['morphSeconds']);});
  }
}
