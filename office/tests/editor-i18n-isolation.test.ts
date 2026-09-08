import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerI18n,setLocale,t} from '../../kernel/src/i18n.ts';

test('loading suite translations does not replace the active editor catalog',async()=>{
 registerI18n({packed:{locales:['it'],table:{'Editor-only command':['Comando del motore']}},choices:[]});
 setLocale('it');
 const {ot}=await import('../client/i18n.ts');
 assert.equal(t('Editor-only command'),'Comando del motore');
 assert.equal(ot('Document'),'Documento');
});


test('a spreadsheet boot restores its own catalog after another format was loaded',async()=>{
 const {activateI18n}=await import('../../dash/src/i18n.ts');
 registerI18n({catalogs:{it:{'Save':'Catalogo estraneo'}},choices:[]});
 setLocale('it');assert.equal(t('Save'),'Catalogo estraneo');
 activateI18n();setLocale('it');assert.equal(t('Save'),'Salva');assert.equal(t('Undo'),'Annulla');
});
