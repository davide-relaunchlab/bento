import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FUNCTIONS,evaluate} from '../../dash/src/formula.ts';
import {FUNCTION_ARGS,formulaContext,completeFunction,functionSuggestions} from '../../dash/src/formulahints.ts';

test('suggestions cover exactly the running engine and describe supported arities',()=>{
  assert.deepEqual(Object.keys(FUNCTION_ARGS).sort(),FUNCTIONS);
  assert.equal(functionSuggestions('')[0],'SUM');
  assert.deepEqual(functionSuggestions('sum'),['SUM','SUMIF','SUMIFS','SUMPRODUCT']);
  assert.deepEqual(FUNCTION_ARGS.SUM,['range']);
  assert.equal(FUNCTION_ARGS.XLOOKUP.length,4);
  assert.equal(FUNCTION_ARGS.CEILING.length,1);
  assert.deepEqual(FUNCTION_ARGS.TODAY,[]);
});

test('formula completion preserves references, strings, nesting and existing parentheses',()=>{
  const ctx=(s:string)=>formulaContext(s,s.length);
  assert.equal(ctx('plain').completion,null);
  assert.equal(ctx('=SUM(A1:A3').completion,null);
  assert.equal(ctx('=IF(A1,"SUM').completion,null);
  assert.deepEqual(ctx('=IF(A1,"a,b",SUM(B1:B3').call,{name:'SUM',argument:0});
  assert.deepEqual(ctx('=IF(A1,"a,b",SUM(B1:B3),').call,{name:'IF',argument:3});
  assert.deepEqual(ctx('=IF("a""b,c",[Gross, Net],').call,{name:'IF',argument:2});
  assert.deepEqual(ctx("=SUM('A,B'!A1,").call,{name:'SUM',argument:1});
  assert.equal(ctx("='SUM").completion,null);
  assert.equal(ctx('=Sheet!SUM').completion,null);
  assert.equal(ctx('=$SUM').completion,null);
  assert.equal(ctx('=S U').completion,null);
  assert.equal(formulaContext('=MAX1+1',4).completion,null);
  assert.equal(formulaContext('=SUM!A1',4).completion,null);
  assert.equal(ctx('=LOG1').completion?.prefix,'LOG1');
  assert.deepEqual(completeFunction('=LOG1',5,'LOG10'),{text:'=LOG10(',caret:7});
  assert.deepEqual(completeFunction('=su(A1:A2)',3,'SUM'),{text:'=SUM(A1:A2)',caret:5});
  assert.deepEqual(completeFunction('=IF(A1,AV,0)',9,'AVERAGE'),{text:'=IF(A1,AVERAGE(,0)',caret:15});
  assert.deepEqual(completeFunction('=TO',3,'TODAY'),{text:'=TODAY()',caret:8});
  assert.equal(formulaContext('SU',2,true).completion?.prefix,'SU');
  const completed=completeFunction('=SU',3,'SUM')!;
  assert.equal(evaluate(completed.text.slice(1)+'Value)',{n:1,cols:new Map([['Value',[12,8]]])})[0],20);
});
