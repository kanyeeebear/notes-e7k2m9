import * as THREE from './vendor/three-r170/three.module.min.js';
import {OrbitControls} from './vendor/three-r170/OrbitControls.js';
import {RoomEnvironment} from './vendor/three-r170/RoomEnvironment.js';
import {buildWindow,createMaterials,DEFAULTS,GLASS,LIMITS,validSize,fitDistanceForBox} from './window-model.js?v=3';
import {buildSection,SECTION_PARTS} from './window-section.js?v=1';
import {drawingSVG,printSheet,downloadDrawing} from './window-drawing.js?v=1';

export function start(){
  const $=id=>document.getElementById(id),viewer=$('viewer'),mount=$('canvas-mount');
  const params={...DEFAULTS};
  const opening={mode:'closed',pending:null,angle:0,target:0,handle:0};
  let activeView='window',drawingSide='inside',sectionPart='all';
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.002,60);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);
  const canvas=renderer.domElement;
  canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Объёмная модель окна. Перетаскивай для вращения. Стрелки вращают, плюс и минус меняют масштаб.');

  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04);
  scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xeaf5ff,0x88948d,2.1));
  const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(-3,5,4);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3,right:3,top:4,bottom:-2,near:.1,far:14});key.shadow.bias=-.0002;key.shadow.normalBias=.012;scene.add(key);
  const fill=new THREE.DirectionalLight(0xe4f1ff,1.6);fill.position.set(4,2,-3);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0xe9eeed,roughness:1,metalness:0}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.004;floor.receiveShadow=true;scene.add(floor);

  const materials=createMaterials();let model=buildWindow(params,materials),sectionModel=buildSection(params,materials);scene.add(model.root,sectionModel.root);sectionModel.root.visible=false;
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.45;controls.maxDistance=12;controls.maxPolarAngle=Math.PI-.08;controls.minPolarAngle=.08;controls.enablePan=false;
  let dirty=true,rebuildPending=false,refitPending=false,previousTime=0,announcePending=false,automaticView=true;
  let dimensionLines=null;
  const measureMaterial=new THREE.LineBasicMaterial({color:0x849299,transparent:true,opacity:.65,depthTest:false});
  const labelPositions={width:new THREE.Vector3(),height:new THREE.Vector3()};
  const pretty=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});

  function isDark(){const choice=document.documentElement.dataset.theme;return choice?choice==='dark':matchMedia('(prefers-color-scheme: dark)').matches;}
  function theme(){
    const dark=isDark(),background=dark?0x17242c:0xe9eeed;
    scene.background=new THREE.Color(background);scene.fog=new THREE.Fog(background,8,24);floor.material.color.setHex(background);
    measureMaterial.color.setHex(dark?0x9cabb1:0x849299);
    $('theme-toggle').setAttribute('aria-label',dark?'Светлая тема':'Тёмная тема');dirty=true;
  }
  $('theme-toggle').addEventListener('click',()=>{const choice=isDark()?'light':'dark';document.documentElement.dataset.theme=choice;try{localStorage.setItem('elwido-theme',choice);}catch{}theme();});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',theme);

  function activeRoot(){return activeView==='section'?sectionModel.root:model.root;}
  function activeTarget(){return activeView==='section'?sectionModel.target.clone():new THREE.Vector3(0,model.height*.48,0);}
  function fitDistance(direction){const box=new THREE.Box3().setFromObject(activeRoot());if(activeView==='section')box.expandByPoint(new THREE.Vector3(0,.285,.015));return fitDistanceForBox(box,controls.target,direction,camera.aspect,camera.fov,viewer.clientWidth,viewer.clientHeight);}
  function view(which){
    if(activeView==='drawing'){drawingSide=which==='outside'?'outside':'inside';updateDrawing();return;}
    controls.target.copy(activeTarget());
    const direction=activeView==='section'?(which==='inside'?new THREE.Vector3(1,.04,0):which==='outside'?new THREE.Vector3(-1,.04,0):new THREE.Vector3(1.7,.95,1.3)):(which==='inside'?new THREE.Vector3(0,.02,1):which==='outside'?new THREE.Vector3(0,.02,-1):new THREE.Vector3(1,.36,1.75));
    automaticView=true;camera.position.copy(controls.target).addScaledVector(direction.normalize(),fitDistance(direction));camera.lookAt(controls.target);controls.update();
    document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.camera===which?'true':'false'));
    dirty=true;
  }
  document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.camera)));
  $('reset-view').addEventListener('click',()=>view('oblique'));
  controls.addEventListener('change',()=>{dirty=true;});
  controls.addEventListener('start',()=>{automaticView=false;document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed','false'));});

  function dimensions(){
    if(dimensionLines){dimensionLines.geometry.dispose();scene.remove(dimensionLines);}
    if(activeView==='section'){
      const x=sectionModel.length/2+.006,y=.272,a=sectionModel.glassBack,b=sectionModel.glassFront;
      const coords=[x,y,a,x,y,b,x,y-.005,a,x,y+.005,a,x,y-.005,b,x,y+.005,b];
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));dimensionLines=new THREE.LineSegments(g,measureMaterial);scene.add(dimensionLines);
      labelPositions.width.set(x,y,(a+b)/2);$('dimension-width').textContent=Math.round(sectionModel.glassThickness*1000)+' мм';return;
    }
    const w=model.width,h=model.height,z=.12,y=-.105,x=-w/2-.11;
    const coords=[-w/2,y,z,w/2,y,z,-w/2,y-.025,z,-w/2,y+.025,z,w/2,y-.025,z,w/2,y+.025,z,x,0,z,x,h,z,x-.025,0,z,x+.025,0,z,x-.025,h,z,x+.025,h,z];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));dimensionLines=new THREE.LineSegments(g,measureMaterial);scene.add(dimensionLines);
    labelPositions.width.set(0,y,z);labelPositions.height.set(x,h/2,z);
    $('dimension-width').textContent=pretty.format(params.width)+' мм';$('dimension-height').textContent=pretty.format(params.height)+' мм';
  }
  function projectLabels(){
    const place=(id,pos)=>{const v=pos.clone().project(camera),el=$(id),x=(v.x*.5+.5)*viewer.clientWidth,y=(-v.y*.5+.5)*viewer.clientHeight;
      el.hidden=v.z>1||x<25||x>viewer.clientWidth-25||y<70||y>viewer.clientHeight-42;el.style.left=x+'px';el.style.top=y+'px';};
    if(activeView==='drawing'){['dimension-width','dimension-height','label-exterior','label-interior'].forEach(id=>$(id).hidden=true);return;}
    place('dimension-width',labelPositions.width);
    if(activeView==='window'){place('dimension-height',labelPositions.height);$('label-exterior').hidden=$('label-interior').hidden=true;}
    else{$('dimension-height').hidden=true;place('label-exterior',new THREE.Vector3(.025,.015,-.075));place('label-interior',new THREE.Vector3(.025,.015,.105));}
  }
  function updateDrawing(){
    $('drawing-screen').innerHTML=drawingSVG(params,drawingSide);$('print-sheet').innerHTML=printSheet(params);
    if(activeView==='drawing')document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.camera===drawingSide?'true':'false'));
  }
  function exportState(){const invalid=!!document.querySelector('[aria-invalid="true"]');$('print-drawing').disabled=invalid;$('download-dxf').disabled=invalid;$('download-pdf').disabled=invalid;}
  function workspace(which){
    if(!['window','section','drawing'].includes(which))return;
    activeView=which;document.body.dataset.view=which;
    document.querySelectorAll('#workspace-tabs button').forEach(b=>{const on=b.dataset.view===which;b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;});
    viewer.setAttribute('aria-labelledby','tab-'+which);
    model.root.visible=which==='window';sectionModel.root.visible=which==='section';controls.enabled=which!=='drawing';
    mount.hidden=which==='drawing';$('drawing-screen').hidden=which!=='drawing';$('drawing-actions').hidden=which!=='drawing';$('reset-view').hidden=which==='drawing';
    document.querySelector('.opening-group').hidden=which!=='window';$('section-inspector').hidden=which!=='section';$('drawing-inspector').hidden=which!=='drawing';
    document.querySelector('[data-camera="inside"]').textContent=which==='section'?'Торец':'Из комнаты';document.querySelector('[data-camera="outside"]').textContent=which==='section'?'Другой торец':'С улицы';
    controls.minDistance=which==='section'?.10:.45;controls.maxDistance=which==='section'?3:12;
    dimensions();dimensionLines.visible=which!=='drawing';projectLabels();resize();
    if(which==='drawing')updateDrawing();else view('oblique');
    if(which==='section'){$('section-description').textContent=SECTION_PARTS[sectionPart].text;sectionModel.highlight(sectionPart);}
    document.querySelector('.viewer-help').hidden=which==='drawing';
    $('opening-caption').textContent=which==='section'?'Нижний узел · срез закрытого окна':which==='drawing'?'Эскиз W-01':'Створка закрыта';
    history.replaceState(null,'','#'+which);dirty=true;
  }
  document.querySelectorAll('#workspace-tabs button').forEach(b=>{b.addEventListener('click',()=>workspace(b.dataset.view));b.addEventListener('keydown',e=>{const keys=['window','section','drawing'];let i=keys.indexOf(activeView);if(e.key==='ArrowRight')i=(i+1)%3;else if(e.key==='ArrowLeft')i=(i+2)%3;else if(e.key==='Home')i=0;else if(e.key==='End')i=2;else return;e.preventDefault();workspace(keys[i]);$('tab-'+keys[i]).focus();});});
  $('section-part').addEventListener('change',()=>{sectionPart=$('section-part').value;sectionModel.highlight(sectionPart);$('section-description').textContent=SECTION_PARTS[sectionPart].text;dirty=true;});
  $('download-dxf').addEventListener('click',()=>downloadDrawing(params));
  $('download-pdf').addEventListener('click',async()=>{
    const snapshot={...params};$('download-pdf').disabled=true;$('export-status').textContent='Готовлю PDF…';
    try{const module=await import('./window-pdf.js?v=1');await module.downloadPDF(snapshot);$('export-status').textContent='PDF готов.';}
    catch(error){console.error(error);$('export-status').textContent='Не удалось сформировать PDF. Попробуй ещё раз.';}
    finally{exportState();}
  });
  const pageTitle=document.title;
  $('print-drawing').addEventListener('click',()=>{updateDrawing();document.title=`ELWIDO-W01-${params.width}x${params.height}`;window.print();});
  window.addEventListener('beforeprint',updateDrawing);window.addEventListener('afterprint',()=>{document.title=pageTitle;});
  function summary(){
    $('size-summary').textContent=pretty.format(params.width)+' × '+pretty.format(params.height)+' мм';
    $('glass-summary').textContent=GLASS[params.glass].name;
    $('hinge-summary').textContent=params.hinge==='left'?'Петли слева':'Петли справа';
    dimensions();updateDrawing();
  }
  function announce(){
    $('model-announcement').textContent=`${params.width} на ${params.height} миллиметров. ${GLASS[params.glass].name}. ${$('opening-caption').textContent}.`;
  }
  function rebuild(){
    const oldTarget=controls.target.clone(),oldDirection=camera.position.clone().sub(oldTarget).normalize();
    model.dispose();sectionModel.dispose();model=buildWindow(params,materials);sectionModel=buildSection(params,materials);scene.add(model.root,sectionModel.root);model.root.visible=activeView==='window';sectionModel.root.visible=activeView==='section';sectionModel.highlight(sectionPart);model.pose(opening.mode,opening.angle,opening.handle);summary();dimensionLines.visible=activeView!=='drawing';
    if(refitPending&&activeView!=='drawing'){controls.target.copy(activeTarget());camera.position.copy(controls.target).addScaledVector(oldDirection,fitDistance(oldDirection));controls.update();}
    refitPending=false;rebuildPending=false;announcePending=true;dirty=true;
  }

  function syncMode(){
    const requested=opening.pending||opening.mode;
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===requested?'true':'false'));
    $('angle').disabled=opening.mode==='closed'||!!opening.pending;
    $('angle').max=opening.mode==='tilt'?'12':'90';$('angle').value=String(opening.target);
    $('mode-note').textContent=opening.mode==='closed'?'Выбери поворот или откидывание.':opening.mode==='turn'?'Створка поворачивается внутрь на боковых петлях.':'Низ створки остаётся у рамы, верх отходит внутрь.';
  }
  function requestMode(mode){
    if(!['closed','turn','tilt'].includes(mode))return;
    if(mode===opening.mode&&!opening.pending)return;
    opening.pending=mode;opening.target=0;syncMode();announcePending=true;dirty=true;
  }
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>requestMode(b.dataset.mode)));
  $('angle').addEventListener('input',()=>{opening.target=Number($('angle').value);announcePending=true;dirty=true;});

  for(const axis of ['width','height']){
    const field=$(axis),slider=$(axis+'-range'),error=$(axis+'-error');
    field.addEventListener('input',()=>{
      const value=field.value===''?NaN:Number(field.value);
      if(!validSize(value,axis)){field.setAttribute('aria-invalid','true');error.textContent=`Для этой модели: от ${LIMITS[axis][0]} до ${LIMITS[axis][1]} мм.`;exportState();return;}
      field.removeAttribute('aria-invalid');error.textContent='';exportState();params[axis]=value;slider.value=String(value);rebuildPending=true;refitPending=true;
    });
    slider.addEventListener('input',()=>{params[axis]=Number(slider.value);field.value=slider.value;field.removeAttribute('aria-invalid');error.textContent='';exportState();rebuildPending=true;refitPending=true;});
  }
  document.querySelectorAll('input[name=glass]').forEach(radio=>radio.addEventListener('change',()=>{params.glass=radio.value;rebuildPending=true;}));
  document.querySelectorAll('[data-hinge]').forEach(b=>b.addEventListener('click',()=>{
    params.hinge=b.dataset.hinge;Object.assign(opening,{mode:'closed',pending:null,angle:0,target:0,handle:0});
    document.querySelectorAll('[data-hinge]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));syncMode();rebuildPending=true;
  }));

  canvas.addEventListener('keydown',event=>{
    if(event.altKey||event.metaKey||event.ctrlKey)return;
    const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(event.key==='ArrowLeft')spherical.theta-=.12;else if(event.key==='ArrowRight')spherical.theta+=.12;
    else if(event.key==='ArrowUp')spherical.phi=Math.max(.08,spherical.phi-.10);else if(event.key==='ArrowDown')spherical.phi=Math.min(Math.PI-.08,spherical.phi+.10);
    else if(event.key==='+'||event.key==='=')spherical.radius=Math.max(controls.minDistance,spherical.radius*.9);
    else if(event.key==='-'||event.key==='−')spherical.radius=Math.min(controls.maxDistance,spherical.radius/ .9);
    else return;
    event.preventDefault();automaticView=false;camera.position.setFromSpherical(spherical).add(controls.target);controls.update();dirty=true;
  });

  let firstSize=true;
  function resize(){const width=viewer.clientWidth,height=viewer.clientHeight;if(!width||!height||activeView==='drawing')return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);if(firstSize){view('oblique');firstSize=false;}else if(automaticView){const d=camera.position.clone().sub(controls.target).normalize();camera.position.copy(controls.target).addScaledVector(d,fitDistance(d));controls.update();}dirty=true;}
  const observer=new ResizeObserver(resize);observer.observe(viewer);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();$('viewer-error').hidden=false;document.querySelector('.settings').inert=true;});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  theme();summary();syncMode();resize();$('loading').hidden=true;viewer.setAttribute('aria-busy','false');$('settings').inert=false;document.querySelector('.viewer-tools').inert=false;$('workspace-tabs').inert=false;workspace(['section','drawing'].includes(location.hash.slice(1))?location.hash.slice(1):'window');

  function tick(time){
    requestAnimationFrame(tick);
    const dt=previousTime?Math.min((time-previousTime)/1000,.05):.016;previousTime=time;
    if(document.hidden)return;
    if(rebuildPending)rebuild();
    let moving=Math.abs(opening.angle-opening.target)>.015||!!opening.pending;
    opening.angle=reducedMotion.matches?opening.target:THREE.MathUtils.lerp(opening.angle,opening.target,1-Math.exp(-dt*10));
    if(Math.abs(opening.angle-opening.target)<.015)opening.angle=opening.target;
    if(opening.pending&&opening.angle===0){opening.mode=opening.pending;opening.pending=null;opening.target=opening.mode==='turn'?70:opening.mode==='tilt'?10:0;syncMode();moving=true;}
    const desiredHandle=opening.mode==='closed'?0:opening.mode==='turn'?90:180;
    const previousHandle=opening.handle;opening.handle=reducedMotion.matches?desiredHandle:THREE.MathUtils.lerp(opening.handle,desiredHandle,1-Math.exp(-dt*14));
    if(Math.abs(opening.handle-desiredHandle)<.02)opening.handle=desiredHandle;
    moving=moving||Math.abs(previousHandle-opening.handle)>.001;
    if(moving||dirty){
      model.pose(opening.mode,opening.angle,opening.handle);
      if(automaticView&&activeView!=='drawing'){const d=camera.position.clone().sub(controls.target).normalize(),current=camera.position.distanceTo(controls.target),required=fitDistance(d);const distance=required>current?required:THREE.MathUtils.lerp(current,required,1-Math.exp(-dt*10));camera.position.copy(controls.target).addScaledVector(d,distance);}
      $('angle-value').textContent=Math.round(opening.angle)+'°';
      if(activeView==='window')$('opening-caption').textContent=opening.pending?'Закрываем створку перед сменой режима':opening.mode==='closed'||opening.angle<.1?'Створка закрыта':opening.mode==='turn'?`Поворот внутрь · ${Math.round(opening.angle)}°`:`Откинуто внутрь · ${Math.round(opening.angle)}°`;
      dirty=true;
    }
    controls.update();
    if(dirty){projectLabels();if(activeView!=='drawing')renderer.render(scene,camera);dirty=false;}
    if(announcePending&&!moving&&!rebuildPending){announce();announcePending=false;}
  }
  requestAnimationFrame(tick);
}
