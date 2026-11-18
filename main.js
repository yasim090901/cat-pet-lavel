const {app,BrowserWindow,ipcMain,Menu,screen,dialog}=require('electron');
const fs=require('fs'),path=require('path');
const BASE_W=960, BASE_H=900;                       // 캐릭터 원본 화면 크기(배율 1.0 기준)
let win,startPos,cfgPath,saveTimer;
const diag={hook:'아직 시작 안 됨',keys:0,last:null,started:Date.now()};
let cfg={scale:0.5,locked:false,x:null,y:null};      // 저장되는 설정
if(!app.requestSingleInstanceLock()){app.quit()}
// 다른 창이 위를 덮거나 전체화면이어도 그리기/애니메이션이 멈추지 않도록
app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

function loadCfg(){try{cfg={...cfg,...JSON.parse(fs.readFileSync(cfgPath,'utf8'))}}catch(e){}}
function saveCfg(){try{fs.writeFileSync(cfgPath,JSON.stringify(cfg))}catch(e){}}
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveCfg,300)}
function onScreen(x,y,w,h){
  return screen.getAllDisplays().some(d=>{const a=d.workArea;
    return x+w>a.x+40&&x<a.x+a.width-40&&y+h>a.y+40&&y<a.y+a.height-40});
}
function applyScale(s,keepAnchor=true){
  cfg.scale=s;
  const w=Math.round(BASE_W*s),h=Math.round(BASE_H*s),b=win.getBounds();
  // 바닥 중앙을 기준으로 크기를 바꿔서 캐릭터가 제자리에 있는 것처럼 보이게 함
  const nx=keepAnchor?Math.round(b.x+(b.width-w)/2):b.x, ny=keepAnchor?b.y+b.height-h:b.y;
  win.setResizable(true);win.setBounds({x:nx,y:ny,width:w,height:h});win.setResizable(false);
  win.webContents.setZoomFactor(s/0.5);   // pet.html 기본 배율(0.5) 대비 창 전체를 확대/축소
  saveSoon();
}

app.whenReady().then(()=>{
  cfgPath=path.join(app.getPath('userData'),'settings.json');loadCfg();
  const W=Math.round(BASE_W*cfg.scale),H=Math.round(BASE_H*cfg.scale);
  const wa=screen.getPrimaryDisplay().workArea;
  let x=wa.x+wa.width-W-40,y=wa.y+wa.height-H;
  if(cfg.x!=null&&cfg.y!=null&&onScreen(cfg.x,cfg.y,W,H)){x=cfg.x;y=cfg.y}
  win=new BrowserWindow({width:W,height:H,x,y,
    frame:false,transparent:true,hasShadow:false,resizable:false,maximizable:false,fullscreenable:false,
    alwaysOnTop:true,skipTaskbar:true,backgroundColor:'#00000000',
    focusable:false,
    webPreferences:{nodeIntegration:true,contextIsolation:false,webSecurity:false,backgroundThrottling:false}});
  win.setAlwaysOnTop(true,'screen-saver');
  win.setIgnoreMouseEvents(true,{forward:true});      // 투명한 곳은 클릭 통과
  win.loadFile('pet.html');
  // 전체화면 앱이 켜져도 펫이 계속 맨 위에 보이도록 주기적으로 다시 올림
  setInterval(()=>{if(win&&!win.isDestroyed()){win.setAlwaysOnTop(true,'screen-saver');win.moveTop()}},2000);
  win.webContents.on('did-finish-load',()=>win.webContents.setZoomFactor(cfg.scale/0.5));
  win.webContents.on('dom-ready',()=>win.webContents.setZoomFactor(cfg.scale/0.5));
  win.on('move',()=>{const b=win.getBounds();cfg.x=b.x;cfg.y=b.y;saveSoon()});
  // 다른 프로그램에서 키보드를 쳐도 반응하도록 전역 키 입력 감지
  try{
    const {uIOhook}=require('uiohook-napi');
    let lastTop=0;
    uIOhook.on('keydown',()=>{
      if(!win||win.isDestroyed())return;
      diag.keys++;diag.last=new Date();
      const t=Date.now();
      if(t-lastTop>1000){lastTop=t;if(!win.isVisible())win.showInactive();win.setAlwaysOnTop(true,'screen-saver');win.moveTop()}
      win.webContents.send('key');
    });
    uIOhook.start();diag.hook='정상 시작됨';
  }catch(err){diag.hook='실패: '+err.message;console.error('전역 키 감지 실패:',err.message)}
});
ipcMain.on('ignore',(e,v)=>{if(win)win.setIgnoreMouseEvents(v,{forward:true})});
ipcMain.on('drag-start',()=>{startPos=cfg.locked?null:win.getPosition()});   // 위치 고정이면 이동 안 함
ipcMain.on('drag-move',(e,dx,dy)=>{if(startPos&&!cfg.locked)win.setPosition(startPos[0]+dx,startPos[1]+dy)});
ipcMain.on('menu',()=>{
  const pct=Math.round(cfg.scale*100);
  Menu.buildFromTemplate([
    {label:'크기',submenu:[30,40,50,60,75,100].map(p=>({
      label:p+'%'+(p===50?' (기본)':''),type:'radio',checked:pct===p,click:()=>applyScale(p/100)}))},
    {label:'위치 고정',type:'checkbox',checked:cfg.locked,click:m=>{cfg.locked=m.checked;saveCfg()}},
    {label:'진단 정보',click:()=>{
      const t=diag.last?diag.last.toLocaleTimeString():'없음';
      dialog.showMessageBox({type:'info',title:'진단 정보',message:'키 입력 감지 상태',
        detail:'키 감지: '+diag.hook+'\n받은 키 입력: '+diag.keys+'회\n마지막 입력: '+t+
               '\n창 표시: '+(win.isVisible()?'예':'아니오')+'\n크기 배율: '+Math.round(cfg.scale*100)+'%'});
    }},
    {type:'separator'},
    {label:'종료',click:()=>app.quit()}
  ]).popup({window:win});
});
app.on('will-quit',()=>{saveCfg();try{require('uiohook-napi').uIOhook.stop()}catch(e){}});
app.on('window-all-closed',()=>app.quit());
