@echo off
echo ========================================
echo Script Manager - Build Tool
echo ========================================
echo.

echo Checking for Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found!
echo.

echo Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo Dependencies installed successfully!
echo ========================================
echo.
echo Choose an option:
echo 1. Run the application (Development)
echo 2. Build Windows executable (.exe)
echo 3. Exit
echo.

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo Starting application...
    call npm start
) else if "%choice%"=="2" (
    echo.
    echo Building Windows executable...
    echo This may take a few minutes...
    call npm run build:win
    echo.
    if %ERRORLEVEL% EQU 0 (
        echo ========================================
        echo Build completed successfully!
        echo Your executable is in the 'dist' folder
        echo ========================================
    ) else (
        echo Build failed. Please check the errors above.
    )
    pause
) else if "%choice%"=="3" (
    exit /b 0
) else (
    echo Invalid choice!
    pause
)
