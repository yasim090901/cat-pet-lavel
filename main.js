const {app,BrowserWindow,ipcMain,Menu,screen}=require('electron');
const SCALE=0.5, W=Math.round(960*SCALE), H=Math.round(900*SCALE); // 크기를 바꾸려면 pet.html의 --s 도 같이 수정
let win,startPos;
if(!app.requestSingleInstanceLock()){app.quit()}
app.whenReady().then(()=>{
  const wa=screen.getPrimaryDisplay().workArea;
  win=new BrowserWindow({width:W,height:H,x:wa.x+wa.width-W-40,y:wa.y+wa.height-H,
    frame:false,transparent:true,hasShadow:false,resizable:false,maximizable:false,fullscreenable:false,
    alwaysOnTop:true,skipTaskbar:true,backgroundColor:'#00000000',
    webPreferences:{nodeIntegration:true,contextIsolation:false,webSecurity:false}});
  win.setAlwaysOnTop(true,'screen-saver');
  win.setIgnoreMouseEvents(true,{forward:true});      // 투명한 곳은 클릭 통과
  win.loadFile('pet.html');
  // 다른 프로그램에서 키보드를 쳐도 반응하도록 전역 키 입력 감지
  try{
    const {uIOhook}=require('uiohook-napi');
    uIOhook.on('keydown',()=>{if(win&&!win.isDestroyed())win.webContents.send('key')});
    uIOhook.start();
  }catch(err){console.error('전역 키 감지 실패(창이 포커스일 때만 반응):',err.message)}
});
ipcMain.on('ignore',(e,v)=>{if(win)win.setIgnoreMouseEvents(v,{forward:true})});
ipcMain.on('drag-start',()=>{startPos=win.getPosition()});
ipcMain.on('drag-move',(e,dx,dy)=>{if(startPos)win.setPosition(startPos[0]+dx,startPos[1]+dy)});
ipcMain.on('menu',()=>{
  Menu.buildFromTemplate([{label:'종료',click:()=>app.quit()}]).popup({window:win});
});
app.on('will-quit',()=>{try{require('uiohook-napi').uIOhook.stop()}catch(e){}});
app.on('window-all-closed',()=>app.quit());
