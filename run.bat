@echo off
setlocal enabledelayedexpansion

title AirWise AI

echo ===================================================
echo               Starting AirWise AI
echo ===================================================
echo.

:: Navigate to the directory where this script is located
cd /d "%~dp0"

:: 1. Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Display Node and NPM versions
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo [INFO] Node.js version : !NODE_VER!
echo [INFO] NPM version     : !NPM_VER!
echo.

:: 2. Check for .env file
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] .env file not found. Creating from .env.example...
        copy ".env.example" ".env" >nul
        echo [INFO] Created .env file. Please check and configure GEMINI_API_KEY if needed.
    ) else (
        echo [WARNING] Neither .env nor .env.example found.
    )
    echo.
)

:: 3. Check if dependencies are installed
if not exist "node_modules\" (
    echo [INFO] Dependencies not found. Installing packages with npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies. Please check the logs above.
        pause
        exit /b 1
    )
    echo [INFO] Dependencies installed successfully.
    echo.
)

:: 4. Launch browser after server startup
echo [INFO] Opening http://localhost:3000 in your browser...
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:3000"

:: 5. Start development server
echo [INFO] Starting AirWise AI development server...
echo [INFO] Press Ctrl+C at any time in this window to stop the server.
echo.

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server stopped with an exit code: %errorlevel%
    pause
)
