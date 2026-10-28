#Requires -Version 5.1
<#
.SYNOPSIS
  Install (or remove) dsh-right-sidebar-toolkit in a DeepSeek Harness profile.

.DESCRIPTION
  Links this checkout into <DSH_HOME>/profiles/<Profile> with pnpm (through the
  official `dsh plugin` command), then makes sure the package is listed in
  dsh.profile.bundles. Refresh the DSH page (Ctrl+R) afterwards; if the plugin
  still does not appear, fully quit and reopen DeepSeek Harness.

.PARAMETER Profile
  DSH profile name. Default: desktop.

.PARAMETER Uninstall
  Remove the package from the profile instead of installing it.

.EXAMPLE
  powershell -NoProfile -File .\install.ps1 -Profile desktop
#>
[CmdletBinding()]
param(
  [string]$Profile = 'desktop',
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$packageName = 'dsh-right-sidebar-toolkit'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profileDir = Join-Path $dshHome (Join-Path 'profiles' $Profile)
$profileJson = Join-Path $profileDir 'package.json'
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'

if (-not (Test-Path $dshCli)) {
  throw "DSH CLI not found at $dshCli. Install DeepSeek Harness desktop in its default location."
}
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  throw "This directory is not the $packageName package root: $root"
}

# DSH parses the profile manifest with JSON.parse: a BOM breaks it. Write UTF-8
# without BOM instead of relying on Set-Content's Windows PowerShell default.
function Save-ProfileJson([string]$path, $object) {
  $text = $object | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

if ($Uninstall) {
  $json = $null
  if (Test-Path $profileJson) { $json = Get-Content -LiteralPath $profileJson -Raw -Encoding utf8 | ConvertFrom-Json }
  $installed = $false
  if ($json -and $json.dependencies -and $json.dependencies.PSObject.Properties[$packageName]) { $installed = $true }
  if ($installed) {
    & $dshCli plugin --profile $Profile remove $packageName
  } else {
    Write-Host "$packageName is not installed in profile '$Profile'; cleaning leftovers only." -ForegroundColor Yellow
  }
  # pnpm can leave the link: symlink behind after removing the dependency.
  $linkPath = Join-Path $profileDir (Join-Path 'node_modules' $packageName)
  if (Test-Path -LiteralPath $linkPath) {
    $item = Get-Item -LiteralPath $linkPath -Force
    if ($item.LinkType) { Remove-Item -LiteralPath $linkPath -Force -Recurse }
  }
  if (Test-Path $profileJson) {
    $json = Get-Content -LiteralPath $profileJson -Raw -Encoding utf8 | ConvertFrom-Json
    if ($json.dsh -and $json.dsh.profile -and $json.dsh.profile.bundles) {
      $json.dsh.profile.bundles = @($json.dsh.profile.bundles | Where-Object { $_ -ne $packageName })
      Save-ProfileJson $profileJson $json
    }
  }
  Write-Host "Removed $packageName from profile '$Profile'. Quit and reopen DeepSeek Harness to apply." -ForegroundColor Green
  return
}

# 1) link the package into the profile (updates dependencies + pnpm lock/symlink)
$linkSpec = 'link:' + ($root -replace '\\', '/')
& $dshCli plugin --profile $Profile add $linkSpec

# 2) make sure the bundle row exists (dsh plugin add usually appends it already)
$json = Get-Content -LiteralPath $profileJson -Raw -Encoding utf8 | ConvertFrom-Json
if (-not $json.dsh) { $json | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) }
if (-not $json.dsh.profile) { $json.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) }
$bundles = @($json.dsh.profile.bundles)
if ($bundles -notcontains $packageName) {
  $json.dsh.profile.bundles = @($bundles + $packageName)
  Save-ProfileJson $profileJson $json
  Write-Host "Appended $packageName to dsh.profile.bundles." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Install OK: profile = $Profile" -ForegroundColor Green
Write-Host "Apply: refresh the DSH page (Ctrl+R); if absent, fully quit and reopen DeepSeek Harness."
Write-Host "Features: Ctrl+left-drag pans right-sidebar previews; the close-all button closes all right-sidebar content."
