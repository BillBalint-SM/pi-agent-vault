# Read-only, shallow Windows inventory. No recursive traversal, hydration, copy, deletion or disk changes.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [string]$BackupRoot
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$utf8 = [System.Text.UTF8Encoding]::new($false)
function Save-Result([string]$Name, [scriptblock]$Query) {
  Write-Output ("BEGIN " + $Name)
  try {
    $data = @(& $Query)
    $record = [ordered]@{status='ok'; observedAt=[DateTime]::UtcNow.ToString('o'); data=$data}
  } catch {
    $record = [ordered]@{status='error'; observedAt=[DateTime]::UtcNow.ToString('o'); error=$_.Exception.Message}
  }
  [IO.File]::WriteAllText((Join-Path $OutputDirectory ($Name + '.json')), (ConvertTo-Json -InputObject $record -Depth 8), $utf8)
  Write-Output ("SAVED " + $Name + ' ' + $record.status)
}
Save-Result 'privilege' {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  [pscustomobject]@{elevated=([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)}
}
Save-Result 'disks' {
  Get-CimInstance Win32_DiskDrive -OperationTimeoutSec 10 | Select-Object Index,Model,Size,InterfaceType,MediaType,Partitions,Status
}
Save-Result 'partitions' {
  Get-CimInstance Win32_DiskPartition -OperationTimeoutSec 10 | Select-Object DeviceID,DiskIndex,Index,Type,Size,StartingOffset,BootPartition,PrimaryPartition
}
Save-Result 'drive-mapping' {
  Get-CimInstance Win32_LogicalDiskToPartition -OperationTimeoutSec 10 | ForEach-Object {
    [pscustomobject]@{partition=$_.Antecedent.DeviceID; drive=$_.Dependent.DeviceID}
  }
}
Save-Result 'volumes' {
  Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3 OR DriveType=2' -OperationTimeoutSec 10 | Select-Object DeviceID,VolumeName,FileSystem,Size,FreeSpace,DriveType
}
Save-Result 'top-level-only' {
  foreach ($root in @('C:\', $env:USERPROFILE, 'D:\')) {
    if (Test-Path -LiteralPath $root -PathType Container) {
      Get-ChildItem -LiteralPath $root -Force -ErrorAction Stop | ForEach-Object {
        [pscustomobject]@{root=$root; name=$_.Name; directory=$_.PSIsContainer; attributes=[string]$_.Attributes; length=if($_.PSIsContainer){$null}else{$_.Length}; linkType=$_.LinkType; target=$_.Target}
      }
    }
  }
}
Save-Result 'active-stateful-processes' {
  Get-Process -ErrorAction Stop | Where-Object {$_.ProcessName -match '^(robocopy|vmwp|vmms|vmmem.*|wsl.*|postgres|mysqld|sqlservr|docker.*|7z.*)$'} | Select-Object ProcessName,Id
}
if ($BackupRoot) {
  Save-Result 'partial-backup-summary' {
    foreach ($name in @('status.txt','results.json','README.txt')) {
      $file = Join-Path $BackupRoot $name
      if (Test-Path -LiteralPath $file -PathType Leaf) {
        [pscustomobject]@{name=$name; content=[IO.File]::ReadAllText($file)}
      }
    }
    $logs = Join-Path $BackupRoot 'Logs'
    if (Test-Path -LiteralPath $logs -PathType Container) {
      Get-ChildItem -LiteralPath $logs -File | Select-Object Name,Length,LastWriteTimeUtc
    }
  }
}
Write-Output 'DONE: metadata only. No backup completeness, shrinkability, disk health or recoverability has been established by this inventory.'
