import {GLASS,glassThickness,validSize} from './window-model.js?v=3';

const format=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
function check(p){if(!validSize(p.width,'width')||!validSize(p.height,'height')||!GLASS[p.glass]||!['left','right'].includes(p.hinge))throw new RangeError('Invalid drawing parameters');}
const n=x=>Number(x.toFixed(4));

export function drawingGeometry(params,side='inside'){
  check(params);if(!['inside','outside'].includes(side))throw new RangeError('Invalid drawing side');
  const w=params.width,h=params.height,hingeLeft=(params.hinge==='left')===(side==='inside');
  return {width:w,height:h,hingeLeft,rects:[{x:0,y:0,w,h},{x:50,y:50,w:w-100,h:h-100},{x:52,y:52,w:w-104,h:h-104},{x:110,y:110,w:w-220,h:h-220}],
    turn:[[hingeLeft?w-110:110,110],[hingeLeft?110:w-110,h/2],[hingeLeft?w-110:110,h-110]],
    tilt:[[110,h-110],[w/2,110],[w-110,h-110]],
    handle:{x:hingeLeft?w-84:84,y:h/2-60,h:110},glass:GLASS[params.glass],total:glassThickness(params.glass)};
}

export function drawingSVG(params,side='inside'){
  const g=drawingGeometry(params,side),scale=Math.min(340/g.width,400/g.height),w=g.width*scale,h=g.height*scale,x=(500-w)/2,y=76+(400-h)/2;
  const px=v=>n(x+v*scale),py=v=>n(y+h-v*scale);
  const title=side==='inside'?'Вид из комнаты':'Вид с улицы';
  const line=(a,b,c,d,extra='')=>`<line x1="${n(a)}" y1="${n(b)}" x2="${n(c)}" y2="${n(d)}" ${extra}/>`;
  const pts=list=>list.map(([a,b])=>`${px(a)},${py(b)}`).join(' ');
  const rects=g.rects.map((r,i)=>`<rect x="${px(r.x)}" y="${py(r.y+r.h)}" width="${n(r.w*scale)}" height="${n(r.h*scale)}" fill="${['#e8edf0','#ffffff','#e8edf0','#f5f9fa'][i]}" stroke-width="${i===0?2:1}"/>`).join('');
  return `<svg class="window-drawing" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 620" role="img" aria-label="${title}: окно ${params.width} на ${params.height} миллиметров, поворотно-откидное">
  <style>.window-drawing text{font-family:Arial,sans-serif;fill:#17232d;stroke:none}.window-drawing .dim{font-size:20px}.window-drawing .small{font-size:16px;fill:#52616b}</style>
  <rect width="500" height="620" fill="white" stroke="none"/>
  <text x="250" y="30" text-anchor="middle" font-size="20" font-weight="600">${title}</text>
  <g fill="none" stroke="#26343d" stroke-linecap="square">${rects}
    <polyline points="${pts(g.turn)}" stroke-width="1.2" stroke-dasharray="9 6"/>
    <polyline points="${pts(g.tilt)}" stroke-width="1.2" stroke-dasharray="2 5"/>
    <rect x="${px(g.handle.x)-2}" y="${py(g.handle.y+g.handle.h)}" width="4" height="${n(g.handle.h*scale)}" fill="#687780" stroke="none"/>
  </g>
  <g fill="none" stroke="#53636b" stroke-width="1">
    ${line(x,y+h+12,x,y+h+58)}${line(x+w,y+h+12,x+w,y+h+58)}${line(x,y+h+46,x+w,y+h+46)}
    ${line(x-4,y+h+51,x+4,y+h+41)}${line(x+w-4,y+h+51,x+w+4,y+h+41)}
    ${line(x-12,y,x-54,y)}${line(x-12,y+h,x-54,y+h)}${line(x-43,y,x-43,y+h)}
    ${line(x-48,y+4,x-38,y-4)}${line(x-48,y+h+4,x-38,y+h-4)}
  </g>
  <text class="dim" x="250" y="${n(y+h+39)}" text-anchor="middle">${format.format(params.width)}</text>
  <text class="dim" transform="translate(${n(x-51)} ${n(y+h/2)}) rotate(-90)" text-anchor="middle">${format.format(params.height)}</text>
  <text class="small" x="250" y="560" text-anchor="middle">Петли ${g.hingeLeft?'слева':'справа'} на этом виде · размеры в мм</text>
  <text class="small" x="250" y="582" text-anchor="middle">Длинный пунктир: поворот.</text>
  <text class="small" x="250" y="607" text-anchor="middle">Короткий пунктир: откидывание.</text>
 </svg>`;
}

export function printSheet(params){
  check(params);const g=GLASS[params.glass];
  return `<header class="print-head"><div><b>ELWIDO</b><h1>Эскиз окна W-01</h1></div><div>${new Date().toLocaleDateString('ru-RU')}<br>Учебная конфигурация</div></header>
  <div class="print-views">${drawingSVG(params,'inside')}${drawingSVG(params,'outside')}</div>
  <table class="print-spec"><tbody>
   <tr><th>Габарит рамы</th><td>${format.format(params.width)} × ${format.format(params.height)} мм</td><th>Стеклопакет</th><td>${g.formula} · ${glassThickness(params.glass)} мм</td></tr>
   <tr><th>Открывание</th><td>Поворотно-откидное, внутрь</td><th>Петли из комнаты</th><td>${params.hinge==='left'?'Слева':'Справа'}</td></tr>
  </tbody></table>
  <footer class="print-note">Учебный эскиз для обсуждения конфигурации. Не производственный чертёж. Профиль и узлы условные; размеры стекла, зазоры, допуски и фурнитуру определяет конструктор завода. При печати масштаб произвольный, ориентируйся на подписанные размеры.</footer>`;
}

export function drawingDXF(params){
  check(params);const tags=[];const pair=(code,value)=>tags.push(String(code),String(value));
  const line=(x1,y1,x2,y2,layer='FRAME')=>{pair(0,'LINE');pair(8,layer);pair(10,n(x1));pair(20,n(y1));pair(30,0);pair(11,n(x2));pair(21,n(y2));pair(31,0);};
  const text=(value,x,y,size=35,rotation=0)=>{pair(0,'TEXT');pair(8,'TEXT');pair(10,n(x));pair(20,n(y));pair(30,0);pair(40,size);pair(1,value);pair(50,rotation);};
  function dashed(a,b,offset,dash){const length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let v=0;v<length;v+=dash*1.8){const e=Math.min(v+dash,length);line(offset+a[0]+(b[0]-a[0])*v/length,a[1]+(b[1]-a[1])*v/length,offset+a[0]+(b[0]-a[0])*e/length,a[1]+(b[1]-a[1])*e/length,'OPENING');}}
  pair(0,'SECTION');pair(2,'HEADER');pair(9,'$ACADVER');pair(1,'AC1009');pair(9,'$INSUNITS');pair(70,4);pair(9,'$MEASUREMENT');pair(70,1);pair(0,'ENDSEC');
  pair(0,'SECTION');pair(2,'TABLES');pair(0,'TABLE');pair(2,'LAYER');pair(70,4);
  for(const [name,color]of [['FRAME',7],['OPENING',8],['DIMENSIONS',3],['TEXT',7]]){pair(0,'LAYER');pair(2,name);pair(70,0);pair(62,color);pair(6,'CONTINUOUS');}
  pair(0,'ENDTAB');pair(0,'ENDSEC');pair(0,'SECTION');pair(2,'ENTITIES');
  for(const [i,side]of ['inside','outside'].entries()){
    const g=drawingGeometry(params,side),offset=i*(g.width+450);
    for(const r of g.rects){line(offset+r.x,r.y,offset+r.x+r.w,r.y);line(offset+r.x+r.w,r.y,offset+r.x+r.w,r.y+r.h);line(offset+r.x+r.w,r.y+r.h,offset+r.x,r.y+r.h);line(offset+r.x,r.y+r.h,offset+r.x,r.y);}
    for(const [pts,dash]of [[g.turn,35],[g.tilt,9]])for(let k=0;k<pts.length-1;k++)dashed(pts[k],pts[k+1],offset,dash);
    line(offset+g.handle.x,g.handle.y,offset+g.handle.x,g.handle.y+g.handle.h);
    line(offset,-80,offset+g.width,-80,'DIMENSIONS');line(offset,-30,offset,-110,'DIMENSIONS');line(offset+g.width,-30,offset+g.width,-110,'DIMENSIONS');
    line(offset-80,0,offset-80,g.height,'DIMENSIONS');line(offset-30,0,offset-110,0,'DIMENSIONS');line(offset-30,g.height,offset-110,g.height,'DIMENSIONS');
    text(side==='inside'?'W-01 - INTERIOR VIEW':'W-01 - EXTERIOR VIEW',offset,g.height+100,40);
    text(String(g.width)+' mm',offset+g.width/2-65,-65);text(String(g.height)+' mm',offset-95,g.height/2-65,35,90);
    text('HINGES '+(g.hingeLeft?'LEFT':'RIGHT')+' IN THIS VIEW',offset,-175,28);
  }
  text('ELWIDO - EDUCATIONAL SKETCH - NOT FOR FABRICATION',0,params.height+210,35);
  text('Units: mm. IGU: '+GLASS[params.glass].formula.replaceAll('–','-')+' ('+glassThickness(params.glass)+' mm). Tilt-turn inward.',0,-280,30);
  pair(0,'ENDSEC');pair(0,'EOF');return tags.join('\r\n')+'\r\n';
}

export function downloadDrawing(params){
  const blob=new Blob([drawingDXF(params)],{type:'application/dxf'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`ELWIDO-W01-${params.width}x${params.height}.dxf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
