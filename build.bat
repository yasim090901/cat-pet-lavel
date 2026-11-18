@echo off
chcp 65001 >nul
echo [1/2] 패키지 설치 중...
call npm install || goto :fail
echo [2/2] EXE 만드는 중...
call npm run build || goto :fail
echo.
echo 완료! dist\CatPianoPet.exe 를 실행하세요.
pause
exit /b 0
:fail
echo 실패했어요. Node.js(https://nodejs.org)가 설치되어 있는지 확인해 주세요.
pause
exit /b 1
