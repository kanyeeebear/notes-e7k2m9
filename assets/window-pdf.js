import {drawingGeometry} from './window-drawing.js?v=1';

export async function createDrawingPDF(params){
  const [library,font]=await Promise.all([import('./vendor/jspdf-2.5.2/jspdf.umd.min.js'),import('./vendor/golos/font.js')]);
  const Constructor=library.jsPDF||library.default?.jsPDF||globalThis.jspdf?.jsPDF;
  if(!Constructor)throw new Error('PDF library unavailable');
  const pdf=new Constructor({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  pdf.addFileToVFS('Golos.ttf',font.default);pdf.addFont('Golos.ttf','Golos','normal');pdf.setFont('Golos','normal');
  pdf.setProperties({title:`ELWIDO W-01 ${params.width}x${params.height}`,author:'ELWIDO',subject:'Учебный эскиз окна'});
  pdf.setTextColor(23,35,45);pdf.setDrawColor(38,52,61);pdf.setLineWidth(.25);
  pdf.setFontSize(12);pdf.text('ELWIDO',12,17);pdf.setFontSize(18);pdf.text('Эскиз окна W-01',12,26);
  pdf.setFontSize(9);pdf.text('Учебная конфигурация',285,17,{align:'right'});pdf.text(new Date().toLocaleDateString('ru-RU'),285,23,{align:'right'});pdf.line(12,30,285,30);
  for(const [index,side]of ['inside','outside'].entries()){
    const g=drawingGeometry(params,side),center=index===0?79:218,scale=Math.min(108/g.width,98/g.height),w=g.width*scale,h=g.height*scale,x=center-w/2,y=40+(98-h)/2;
    const px=v=>x+v*scale,py=v=>y+h-v*scale;
    pdf.setFontSize(10);pdf.text(side==='inside'?'Вид из комнаты':'Вид с улицы',center,37,{align:'center'});
    g.rects.forEach((r,i)=>{const fills=[[232,237,240],[255,255,255],[232,237,240],[245,249,250]];pdf.setFillColor(...fills[i]);pdf.setLineWidth(i===0?.4:.2);pdf.rect(px(r.x),py(r.y+r.h),r.w*scale,r.h*scale,'FD');});
    pdf.setLineWidth(.2);pdf.setLineDashPattern([2,1.2],0);
    for(let k=0;k<g.turn.length-1;k++)pdf.line(px(g.turn[k][0]),py(g.turn[k][1]),px(g.turn[k+1][0]),py(g.turn[k+1][1]));
    pdf.setLineDashPattern([.4,1.2],0);for(let k=0;k<g.tilt.length-1;k++)pdf.line(px(g.tilt[k][0]),py(g.tilt[k][1]),px(g.tilt[k+1][0]),py(g.tilt[k+1][1]));
    pdf.setLineDashPattern([],0);pdf.setFillColor(91,106,115);pdf.rect(px(g.handle.x)-.5,py(g.handle.y+g.handle.h),1,g.handle.h*scale,'F');
    pdf.setDrawColor(85,101,110);pdf.setLineWidth(.18);
    pdf.line(x,y+h+3,x,y+h+13);pdf.line(x+w,y+h+3,x+w,y+h+13);pdf.line(x,y+h+10,x+w,y+h+10);
    pdf.line(x-1,y+h+11,x+1,y+h+9);pdf.line(x+w-1,y+h+11,x+w+1,y+h+9);
    pdf.line(x-3,y,x-13,y);pdf.line(x-3,y+h,x-13,y+h);pdf.line(x-10,y,x-10,y+h);
    pdf.line(x-11,y+1,x-9,y-1);pdf.line(x-11,y+h+1,x-9,y+h-1);
    pdf.setFontSize(9);pdf.text(String(g.width),center,y+h+8.5,{align:'center'});pdf.text(String(g.height),x-11.5,y+h/2,{angle:90,align:'center'});
    pdf.setFontSize(8);pdf.text(`Петли ${g.hingeLeft?'слева':'справа'} на этом виде`,center,155,{align:'center'});pdf.setDrawColor(38,52,61);
  }
  const g=drawingGeometry(params);pdf.setFontSize(8);pdf.text('Размеры в мм. Длинный пунктир: поворот. Короткий пунктир: откидывание.',12,163);
  const cells=[['Габарит рамы',`${params.width} × ${params.height} мм`,'Стеклопакет',`${g.glass.formula} · ${g.total} мм`],['Открывание','Поворотно-откидное, внутрь','Петли из комнаты',params.hinge==='left'?'Слева':'Справа']];
  const columns=[12,52,145,188,285];pdf.setFontSize(9);pdf.setDrawColor(175,187,194);pdf.setLineWidth(.2);
  cells.forEach((row,j)=>row.forEach((value,i)=>{const x=columns[i],y=168+j*8,w=columns[i+1]-x;pdf.setFillColor(...(i%2===0?[242,244,243]:[255,255,255]));pdf.rect(x,y,w,8,'FD');pdf.text(value,x+2,y+5.3);}));
  pdf.setFontSize(7.5);pdf.setTextColor(67,83,93);
  const note='Учебный эскиз для обсуждения конфигурации. Не производственный чертёж. Профиль и узлы условные; размеры стекла, зазоры, допуски и фурнитуру определяет конструктор завода. Масштаб произвольный: ориентируйся на подписанные размеры.';
  pdf.text(pdf.splitTextToSize(note,273),12,190,{lineHeightFactor:1.35});
  return new Uint8Array(pdf.output('arraybuffer'));
}

export async function downloadPDF(params){
  const data=await createDrawingPDF({...params}),url=URL.createObjectURL(new Blob([data],{type:'application/pdf'})),a=document.createElement('a');
  a.href=url;a.download=`ELWIDO-W01-${params.width}x${params.height}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
