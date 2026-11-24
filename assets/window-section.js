import * as THREE from './vendor/three-r170/three.module.min.js';
import {GLASS,PROFILE,glassThickness} from './window-model.js?v=3';

export const SECTION_PARTS={
  all:{name:'Весь нижний узел',text:'Вертикальный срез закрытого окна. Видны рама, створка и край стеклопакета. Поверни фрагмент, чтобы рассмотреть его с торца.'},
  profile:{name:'Алюминиевый профиль',text:'Полые металлические части рамы и створки. Внутри профиля находятся камеры; наружную и внутреннюю алюминиевые части соединяют термовставки.'},
  thermal:{name:'Терморазрыв',text:'Полиамидные планки между наружной и внутренней частями алюминия. В этом учебном срезе они выделяются жёлтым при выборе.'},
  glass:{name:'Стеклопакет',text:'Отдельные стёкла, камеры между ними и дистанционные рамки у края. Число стёкол и толщина берутся из выбранного стеклопакета.'},
  seals:{name:'Уплотнения',text:'Эластичные контуры у стекла и между рамой и створкой. Они закрывают зазоры между сопрягаемыми деталями.'},
  bead:{name:'Штапик',text:'Съёмная деталь со стороны помещения, удерживающая стеклопакет. В учебной модели его положение меняется вместе с толщиной пакета.'}
};

function profileShape(y0,y1,z0,z1,wall=0){
  const s=new THREE.Shape();s.moveTo(-z1,y0).lineTo(-z0,y0).lineTo(-z0,y1).lineTo(-z1,y1).closePath();
  if(wall){const h=new THREE.Path();h.moveTo(-z1+wall,y0+wall).lineTo(-z1+wall,y1-wall).lineTo(-z0-wall,y1-wall).lineTo(-z0-wall,y0+wall).closePath();s.holes.push(h);}
  return s;
}

export function buildSection(params,baseMaterials){
  const root=new THREE.Group();root.name='Lower-window section';
  const length=.220,top=.245,total=glassThickness(params.glass)/1000,front=PROFILE.glassOutsideZ+total;
  const groups={},materialSet=new Set(),baseColors=new Map();
  Object.keys(SECTION_PARTS).filter(k=>k!=='all').forEach(k=>{groups[k]=new THREE.Group();groups[k].name=k;root.add(groups[k]);});
  function material(base){const m=base.clone();materialSet.add(m);baseColors.set(m,{color:m.color.clone(),opacity:m.opacity});return m;}
  const metal=material(baseMaterials.aluminum),thermal=material(baseMaterials.thermal),glass=material(baseMaterials.glass),seal=material(baseMaterials.rubber),support=material(baseMaterials.rubber),bead=material(baseMaterials.bead),spacer=material(baseMaterials.spacer);
  glass.opacity=.38;baseColors.get(glass).opacity=.38;
  const edgeMat=baseMaterials.edge.clone();materialSet.add(edgeMat);edgeMat.opacity=.75;
  function extrude(key,shape,mat,name,span=length){
    const geo=new THREE.ExtrudeGeometry(shape,{depth:span,bevelEnabled:false,steps:1,curveSegments:1});
    const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.rotation.y=Math.PI/2;mesh.position.x=-span/2;mesh.castShadow=mat!==glass;mesh.receiveShadow=mat!==glass;
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo,25),edgeMat);mesh.add(edge);groups[key].add(mesh);return mesh;
  }
  for(const [name,p,offset]of [['Exterior frame',PROFILE.frameOuter,0],['Interior frame',PROFILE.frameInner,0],['Exterior sash',PROFILE.sashOuter,PROFILE.sashOffset],['Interior sash',PROFILE.sashInner,PROFILE.sashOffset]]){
    extrude('profile',profileShape(offset,offset+p.face,p.z,p.z+p.depth,PROFILE.wall),metal,name);
  }
  for(const [a,b]of PROFILE.strips){
    extrude('thermal',profileShape(a,b,-.014,.014),thermal,'Frame thermal strip');
    extrude('thermal',profileShape(PROFILE.sashOffset+a,PROFILE.sashOffset+b,.024,.042),thermal,'Sash thermal strip');
  }
  let z=PROFILE.glassOutsideZ;
  GLASS[params.glass].panes.forEach((mm,i)=>{
    const pane=extrude('glass',profileShape(PROFILE.glassInset,top,z,z+mm/1000),glass,'Glass pane '+(i+1));pane.renderOrder=i+2;
    z+=mm/1000;
    const gap=GLASS[params.glass].gaps[i];if(gap){extrude('glass',profileShape(.107,.113,z,z+gap/1000),spacer,'Spacer '+(i+1));z+=gap/1000;}
  });
  extrude('glass',profileShape(.101,.105,PROFILE.glassOutsideZ,front),support,'Setting block',.060);
  extrude('seals',profileShape(.050,.052,.035,.046),seal,'Frame weather seal');
  extrude('seals',profileShape(.108,.112,PROFILE.glassOutsideZ-.003,PROFILE.glassOutsideZ),seal,'Exterior glass gasket');
  extrude('seals',profileShape(.1125,.1155,front+.001,front+.004),seal,'Interior glass gasket');
  extrude('bead',profileShape(.102,.114,front+.003,front+.013),bead,'Glazing bead');
  function highlight(key){
    for(const [m,v]of baseColors){m.color.copy(v.color);m.opacity=v.opacity;if(m.emissive)m.emissive.setHex(0);}
    if(key!=='all'&&groups[key])groups[key].traverse(o=>{if(o.isMesh){o.material.color.setHex(0xe4b82f);if(o.material.emissive)o.material.emissive.setHex(0x352600);if(o.material.transparent)o.material.opacity=.65;}});
  }
  root.updateMatrixWorld(true);
  function dispose(){root.traverse(o=>{if(o.geometry)o.geometry.dispose();});materialSet.forEach(m=>m.dispose());root.removeFromParent();}
  return {root,groups,length,height:top,glassThickness:total,glassBack:PROFILE.glassOutsideZ,glassFront:front,target:new THREE.Vector3(0,top*.48,.015),highlight,dispose};
}
