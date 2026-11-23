# cleanup-dev.ps1 — orphan (parent'i olmus) dev sureclerini temizler.
# GUVENLI: yalnizca parent PID'i artik var olmayan node sureclerini (vite/esbuild/MCP)
# ve orphan bash agaclarini keser. AKTIF Claude oturumlarina ve onlarin canli
# cocuklarina DOKUNMAZ (parent'lari hayatta oldugu icin atlanir).
# Kullanim:  powershell -ExecutionPolicy Bypass -File scripts\cleanup-dev.ps1
#            -WhatIf parametresiyle once ne kesecegini goster (kesmeden)
param([switch]$WhatIf)

$alive = @{}
Get-Process | ForEach-Object { $alive[$_.Id] = $true }

$killed = 0
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='bash.exe'" | ForEach-Object {
  $p = $_
  $parentDead = -not $alive.ContainsKey([int]$p.ParentProcessId)
  if (-not $parentDead) { return }                      # parent hayatta -> aktif is, atla
  $cl = "$($p.CommandLine)"
  $isDevJunk = ($p.Name -eq 'bash.exe') -or
               ($cl -match 'vite|esbuild|rive-mcp|mcp-server|typingsInstaller') -or
               ($cl -match 'node -e')                    # claude-mem/bootstrap yardimcilari
  if (-not $isDevJunk) { return }
  $ram = [math]::Round($p.WorkingSetSize/1MB)
  $tag = ($cl -replace '"','').Substring(0, [math]::Min(80, $cl.Length))
  if ($WhatIf) {
    "KESILECEK  PID $($p.ProcessId)  $($p.Name)  ${ram}MB  $tag"
  } else {
    taskkill /PID $($p.ProcessId) /T /F 2>&1 | Out-Null
    "KESILDI    PID $($p.ProcessId)  $($p.Name)  ${ram}MB"
    $killed++
  }
}
if (-not $WhatIf) { "Toplam $killed orphan surec temizlendi." }
