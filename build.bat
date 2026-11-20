@echo off
REM ===================================================================
REM  PostProcess.exe olusturur (onedir - klasor halinde).
REM  Kullanim: bu dosyaya cift tikla. Sonunda dist\PostProcess\ hazir olur.
REM  Gereken (bir kez):  py -m pip install pyinstaller
REM  Gelistiren: Muhammed Emin URAL
REM ===================================================================
setlocal
cd /d "%~dp0"

echo.
echo === PyInstaller kontrol ===
py -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo PyInstaller yok, kuruluyor...
    py -m pip install pyinstaller || goto :hata
)

echo.
echo === Eski derleme temizleniyor ===
if exist build rmdir /s /q build
if exist dist  rmdir /s /q dist

echo.
echo === Derleniyor (onedir) ===
py -m PyInstaller --noconfirm --clean --onedir --name PostProcess ^
    --add-data "dashboard_template.html;." ^
    --add-data "ui;ui" ^
    --icon NONE ^
    postproc.py
if errorlevel 1 goto :hata

echo.
echo ====================================================================
echo  TAMAM. Dagitilacak klasor:  dist\PostProcess\
echo  Icindeki PostProcess.exe calistir. Tum klasoru birlikte gonder.
echo ====================================================================
echo.
pause
exit /b 0

:hata
echo.
echo HATA: derleme basarisiz.
pause
exit /b 1
