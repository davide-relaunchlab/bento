import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerI18n,locale,setLocale,t} from '../../kernel/src/i18n.ts';
import {PACKED,PACKED_LOCALES} from '../../dash/src/i18n/packed.ts';
import {ot} from '../client/i18n.ts';
import * as slides from '../../slides/src/i18n/packed.ts';
import * as type from '../../type/src/i18n/packed.ts';
import * as spaces from '../../spaces/src/i18n/packed.ts';

test('every offered language survives a fresh locale resolution on an Italian browser',()=>{
  const storageDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const saved=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>saved.get(key)??null,
    setItem:(key:string,value:string)=>saved.set(key,value),
    removeItem:(key:string)=>saved.delete(key),
  }});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{language:'it-IT'}});
  const boot=()=>registerI18n({packed:{locales:PACKED_LOCALES,table:PACKED},choices:[]});
  try{
    boot();
    assert.equal(locale(),'it','an unset preference follows the browser');
    for(const code of [...PACKED_LOCALES,'en']){
      setLocale(code);
      const label=t('Save'),officeLabel=ot('My files');
      boot(); // Drops the in-memory locale, as a reload or editor registration does.
      assert.equal(locale(),code,`${code} must survive reload`);
      assert.equal(t('Save'),label);
      assert.equal(ot('My files'),officeLabel);
      if(code!=='en')assert.notEqual(officeLabel,'My files');
    }
    assert.equal(t('Save'),'Save');
    assert.equal(ot('My files'),'My files');
    // The same saved preference is read by every editor and standalone app.
    for(const [app,catalog]of Object.entries({dash:{PACKED,PACKED_LOCALES},slides,type,spaces})){
      const register=()=>registerI18n({packed:{locales:catalog.PACKED_LOCALES,table:catalog.PACKED},choices:[]});
      for(const code of [...catalog.PACKED_LOCALES,'en']){
        register();
        setLocale(code);
        const before=t('Save');
        register();
        assert.equal(locale(),code,`${app}: ${code} must survive registration`);
        assert.equal(t('Save'),before);
      }
    }
  }finally{
    for(const [key,descriptor]of [['localStorage',storageDescriptor],['navigator',navigatorDescriptor]] as const){
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);
      else Reflect.deleteProperty(globalThis,key);
    }
    boot();
  }
});
