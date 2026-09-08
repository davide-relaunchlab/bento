import assert from 'node:assert/strict';
import {test} from 'node:test';
import {startTheme,onThemeChange} from '../../kernel/src/theme.ts';

test('a theme change in another editor frame updates the suite without changing document data',()=>{
 const saved=new Map<string,string>([['bento-theme','dark']]);
 const windowEvents=new EventTarget();
 const root={dataset:{} as Record<string,string>,style:{colorScheme:''}};
 const mocks={window:windowEvents,document:{documentElement:root},localStorage:{getItem:(k:string)=>saved.get(k)??null},matchMedia:()=>({matches:false,addEventListener(){}})};
 const descriptors=new Map(Object.keys(mocks).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const received:string[]=[];const unsubscribe=onThemeChange(t=>received.push(t));
 try{
  for(const [key,value]of Object.entries(mocks))Object.defineProperty(globalThis,key,{configurable:true,value});
  assert.equal(startTheme(),'dark');
  const storage=(key:string|null)=>windowEvents.dispatchEvent(Object.assign(new Event('storage'),{key}));
  saved.set('bento-theme','light');storage('unrelated');
  assert.equal(root.dataset.theme,'dark');
  storage('bento-theme');assert.equal(root.dataset.theme,'light');assert.equal(root.style.colorScheme,'light');
  saved.clear();storage(null);assert.equal(root.dataset.theme,'light');
  assert.deepEqual(received,['dark','light','light']);
 }finally{
  unsubscribe();for(const [key,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});
