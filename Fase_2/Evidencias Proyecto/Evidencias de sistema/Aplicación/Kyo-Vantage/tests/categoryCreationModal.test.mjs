import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

function load(path, globals) {
  const source=readFileSync(new URL(path,import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'');
  const output=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  vm.runInNewContext(output,{exports,require:()=>jsxRuntime,Error,...globals});
  return exports;
}

test('create category is the final dropdown action and preserves the current selection',()=>{
  let created=0;const selected=[];const Select=()=>null;
  const {TransactionSelect}=load('../src/features/wallet/components/transaction/TransactionSelect.tsx',{Select,SelectItem:()=>null,Plus:()=>null});
  const tree=TransactionSelect({label:'Categoría',value:'existing',options:[{id:'existing',name:'Salud',icon:null}],onChange:id=>selected.push(id),onCreate:()=>created++,placeholder:''});
  const select=tree.props.children.find(child=>child.type===Select);
  assert.equal(select.props.children.at(-1).key,'__create_category__');
  select.props.onSelectionChange(new Set(['__create_category__']));
  assert.equal(created,1);assert.equal(selected.length,0);
  assert.equal(select.props.selectedKeys[0],'existing');
});

for(const fail of [false,true]) test(`inline category creation ${fail?'keeps errors in the modal':'selects saved category and invalidates scoped cache'}`,async()=>{
  let outer=true;let stateIndex=0;const changes=[];let closed=false;let payload;let invalidated;
  const icons=Object.fromEntries('Tag ShoppingCart Coffee Home Car Zap Heart Gift Briefcase GraduationCap Monitor Music Plane Dumbbell Wine Baby Gamepad2 Wrench'.split(' ').map(key=>[key,()=>null]));
  const {CategorySelect}=load('../src/features/budget/components/CategorySelect.tsx',{
    ...icons,useState:initial=>{if(outer)return [true,()=>{}];const values=[' Viajes ','Plane',false,''];return [values[stateIndex++],value=>changes.push(value)];},
    createPortal:node=>node,document:{body:{}},TransactionSelect:()=>null,AppModal:()=>null,
    useAuth:()=>({auth:{id:'user'}}),budgetQueryKeys:{categories:id=>['private',id,'budget','categories']},queryKeys:{budget:{categories:()=>['budget','categories']}},
    usePrivateMutation:keys=>({runMutation:async operation=>{invalidated=keys;return operation();}}),
    addUserCustomCategory:async(...args)=>{payload=args;if(fail)throw new Error('Límite alcanzado');return {id:'new-category'};}
  });
  const tree=CategorySelect({type:'expense',label:'Categoría',value:'old',options:[],placeholder:'',onChange:id=>changes.push(id)});
  const portal=tree.props.children[1];const modalElement=portal.props.children;
  outer=false;
  const modal=modalElement.type({...modalElement.props,onClose:()=>closed=true});
  let stopped=false;
  await modal.props.children.props.onSubmit({preventDefault(){},stopPropagation(){stopped=true;}});
  assert.equal(stopped,true);assert.deepEqual(payload,['Viajes','expense','Plane']);
  assert.equal(invalidated[0].join('/'),'private/user/budget/categories');
  assert.equal(changes.includes('new-category'),!fail);
  if(fail){assert.equal(changes.includes('Límite alcanzado'),true);assert.equal(closed,false);}
});
