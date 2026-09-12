[CmdletBinding()]
param(
  [string]$VaultRoot,
  [string]$PiAgentDir = (Join-Path -Path $env:USERPROFILE -ChildPath ".pi\agent"),
  [string]$PortableOutput,
  [switch]$Uninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot

function Get-FullPath {
  param([Parameter(Mandatory = $true)][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Path is required."
  }
  return [IO.Path]::GetFullPath($Value)
}

function Test-PathWithin {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Target
  )

  $rootFull = (Get-FullPath $Root).TrimEnd('\', '/')
  $targetFull = Get-FullPath $Target
  if ($targetFull.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }
  return $targetFull.StartsWith(
    "$rootFull$([IO.Path]::DirectorySeparatorChar)",
    [StringComparison]::OrdinalIgnoreCase
  )
}

function Assert-PathWithin {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Target
  )

  if (-not (Test-PathWithin -Root $Root -Target $Target)) {
    throw "Destination escapes its allowed root: $Target"
  }
}

function Assert-SourceFile {
  param([Parameter(Mandatory = $true)][string]$PathValue)

  if (-not (Test-Path -LiteralPath $PathValue -PathType Leaf)) {
    throw "Required source file is missing: $PathValue"
  }
  return (Get-Item -LiteralPath $PathValue -Force).FullName
}

function New-BackupRoot {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $stamp = Get-Date -Format "yyyyMMddHHmmssfff"
  return Join-Path -Path $Root -ChildPath "backups\pi-docs-kb-$Label-$stamp"
}

function Backup-Existing {
  param(
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$BackupRoot
  )

  if (-not (Test-Path -LiteralPath $Destination)) {
    return
  }
  Assert-PathWithin -Root $Root -Target $Destination
  $item = Get-Item -LiteralPath $Destination -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Refusing to overwrite a reparse point: $Destination"
  }

  $relative = [IO.Path]::GetRelativePath((Get-FullPath $Root), (Get-FullPath $Destination))
  $backupPath = Join-Path -Path $BackupRoot -ChildPath $relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupPath) | Out-Null
  Copy-Item -LiteralPath $Destination -Destination $backupPath -Recurse -Force
}

function Copy-ManagedFile {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$BackupRoot
  )

  Assert-SourceFile -PathValue $Source | Out-Null
  Assert-PathWithin -Root $Root -Target $Destination
  Backup-Existing -Destination $Destination -Root $Root -BackupRoot $BackupRoot
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Write-ManagedText {
  param(
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string]$Content,
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$BackupRoot
  )

  Assert-PathWithin -Root $Root -Target $Destination
  Backup-Existing -Destination $Destination -Root $Root -BackupRoot $BackupRoot
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  [IO.File]::WriteAllText($Destination, $Content, [Text.UTF8Encoding]::new($false))
}

function New-CliShim {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectRootValue,
    [Parameter(Mandatory = $true)][string]$DataRoot
  )

  return @"
@echo off
setlocal
set "PI_DOCS_VAULT_ROOT=$DataRoot"
cd /d "$ProjectRootValue"
node --import=tsx/esm "$ProjectRootValue\src\cli.ts" %*
exit /b %errorlevel%
"@
}

function Get-PointerJson {
  param(
    [Parameter(Mandatory = $true)][string]$DataRoot,
    [Parameter(Mandatory = $true)][string]$ManifestHash,
    [Parameter(Mandatory = $true)][string[]]$InstalledFiles
  )

  $payload = [ordered]@{
    version = 1
    vaultRoot = $DataRoot
    manifestSha256 = $ManifestHash
    installedAt = [DateTime]::UtcNow.ToString("o")
    installedFiles = @($InstalledFiles | Sort-Object -Unique)
  }
  return ($payload | ConvertTo-Json -Depth 4)
}

function Invoke-Uninstall {
  param([Parameter(Mandatory = $true)][string]$PiRoot)

  $pointerPath = Join-Path -Path $PiRoot -ChildPath "pi-docs-kb.json"
  if (-not (Test-Path -LiteralPath $pointerPath -PathType Leaf)) {
    Write-Output "Pi docs integration pointer not found; nothing was removed."
    return
  }

  $pointer = Get-Content -LiteralPath $pointerPath -Raw | ConvertFrom-Json
  $installedFiles = @($pointer.installedFiles)
  foreach ($file in $installedFiles) {
    if ([string]::IsNullOrWhiteSpace([string]$file)) {
      continue
    }
    $destination = Get-FullPath ([string]$file)
    Assert-PathWithin -Root $PiRoot -Target $destination
    if (Test-Path -LiteralPath $destination -PathType Container) {
      throw "Refusing to remove a directory during uninstall: $destination"
    }
    if (Test-Path -LiteralPath $destination) {
      Remove-Item -LiteralPath $destination -Force
    }
  }
  Write-Output "Removed only the files recorded in $pointerPath. Backups and unrelated Pi files remain."
}

$piRoot = Get-FullPath $PiAgentDir
if ($Uninstall) {
  Invoke-Uninstall -PiRoot $piRoot
  exit 0
}

if ([string]::IsNullOrWhiteSpace($VaultRoot)) {
  throw "-VaultRoot is required unless -Uninstall is used."
}
if ([string]::IsNullOrWhiteSpace($PortableOutput)) {
  throw "-PortableOutput is required unless -Uninstall is used."
}

$vault = Get-FullPath $VaultRoot
$portable = Get-FullPath $PortableOutput
if (-not (Test-Path -LiteralPath $vault -PathType Container)) {
  throw "VaultRoot must be an existing directory: $vault"
}
if ((Get-FullPath $vault) -eq (Get-FullPath $portable)) {
  throw "PortableOutput must be different from VaultRoot."
}

$manifestSource = Assert-SourceFile (Join-Path $vault "manifest.json")
$reportSource = Assert-SourceFile (Join-Path $vault "refresh-report.json")
$indexSource = Assert-SourceFile (Join-Path $vault "index\pi-docs.sqlite")
$manifestHash = (Get-FileHash -LiteralPath $manifestSource -Algorithm SHA256).Hash.ToLowerInvariant()

$piExtensionDir = Join-Path $piRoot "extensions\pi-docs-kb"
$piSkillDir = Join-Path $piRoot "skills\pi-docs-kb"
$machineBackupRoot = New-BackupRoot -Root $piRoot -Label "machine"
$portableBackupRoot = New-BackupRoot -Root $portable -Label "portable"

$machineFiles = @(
  @{ Source = (Join-Path $projectRoot "src\pi-extension.ts"); Destination = (Join-Path $piExtensionDir "index.ts") },
  @{ Source = (Join-Path $projectRoot "src\search.ts"); Destination = (Join-Path $piExtensionDir "search.ts") },
  @{ Source = (Join-Path $projectRoot "src\paths.ts"); Destination = (Join-Path $piExtensionDir "paths.ts") },
  @{ Source = (Join-Path $projectRoot "pi\skills\pi-docs-kb\SKILL.md"); Destination = (Join-Path $piSkillDir "SKILL.md") }
)

$portableData = Join-Path $portable "data"
$portableExtensionDir = Join-Path $portable "pi\extensions\pi-docs-kb"
$portableSkillDir = Join-Path $portable "pi\skills\pi-docs-kb"
$portableFiles = @(
  @{ Source = (Join-Path $projectRoot "README.md"); Destination = (Join-Path $portable "README.md") },
  @{ Source = (Join-Path $projectRoot "docs\source-policy.md"); Destination = (Join-Path $portable "docs\source-policy.md") },
  @{ Source = (Join-Path $projectRoot "scripts\install-pi-integration.ps1"); Destination = (Join-Path $portable "scripts\install-pi-integration.ps1") },
  @{ Source = (Join-Path $projectRoot "package.json"); Destination = (Join-Path $portable "package.json") },
  @{ Source = (Join-Path $projectRoot "package-lock.json"); Destination = (Join-Path $portable "package-lock.json") },
  @{ Source = (Join-Path $projectRoot "src\cli.ts"); Destination = (Join-Path $portable "src\cli.ts") },
  @{ Source = (Join-Path $projectRoot "src\crawl.ts"); Destination = (Join-Path $portable "src\crawl.ts") },
  @{ Source = (Join-Path $projectRoot "src\extract.ts"); Destination = (Join-Path $portable "src\extract.ts") },
  @{ Source = (Join-Path $projectRoot "src\index.ts"); Destination = (Join-Path $portable "src\index.ts") },
  @{ Source = (Join-Path $projectRoot "src\install-plan.ts"); Destination = (Join-Path $portable "src\install-plan.ts") },
  @{ Source = (Join-Path $projectRoot "src\manifest.ts"); Destination = (Join-Path $portable "src\manifest.ts") },
  @{ Source = (Join-Path $projectRoot "src\paths.ts"); Destination = (Join-Path $portable "src\paths.ts") },
  @{ Source = (Join-Path $projectRoot "src\pi-extension.ts"); Destination = (Join-Path $portable "src\pi-extension.ts") },
  @{ Source = (Join-Path $projectRoot "src\search.ts"); Destination = (Join-Path $portable "src\search.ts") },
  @{ Source = (Join-Path $projectRoot "pi\skills\pi-docs-kb\SKILL.md"); Destination = (Join-Path $portableSkillDir "SKILL.md") },
  @{ Source = (Join-Path $projectRoot "src\pi-extension.ts"); Destination = (Join-Path $portableExtensionDir "index.ts") },
  @{ Source = (Join-Path $projectRoot "src\search.ts"); Destination = (Join-Path $portableExtensionDir "search.ts") },
  @{ Source = (Join-Path $projectRoot "src\paths.ts"); Destination = (Join-Path $portableExtensionDir "paths.ts") },
  @{ Source = $manifestSource; Destination = (Join-Path $portableData "manifest.json") },
  @{ Source = $reportSource; Destination = (Join-Path $portableData "refresh-report.json") },
  @{ Source = $indexSource; Destination = (Join-Path $portableData "index\pi-docs.sqlite") }
)

foreach ($file in $machineFiles) {
  Copy-ManagedFile -Source $file.Source -Destination $file.Destination -Root $piRoot -BackupRoot $machineBackupRoot
}

foreach ($file in $portableFiles) {
  Copy-ManagedFile -Source $file.Source -Destination $file.Destination -Root $portable -BackupRoot $portableBackupRoot
}

$sourceRoot = Join-Path $vault "sources"
if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
  throw "Vault source directory is missing: $sourceRoot"
}
foreach ($sourceFile in Get-ChildItem -LiteralPath $sourceRoot -File -Recurse) {
  if (($sourceFile.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Refusing to copy a reparse point from the vault: $($sourceFile.FullName)"
  }
  $relativeSource = [IO.Path]::GetRelativePath($vault, $sourceFile.FullName)
  $destination = Join-Path $portable $([IO.Path]::Combine("data", $relativeSource))
  Copy-ManagedFile -Source $sourceFile.FullName -Destination $destination -Root $portable -BackupRoot $portableBackupRoot
}

$machineShim = Join-Path $piRoot "pi-docs.cmd"
$portableShim = Join-Path $portable "pi-docs.cmd"
$machineOwned = @($machineFiles.Destination) + $machineShim + (Join-Path $piRoot "pi-docs-kb.json")
$portableOwned = @($portableFiles.Destination) + $portableShim + (Join-Path $portable "pi-docs-kb.json")
Write-ManagedText -Destination $machineShim -Content (New-CliShim -ProjectRootValue $projectRoot -DataRoot $vault) -Root $piRoot -BackupRoot $machineBackupRoot
Write-ManagedText -Destination $portableShim -Content (New-CliShim -ProjectRootValue $portable -DataRoot $portableData) -Root $portable -BackupRoot $portableBackupRoot

$machinePointerPath = Join-Path $piRoot "pi-docs-kb.json"
$portablePointerPath = Join-Path $portable "pi-docs-kb.json"
Write-ManagedText -Destination $machinePointerPath -Content (Get-PointerJson -DataRoot $vault -ManifestHash $manifestHash -InstalledFiles $machineOwned) -Root $piRoot -BackupRoot $machineBackupRoot
Write-ManagedText -Destination $portablePointerPath -Content (Get-PointerJson -DataRoot $portableData -ManifestHash $manifestHash -InstalledFiles $portableOwned) -Root $portable -BackupRoot $portableBackupRoot

Write-Output "Installed Pi docs integration under $piRoot."
Write-Output "Portable output written to $portable."
Write-Output "Machine backup root: $machineBackupRoot"
Write-Output "Portable backup root: $portableBackupRoot"
