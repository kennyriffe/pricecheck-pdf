// No-blank-pages build with print guard, grid->block print, and pre-print cleanup
const imagesInput = document.getElementById('imagesInput');
const printBtn = document.getElementById('printBtn');
const clearBtn = document.getElementById('clearBtn');
const pagesEl = document.getElementById('pages');
const pageTitleInput = document.getElementById('pageTitleInput');
const sizeRange = document.getElementById('sizeRange');
const sizeOut = document.getElementById('sizeOut');
const spaceTPRange = document.getElementById('spaceTPRange');
const spaceTPOut = document.getElementById('spaceTPOut');
const spacePTRange = document.getElementById('spacePTRange');
const spacePTOut = document.getElementById('spacePTOut');
const printInRange = document.getElementById('printInRange');
const printInOut = document.getElementById('printInOut');
const guardToggle = document.getElementById('guardToggle');
const headerEl = document.getElementById('appHeader');

// Crop modal refs
const cropModal = document.getElementById('cropModal');
const cropCanvas = document.getElementById('cropCanvas');
const cropTitle = document.getElementById('cropTitle');
const cropCancelBtn = document.getElementById('cropCancelBtn');
const cropApplyBtn = document.getElementById('cropApplyBtn');
const ctx = cropCanvas.getContext('2d');

let images = []; // { file, name, title, url, natural: {w,h}, cropDataUrl? }

function titleFromFilename(filename) {
  let base = filename.replace(/\.[^.]+$/, '');
  base = base.replace(/[_-]+/g, ' ');
  base = base.replace(/\s*(\(|\[|-)\s*\d+\s*(\)|\])?\s*$/, '');
  return base.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Factory defaults come from the inputs' value/defaultValue attributes in index.html
function resetApp() {
  // 1) Close cropper if open
  if (typeof closeCrop === 'function') closeCrop?.();

  // 2) Clear images + UI
  images = [];
  imagesInput.value = '';
  pageTitleInput.value = '';
  pagesEl.innerHTML =
    '<div class="dropzone" id="dropZone"><p>Drag & drop images here, or use the button above.</p></div>';
  printBtn.disabled = true;

  // 3) Reset all range sliders to their HTML defaults and fire input handlers
  document.querySelectorAll('.controls input[type="range"]').forEach(r => {
    r.value = r.defaultValue; // uses the value in index.html as the factory default
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // 4) Reset the guard toggle to its HTML default and fire change handler
  if (window.guardToggle) {
    guardToggle.checked = guardToggle.defaultChecked;
    guardToggle.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // 5) Recompute sticky header spacing
  if (typeof computeHeaderHeight === 'function') computeHeaderHeight();
}

function chunk(arr, size) { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; }

function renderTwoUp(list) {
  pagesEl.innerHTML = '';
  const docTitle = pageTitleInput.value.trim();
  if (!list.length) {
    pagesEl.innerHTML = '<div class="dropzone" id="dropZone"><p>Drag & drop images here, or use the button above.</p></div>';
    printBtn.disabled = true;
    return;
  }
  printBtn.disabled = false;

  const pages = chunk(list, 2);
  let isFirstPage = true;
  for (const pageImages of pages) {
    if (!pageImages.length) continue;
    const page = document.createElement('section');
    page.className = 'page';
    const inner = document.createElement('div');
    inner.className = 'page-inner';

    if (isFirstPage && docTitle) {
      const titleWrap = document.createElement('header');
      titleWrap.className = 'page-title-block';
      const heading = document.createElement('h2');
      heading.textContent = docTitle;
      titleWrap.appendChild(heading);
      inner.appendChild(titleWrap);
    }

    for (const img of pageImages) {
      const sec = document.createElement('div');
      sec.className = 'pair';

      const h2 = document.createElement('h2');
      h2.textContent = img.title;

      const imageEl = document.createElement('img');
      imageEl.src = img.cropDataUrl || img.url;
      imageEl.alt = img.title;
      imageEl.addEventListener('click', () => openCropFor(img));

      sec.appendChild(h2);
      sec.appendChild(imageEl);
      inner.appendChild(sec);
    }

    page.appendChild(inner);
    pagesEl.appendChild(page);
    isFirstPage = false;
  }
}

function setVar(name, valueWithUnit) { document.documentElement.style.setProperty(name, valueWithUnit); }
function updatePreviewHeight(px) { setVar('--preview-img-height', px + 'px'); sizeOut.textContent = px; }
function updateSpaceTitleToPhoto(px) { setVar('--space-title-to-photo', px + 'px'); spaceTPOut.textContent = px; maybeRecalcGuard(); }
function updateSpacePhotoToNext(px) { setVar('--space-photo-to-next', px + 'px'); spacePTOut.textContent = px; maybeRecalcGuard(); }
function updatePrintMaxIn(inches) { setVar('--print-img-max-height', inches + 'in'); printInOut.textContent = Number(inches).toFixed(2); }

function recalcGuard() {
  const pxToIn = (px) => px / 96;
  const style = getComputedStyle(document.documentElement);
  const spaceTP_px = parseFloat(style.getPropertyValue('--space-title-to-photo')) || 0;
  const spacePT_px = parseFloat(style.getPropertyValue('--space-photo-to-next')) || 0;
  const spaceTP_in = pxToIn(spaceTP_px);
  const spacePT_in = pxToIn(spacePT_px);
  const printable_in = 10.0;
  const hasDocTitle = pageTitleInput.value.trim().length > 0;
  const title_in = (13/72) + 0.04;
  const docTitle_in = hasDocTitle ? (18/72) + 0.04 : 0;
  const docGap_in = hasDocTitle ? spacePT_in : 0;
  const fixed_in = docTitle_in + docGap_in + (2*title_in) + (2*spaceTP_in) + (2*spacePT_in);
  const fudge_in = 0.2;
  let allowed_img_in = (printable_in - fixed_in - fudge_in) / 2;
  const user_in = parseFloat(printInRange.value);
  allowed_img_in = Math.max(1.0, Math.min(6.0, allowed_img_in));
  const final_in = Math.min(user_in, allowed_img_in);
  updatePrintMaxIn(final_in);
}
function maybeRecalcGuard() { if (guardToggle.checked) recalcGuard(); }
guardToggle.addEventListener('change', () => { if (guardToggle.checked) recalcGuard(); else updatePrintMaxIn(printInRange.value); });

function computeHeaderHeight() {
  const h = headerEl.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--header-height', h + 'px');
}
window.addEventListener('load', computeHeaderHeight);
window.addEventListener('resize', computeHeaderHeight);

// Load images
imagesInput.addEventListener('change', async (e) => {
  if (!e.target.files.length) return;
  const files = Array.from(e.target.files);
  const loaded = await loadImages(files);
  if (loaded.length) {
    images = images.concat(loaded);
    renderTwoUp(images);
    maybeRecalcGuard();
    requestAnimationFrame(computeHeaderHeight);
  }
  imagesInput.value = '';
});
;['dragenter','dragover'].forEach(ev => {
  pagesEl.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation();
    const dz = document.getElementById('dropZone'); if (dz) dz.classList.add('dragover'); });
});
;['dragleave','drop'].forEach(ev => {
  pagesEl.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation();
    const dz = document.getElementById('dropZone'); if (dz) dz.classList.remove('dragover'); });
});
pagesEl.addEventListener('drop', async (e) => {
  const files = [...e.dataTransfer.files];
  if (!files.length) return;
  const loaded = await loadImages(files);
  if (loaded.length) {
    images = images.concat(loaded);
    renderTwoUp(images);
    maybeRecalcGuard();
    requestAnimationFrame(computeHeaderHeight);
  }
});
pageTitleInput.addEventListener('input', () => {
  renderTwoUp(images);
  maybeRecalcGuard();
  requestAnimationFrame(computeHeaderHeight);
});
async function loadImages(files) {
  const out = [];
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const dim = await getImageDimensions(url).catch(() => null);
      if (!dim) continue;
      out.push({ file, name: file.name, title: titleFromFilename(file.name), url, natural: dim });
    } else if (isPdfFile(file)) {
      const pdfImages = await loadPdfPages(file).catch(() => []);
      out.push(...pdfImages);
    }
  }
  return out;
}
function isPdfFile(file) { return file.type === 'application/pdf' || /\.pdf$/i.test(file.name); }
function getImageDimensions(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject('decode error');
    img.src = objectUrl;
  });
}
async function loadPdfPages(file) {
  if (typeof pdfjsLib === 'undefined') {
    console.warn('PDF.js library not available; skipping PDF file import.');
    return [];
  }
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  const baseTitle = titleFromFilename(file.name);
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    pages.push({
      file,
      name: `${file.name}#page${pageNum}`,
      title: pdf.numPages > 1 ? `${baseTitle} — Page ${pageNum}` : baseTitle,
      url: dataUrl,
      natural: { w: canvas.width, h: canvas.height }
    });
  }
  if (typeof pdf.cleanup === 'function') pdf.cleanup();
  if (typeof pdf.destroy === 'function') await pdf.destroy();
  return pages;
}

// Pre‑print: recalc guard, drop any empty pages, force layout flush
function cleanupBeforePrint() {
  if (guardToggle.checked) recalcGuard();
  // Remove empty .page nodes just in case
  const pages = [...document.querySelectorAll('.page')];
  for (const p of pages) {
    if (!p.querySelector('.pair')) p.remove();
  }
  // Force reflow
  void document.body.offsetHeight;
}
window.addEventListener('beforeprint', cleanupBeforePrint);

// Controls
printBtn.addEventListener('click', () => { cleanupBeforePrint(); window.print(); });
clearBtn.addEventListener('click', resetApp);

// Sliders
sizeRange.addEventListener('input', (e) => updatePreviewHeight(e.target.value));
spaceTPRange.addEventListener('input', (e) => updateSpaceTitleToPhoto(e.target.value));
spacePTRange.addEventListener('input', (e) => updateSpacePhotoToNext(e.target.value));
printInRange.addEventListener('input', (e) => { if (guardToggle.checked) recalcGuard(); else updatePrintMaxIn(e.target.value); });

// Init
(function init(){
  updatePreviewHeight(sizeRange.value);
  updateSpaceTitleToPhoto(spaceTPRange.value);
  updateSpacePhotoToNext(spacePTRange.value);
  if (guardToggle.checked) recalcGuard(); else updatePrintMaxIn(printInRange.value);
  computeHeaderHeight();
})();

/* --- Crop Modal (same as last fixed overlay) --- */
let currentCropIndex = null, imgBitmap = null, selection = null, dragging = false, dragEdge = null;
function openCropFor(img) {
  currentCropIndex = images.indexOf(img);
  if (currentCropIndex < 0) return;
  document.getElementById('cropTitle').textContent = 'Crop — ' + img.title;
  loadImageElement(img.cropDataUrl || img.url).then(imageEl => {
    imgBitmap = imageEl;
    fitAndDraw(imageEl);
    const w = cropCanvas.width, h = cropCanvas.height;
    const selW = Math.floor(w * 0.8), selH = Math.floor(h * 0.8);
    selection = { x: Math.floor((w - selW)/2), y: Math.floor((h - selH)/2), w: selW, h: selH };
    redraw();
    cropModal.classList.remove('hidden'); cropModal.setAttribute('aria-hidden', 'false');
  });
}
function loadImageElement(src){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=()=>rej('decode error'); img.src=src; }); }
function fitAndDraw(imageEl){
  const maxW=1000,maxH=700, scale=Math.min(maxW/imageEl.naturalWidth,maxH/imageEl.naturalHeight,1);
  const cw=Math.floor(imageEl.naturalWidth*scale), ch=Math.floor(imageEl.naturalHeight*scale);
  cropCanvas.width=cw; cropCanvas.height=ch; ctx.drawImage(imageEl,0,0,cw,ch);
}
function redraw(){
  if(!imgBitmap) return;
  const ctx = cropCanvas.getContext('2d');
  ctx.clearRect(0,0,cropCanvas.width,cropCanvas.height);
  ctx.drawImage(imgBitmap,0,0,cropCanvas.width,cropCanvas.height);
  if(selection){
    ctx.save(); ctx.fillStyle="rgba(0,0,0,0.5)";
    ctx.fillRect(0,0,cropCanvas.width,cropCanvas.height);
    ctx.globalCompositeOperation='destination-out';
    ctx.fillRect(selection.x,selection.y,selection.w,selection.h);
    ctx.restore();
    ctx.save(); ctx.strokeStyle="#00aaff"; ctx.lineWidth=2; ctx.strokeRect(selection.x,selection.y,selection.w,selection.h);
    ctx.fillStyle="#00aaff"; const s=8, pts=[
      [selection.x,selection.y],[selection.x+selection.w/2,selection.y],[selection.x+selection.w,selection.y],
      [selection.x,selection.y+selection.h/2],[selection.x+selection.w,selection.y+selection.h/2],
      [selection.x,selection.y+selection.h],[selection.x+selection.w/2,selection.y+selection.h],[selection.x+selection.w,selection.y+selection.h],
    ]; for(const [x,y] of pts) ctx.fillRect(x-s/2,y-s/2,s,s); ctx.restore();
  }
}
function hitTest(pt){
  if(!selection) return null; const {x,y,w,h}=selection;
  const within=(px,py,cx,cy)=>Math.abs(px-cx)<=6&&Math.abs(py-cy)<=6; const mid=(a,b)=>a+(b-a)/2;
  const corners={nw:[x,y],ne:[x+w,y],sw:[x,y+h],se:[x+w,y+h],n:[mid(x,x+w),y],s:[mid(x,x+w),y+h],w:[x,mid(y,y+h)],e:[x+w,mid(y,y+h)]};
  for(const [k,[cx,cy]] of Object.entries(corners)) if(within(pt.x,pt.y,cx,cy)) return k;
  if(pt.x>=x&&pt.x<=x+w&&pt.y>=y&&pt.y<=y+h) return 'move'; return null;
}
let startPt=null,startSel=null;
cropCanvas.addEventListener('mousedown',e=>{
  const r=cropCanvas.getBoundingClientRect(); const pt={x:e.clientX-r.left,y:e.clientY-r.top};
  dragEdge=hitTest(pt); dragging=true; startPt=pt; startSel=selection?{...selection}:null;
  if(!dragEdge){ selection={x:pt.x,y:pt.y,w:1,h:1}; dragEdge='se'; } redraw();
});
window.addEventListener('mousemove',e=>{
  if(!dragging) return; const r=cropCanvas.getBoundingClientRect();
  const pt={x:Math.max(0,Math.min(cropCanvas.width,e.clientX-r.left)), y:Math.max(0,Math.min(cropCanvas.height,e.clientY-r.top))};
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  if(dragEdge==='move'&&startSel){ const dx=pt.x-startPt.x,dy=pt.y-startPt.y;
    selection.x=clamp(startSel.x+dx,0,cropCanvas.width-selection.w); selection.y=clamp(startSel.y+dy,0,cropCanvas.height-selection.h);
  } else if(startSel){ const s={...startSel};
    if(dragEdge.includes('n')){const ny=clamp(pt.y,0,s.y+s.h-10); selection.y=ny; selection.h=s.y+s.h-ny;}
    if(dragEdge.includes('s')){const nh=clamp(pt.y-s.y,10,cropCanvas.height-s.y); selection.h=nh;}
    if(dragEdge.includes('w')){const nx=clamp(pt.x,0,s.x+s.w-10); selection.x=nx; selection.w=s.x+s.w-nx;}
    if(dragEdge.includes('e')){const nw=clamp(pt.x-s.x,10,cropCanvas.width-s.x); selection.w=nw;}
    if(dragEdge==='se'&&!startSel){ selection.w=pt.x-selection.x; selection.h=pt.y-selection.y; }
  } else { selection.w=Math.max(10,pt.x-selection.x); selection.h=Math.max(10,pt.y-selection.y); }
  redraw();
});
window.addEventListener('mouseup',()=>{ dragging=false; dragEdge=null; });
cropCanvas.addEventListener('dblclick', applyCrop);
document.getElementById('cropCancelBtn').addEventListener('click', ()=>closeCrop());
document.getElementById('cropApplyBtn').addEventListener('click', applyCrop);
function closeCrop(){ cropModal.classList.add('hidden'); cropModal.setAttribute('aria-hidden','true'); imgBitmap=null; selection=null; dragging=false; dragEdge=null; }
function applyCrop(){
  if(currentCropIndex==null||!selection||!imgBitmap){ closeCrop(); return; }
  const scaleX=imgBitmap.naturalWidth/cropCanvas.width, scaleY=imgBitmap.naturalHeight/cropCanvas.height;
  const sx=Math.round(selection.x*scaleX), sy=Math.round(selection.y*scaleY), sw=Math.round(selection.w*scaleX), sh=Math.round(selection.h*scaleY);
  const out=document.createElement('canvas'); out.width=Math.max(1,sw); out.height=Math.max(1,sh);
  const octx=out.getContext('2d'); octx.drawImage(imgBitmap,sx,sy,sw,sh,0,0,sw,sh);
  images[currentCropIndex].cropDataUrl=out.toDataURL('image/jpeg',0.92);
  renderTwoUp(images); closeCrop();
}
