$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:LOCALAPPDATA "MusicScaleLive"
$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

Get-Process MusicScaleLiveNode -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-ItemProperty -Path $RunKey -Name "MusicScaleLiveNode" -ErrorAction SilentlyContinue

try {
  Start-Process -FilePath "netsh.exe" -ArgumentList "advfirewall firewall delete rule name=`"MusicScale Live Node`"" -Verb RunAs -Wait
} catch {
  Write-Warning "Não foi possível remover automaticamente a regra de firewall."
}

Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "MusicScale Live Node removido." -ForegroundColor Green
