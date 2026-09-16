import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyEntity } from '../js/domain/schema.js';
import { planEntityCascade, planMapVersionCascade, planWorkspaceDelete, cleanupPlotBeatLinks } from '../worker/lib/cascade.js';
import { handleApi } from '../worker/index.js';

const stamp='2026-09-15T20:00:00.000Z';
const later='2026-09-15T21:00:00.000Z';
function entity(type,id,name=id,fields={}){ return {...createEmptyEntity(type),id,name,fields,createdAt:stamp,updatedAt:stamp}; }
function snapshot(overrides={}){ return {entities:[],relations:[],media:[],settings:[],clues:[],reveals:[],knowledge:[],mapVersions:[],mapMarkers:[],workspace:[],...overrides}; }
function prepared(sql,args=[]){ return {sql,args,bind(...next){return prepared(sql,next);}}; }

function settingsRow(updatedAt=later){ return {key:'project',value_json:JSON.stringify({name:'Current'}),updated_at:updatedAt}; }

test('entity cascade scrubs reverse references that are not ownership endpoints',()=>{
  const era=entity('era','era-1','Old Era');
  const a=entity('lore','a'),b=entity('lore','b');
  const book=entity('book','book-1');
  const marker={id:'marker-1',mapVersionId:'mv',locationId:'loc',x:50,y:50,label:'',category:'',icon:'',customMediaId:null,tags:[],activeFrom:'',activeTo:'',layerId:null,factionId:null,bookIds:['book-1'],storyRelevance:'',active:true,createdAt:stamp,updatedAt:stamp};
  const relation={id:'r1',fromId:'a',toId:'b',type:'related_to',status:'Canon',eraId:'era-1',createdAt:stamp,updatedAt:stamp};
  const planEra=planEntityCascade(snapshot({entities:[era,a,b],relations:[relation]}),'era-1',later);
  assert.equal(planEra.updates.relations.length,1);
  assert.equal(planEra.updates.relations[0].eraId,null);

  const planBook=planEntityCascade(snapshot({entities:[book,entity('location','loc'),entity('map','map')],mapVersions:[{id:'mv',mapId:'map',mediaId:'media',createdAt:stamp,updatedAt:stamp}],mapMarkers:[marker],media:[{id:'media',name:'m',title:'m',mime:'image/png',size:1,r2Key:'k',tags:[],entityIds:[],createdAt:stamp,updatedAt:stamp}]}),'book-1',later);
  assert.deepEqual(planBook.updates.mapMarkers[0].bookIds,[]);
});

test('entity cascade removes secondary mystery links and Series protagonist arrays',()=>{
  const targetMystery=entity('mystery','m1'),primaryMystery=entity('mystery','m2');
  const clue={id:'c1',mysteryId:'m2',mysteryIds:['m1'],label:'',kind:'Clue',description:'',storyEntityId:null,visibility:'',firstRead:'',trueInterpretation:'',order:'',createdAt:stamp,updatedAt:stamp};
  const planMystery=planEntityCascade(snapshot({entities:[targetMystery,primaryMystery],clues:[clue]}),'m1',later);
  assert.deepEqual(planMystery.deletes.clues,[]);
  assert.deepEqual(planMystery.updates.clues[0].mysteryIds,[]);

  const character=entity('character','char-1'),series=entity('trilogy','series','Series',{protagonistIds:['char-1']});
  const planCharacter=planEntityCascade(snapshot({entities:[character,series]}),'char-1',later);
  assert.deepEqual(planCharacter.updates.entities[0].fields.protagonistIds,[]);
});

test('map version cascade preserves shared media and cleans cross-version workspace references',()=>{
  const map1=entity('map','map-1'),map2=entity('map','map-2'),loc=entity('location','loc');
  const versions=[
    {id:'v1',mapId:'map-1',mediaId:'media-1',createdAt:stamp,updatedAt:stamp},
    {id:'v2',mapId:'map-2',mediaId:'media-2',createdAt:stamp,updatedAt:stamp}
  ];
  const media=[
    {id:'media-1',name:'a',title:'a',mime:'image/png',size:1,r2Key:'a',tags:[],entityIds:['map-1'],createdAt:stamp,updatedAt:stamp},
    {id:'media-2',name:'b',title:'b',mime:'image/png',size:1,r2Key:'b',tags:[],entityIds:['map-2'],createdAt:stamp,updatedAt:stamp}
  ];
  const markers=[{id:'marker-1',mapVersionId:'v1',locationId:'loc',x:1,y:1,tags:[],bookIds:[],active:true,createdAt:stamp,updatedAt:stamp}];
  const workspace=[
    {id:'layer-dead',kind:'mapLayer',title:'',data:{mapVersionId:'v1'},createdAt:stamp,updatedAt:stamp},
    {id:'layer-shared',kind:'mapLayer',title:'',data:{mapVersionId:'v2',mediaId:'media-1'},createdAt:stamp,updatedAt:stamp},
    {id:'route-other',kind:'mapRoute',title:'',data:{mapVersionId:'v2',characterId:'char',markerIds:['marker-1']},createdAt:stamp,updatedAt:stamp}
  ];
  const plan=planMapVersionCascade(snapshot({entities:[map1,map2,loc,entity('character','char')],mapVersions:versions,media,mapMarkers:markers,workspace}),'v1',later);
  assert.deepEqual(plan.deletes.media,[],'shared media must survive');
  assert.ok(plan.deletes.workspace.includes('layer-dead'));
  assert.deepEqual(plan.updates.workspace.find(item=>item.id==='route-other').data.markerIds,[]);
});

test('workspace delete cascades structural workspace children and clears marker layers',()=>{
  const workspace=[
    {id:'thread',kind:'plotThread',data:{},createdAt:stamp,updatedAt:stamp},
    {id:'beat',kind:'plotBeat',data:{threadId:'thread'},createdAt:stamp,updatedAt:stamp},
    {id:'layer',kind:'mapLayer',data:{mapVersionId:'v'},createdAt:stamp,updatedAt:stamp}
  ];
  const threadPlan=planWorkspaceDelete(workspace,[],'thread',later);
  assert.deepEqual(new Set(threadPlan.deletes),new Set(['thread','beat']));
  const layerPlan=planWorkspaceDelete(workspace,[{id:'marker',layerId:'layer',updatedAt:stamp}],'layer',later);
  assert.equal(layerPlan.markerUpdates[0].layerId,null);
});

test('deleting clues or reveals clears optional Plot Beat links instead of leaving dangling ids',()=>{
  const workspace=[{id:'beat',kind:'plotBeat',data:{threadId:'thread',sceneId:'scene',clueId:'clue',revealId:'reveal'},createdAt:stamp,updatedAt:stamp}];
  const clue=cleanupPlotBeatLinks(workspace,{clueId:'clue'},later)[0];
  assert.equal(clue.data.clueId,null);
  assert.equal(clue.data.revealId,'reveal');
  const reveal=cleanupPlotBeatLinks([clue],{revealId:'reveal'},later)[0];
  assert.equal(reveal.data.revealId,null);
});

test('existing records require a base version before mutation',async()=>{
  const DB={
    prepare(sql){
      return {
        ...prepared(sql),
        bind(...args){
          const stmt=prepared(sql,args);
          stmt.first=async()=>sql.startsWith('SELECT * FROM settings WHERE key=')?settingsRow():null;
          stmt.all=async()=>({results:[]});
          return stmt;
        },
        first:async()=>null,all:async()=>({results:[]})
      };
    },
    async batch(){ throw new Error('missing precondition must not reach D1 batch'); }
  };
  const request=new Request('https://unwritten.test/api/store/settings/project',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({key:'project',value:{name:'Incoming'}})});
  await assert.rejects(()=>handleApi(request,{DB},{role:'owner',email:'owner@example.test'}),error=>error?.status===428&&/base record version/i.test(error.message));
});
