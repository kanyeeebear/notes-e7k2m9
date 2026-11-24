import * as THREE from './vendor/three-r170/three.module.min.js';

export const GLASS = Object.freeze({
  double28: {name:'2 стекла · 28 мм', formula:'6–16–6', panes:[6,6], gaps:[16]},
  triple44: {name:'3 стекла · 44 мм', formula:'4–16–4–16–4', panes:[4,4,4], gaps:[16,16]},
  triple52: {name:'3 стекла · 52 мм', formula:'6–18–6–16–6', panes:[6,6,6], gaps:[18,16]}
});
export const LIMITS = Object.freeze({width:[600,1600], height:[800,2400]});
export const DEFAULTS = Object.freeze({width:1200,height:1500,glass:'triple44',hinge:'left'});

export function glassThickness(key){
  const g=GLASS[key];
  if(!g)throw new RangeError('Unknown glazing');
  return [...g.panes,...g.gaps].reduce((a,b)=>a+b,0);
}
export function validSize(value,axis){
  const bounds=LIMITS[axis];
  return !!bounds && Number.isFinite(value) && value>=bounds[0] && value<=bounds[1];
}

function rectPath(w,h){
  return new THREE.Shape().moveTo(-w/2,-h/2).lineTo(w/2,-h/2).lineTo(w/2,h/2).lineTo(-w/2,h/2).closePath();
}
function ringGeometry(w,h,face,depth,bevel=.001){
  const shape=rectPath(w,h),hole=new THREE.Path();
  const iw=w-2*face,ih=h-2*face;
  hole.moveTo(-iw/2,-ih/2).lineTo(-iw/2,ih/2).lineTo(iw/2,ih/2).lineTo(iw/2,-ih/2).closePath();
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:bevel>0,bevelSize:bevel,bevelOffset:-bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:1});
}

export function createMaterials(){
  return {
    aluminum:new THREE.MeshStandardMaterial({color:0x58636c,metalness:.68,roughness:.32}),
    bead:new THREE.MeshStandardMaterial({color:0x68737c,metalness:.65,roughness:.3}),
    thermal:new THREE.MeshStandardMaterial({color:0x343a3c,metalness:.02,roughness:.85}),
    rubber:new THREE.MeshStandardMaterial({color:0x20272a,metalness:0,roughness:.92}),
    hardware:new THREE.MeshStandardMaterial({color:0xbfc7ce,metalness:.88,roughness:.24}),
    glass:new THREE.MeshPhysicalMaterial({color:0xb5d9e1,metalness:.06,roughness:.08,transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide,clearcoat:1,clearcoatRoughness:.06}),
    spacer:new THREE.MeshStandardMaterial({color:0x727c7f,metalness:.72,roughness:.42}),
    edge:new THREE.LineBasicMaterial({color:0x81949c,transparent:true,opacity:.42}),
    glassEdge:new THREE.LineBasicMaterial({color:0x668d96,transparent:true,opacity:.65})
  };
}

export function buildWindow(params,materials){
  if(!validSize(params.width,'width')||!validSize(params.height,'height'))throw new RangeError('Invalid window dimensions');
  if(!['left','right'].includes(params.hinge))throw new RangeError('Invalid hinge side');
  const glazing=GLASS[params.glass];if(!glazing)throw new RangeError('Invalid glass');
  const width=params.width/1000,height=params.height/1000,sw=width-.104,sh=height-.104;
  const root=new THREE.Group();root.name='Window';
  const fixed=new THREE.Group();fixed.name='Fixed frame';fixed.position.y=height/2;root.add(fixed);
  const pivot=new THREE.Group();pivot.name='Opening pivot';root.add(pivot);
  const sash=new THREE.Group();sash.name='Operable sash';pivot.add(sash);
  const glassGroup=new THREE.Group();glassGroup.name='Insulating glass';sash.add(glassGroup);

  function addMesh(parent,geo,mat,name,x=0,y=0,z=0,edges=false){
    const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);
    if(edges){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo,32),materials.edge);m.add(e);}
    return m;
  }
  function ring(parent,w,h,face,depth,z,mat,name,bevel=.001){return addMesh(parent,ringGeometry(w,h,face,depth,bevel),mat,name,0,0,z,true);}
  function box(parent,w,h,d,x,y,z,mat,name){return addMesh(parent,new THREE.BoxGeometry(w,h,d),mat,name,x,y,z);}

  ring(fixed,width,height,.066,.027,-.041,materials.aluminum,'Exterior frame shell');
  ring(fixed,width-.012,height-.012,.050,.028,-.014,materials.thermal,'Frame thermal break',0);
  ring(fixed,width,height,.072,.027,.014,materials.aluminum,'Interior frame shell');
  ring(fixed,sw+.006,sh+.006,.006,.007,.039,materials.rubber,'Frame weather seal',0);
  ring(fixed,width-.020,height-.020,.015,.005,.041,materials.bead,'Frame reveal');

  ring(sash,sw,sh,.058,.022,-.018,materials.aluminum,'Exterior sash shell');
  ring(sash,sw-.008,sh-.008,.047,.018,.004,materials.thermal,'Sash thermal break',0);
  ring(sash,sw,sh,.058,.026,.022,materials.aluminum,'Interior sash shell');
  ring(sash,sw-.100,sh-.100,.012,.010,.029,materials.bead,'Glazing bead');
  ring(sash,sw-.121,sh-.121,.003,.003,.027,materials.rubber,'Inner glazing gasket',0);
  ring(sash,sw-.112,sh-.112,.004,.003,-.020,materials.rubber,'Outer glazing gasket',0);

  const gw=sw-.106,gh=sh-.106,total=glassThickness(params.glass)/1000;
  let z=.026-total;
  glazing.panes.forEach((mm,index)=>{
    const thickness=mm/1000;
    const pane=addMesh(glassGroup,new THREE.BoxGeometry(gw,gh,thickness),materials.glass,'Glass pane '+(index+1),0,0,z+thickness/2);
    pane.castShadow=false;pane.receiveShadow=false;pane.renderOrder=2+index;
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(pane.geometry),materials.glassEdge);pane.add(edge);
    z+=thickness;
    if(index<glazing.gaps.length){const gap=glazing.gaps[index]/1000;ring(glassGroup,gw-.004,gh-.004,.006,gap,z,materials.spacer,'Spacer '+(index+1),0);z+=gap;}
  });

  const hingeX=(params.hinge==='left'?-1:1)*sw/2,hingeZ=.066;
  for(const y of [-sh/2+.16,sh/2-.16]){
    addMesh(fixed,new THREE.CylinderGeometry(.010,.010,.095,18),materials.hardware,'Hinge barrel',hingeX,y,hingeZ);
    box(fixed,.035,.075,.006,hingeX+(params.hinge==='left'?-.015:.015),y,.048,materials.hardware,'Fixed hinge plate');
  }
  const handle=new THREE.Group();handle.name='Handle';handle.position.set(-Math.sign(hingeX)*(sw/2-.032),-.015,.052);sash.add(handle);
  box(handle,.029,.105,.008,0,0,0,materials.hardware,'Handle plate');
  const spindle=addMesh(handle,new THREE.CylinderGeometry(.009,.009,.029,16),materials.hardware,'Handle spindle',0,0,.018);spindle.rotation.x=Math.PI/2;
  const leverPivot=new THREE.Group();leverPivot.position.z=.033;handle.add(leverPivot);
  const lever=addMesh(leverPivot,new THREE.CylinderGeometry(.009,.009,.116,16),materials.hardware,'Handle lever',0,-.050,0);
  const cap=addMesh(leverPivot,new THREE.SphereGeometry(.009,12,8),materials.hardware,'Handle end',0,-.108,0);

  function pose(mode,angle,handleAngle=mode==='tilt'?180:mode==='turn'?90:0){
    pivot.rotation.set(0,0,0);
    if(mode==='tilt'){
      pivot.position.set(0,.052,hingeZ);sash.position.set(0,sh/2,.020-hingeZ);pivot.rotation.x=THREE.MathUtils.degToRad(angle);
    }else{
      pivot.position.set(hingeX,height/2,hingeZ);sash.position.set(-hingeX,0,.020-hingeZ);pivot.rotation.y=Math.sign(hingeX)*THREE.MathUtils.degToRad(mode==='turn'?angle:0);
    }
    leverPivot.rotation.z=Math.sign(hingeX)*THREE.MathUtils.degToRad(handleAngle);
    root.updateMatrixWorld(true);
  }
  function dispose(){root.traverse(o=>{if(o.geometry)o.geometry.dispose();});root.removeFromParent();}
  pose('closed',0);
  return {root,fixed,sash,pivot,glassGroup,width,height,sashWidth:sw,sashHeight:sh,glassWidth:gw,glassHeight:gh,glassThickness:total,pose,dispose};
}
