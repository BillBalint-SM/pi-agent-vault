# Read-only preflight. The only diskpart shrink form used here is QUERYMAX; it does not resize.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [switch]$QueryShrink
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$utf8 = [Text.UTF8Encoding]::new($false)
function Save([string]$Name, [object]$Value) {
  [IO.File]::WriteAllText((Join-Path $OutputDirectory $Name), [string]$Value, $utf8)
  Write-Output ('SAVED ' + $Name)
}
Save 'recovery.txt' ((& reagentc.exe /info 2>&1 | Out-String) + "`nExitCode=$LASTEXITCODE")
Save 'firmware-boot.txt' ((& bcdedit.exe /enum firmware 2>&1 | Out-String) + "`nExitCode=$LASTEXITCODE")
$tools = @('wbadmin.exe','tar.exe','wsl.exe') | ForEach-Object {
  $c = Get-Command $_ -ErrorAction SilentlyContinue
  [pscustomobject]@{name=$_; available=($null -ne $c); path=$c.Source}
}
Save 'tools.json' (ConvertTo-Json -InputObject $tools -Depth 4)
# Storage-provider metadata may stall independently of classic Win32 inventory; the parent task has a hard timeout.
Write-Output 'BEGIN native GPT partition metadata'
try {
  $parts = Get-Partition -DiskNumber 0 -ErrorAction Stop | Select-Object DiskNumber,PartitionNumber,DriveLetter,Type,GptType,Offset,Size,IsBoot,IsSystem,IsHidden
  Save 'native-partitions.json' (ConvertTo-Json -InputObject @($parts) -Depth 5)
} catch { Save 'native-partitions-error.txt' $_.Exception.Message }
if ($QueryShrink) {
  Write-Output 'BEGIN diskpart shrink QUERYMAX only; use a bounded supervising task'
  $script = Join-Path $OutputDirectory 'query-only.diskpart.txt'
  [IO.File]::WriteAllText($script, "select volume C`r`nshrink querymax`r`nexit`r`n", [Text.Encoding]::ASCII)
  Save 'shrink-querymax.txt' ((& diskpart.exe /s $script 2>&1 | Out-String) + "`nExitCode=$LASTEXITCODE")
} else {
  Write-Output 'SKIPPED shrink query: explicit -QueryShrink required; the earlier query timed out and must not be retried blindly.'
}
Write-Output 'DONE: no volume/partition/boot configuration was changed.'
