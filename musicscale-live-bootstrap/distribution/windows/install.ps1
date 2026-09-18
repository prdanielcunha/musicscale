param(
  [switch]$SkipFirewall
)

$ErrorActionPreference = "Stop"

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Join-Path $env:LOCALAPPDATA "MusicScaleLive"
$ExePath = Join-Path $InstallDir "MusicScaleLiveNode.exe"
$WebDir = Join-Path $InstallDir "web"

Write-Host "Instalando MusicScale Live Node..." -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $WebDir | Out-Null

Copy-Item (Join-Path $SourceDir "MusicScaleLiveNode.exe") $ExePath -Force
Copy-Item (Join-Path $SourceDir "web\*") $WebDir -Recurse -Force

$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
New-Item -Path $RunKey -Force | Out-Null
Set-ItemProperty -Path $RunKey -Name "MusicScaleLiveNode" -Value "`"$ExePath`""

if (-not $SkipFirewall) {
  $FirewallScript = @"
netsh advfirewall firewall delete rule name="MusicScale Live Node" >NUL 2>&1
netsh advfirewall firewall add rule name="MusicScale Live Node" dir=in action=allow protocol=TCP localport=4317 profile=private
"@
  $TempFirewall = Join-Path $env:TEMP "musicscale-live-firewall.cmd"
  Set-Content -Path $TempFirewall -Value $FirewallScript -Encoding ASCII

  try {
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$TempFirewall`"" -Verb RunAs -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
      Write-Warning "Não foi possível criar a regra de firewall automaticamente."
    }
  } catch {
    Write-Warning "Regra de firewall não criada. O Live Node funciona neste PC, mas tablets podem não alcançá-lo até liberar a porta TCP 4317 na rede privada."
  } finally {
    Remove-Item $TempFirewall -ErrorAction SilentlyContinue
  }
}

Get-Process MusicScaleLiveNode -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Process -FilePath $ExePath

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:4317/node"

Write-Host ""
Write-Host "MusicScale Live Node instalado." -ForegroundColor Green
Write-Host "Ele iniciará automaticamente ao entrar no Windows."
Write-Host "O painel local foi aberto no navegador."
