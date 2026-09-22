$ErrorActionPreference = 'Stop'
$outDir = Join-Path (Get-Location) '.local/recording'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
function Browser { & 'C:/Program Files/nodejs/node.exe' 'C:/Program Files/nodejs/node_modules/npm/bin/npx-cli.js' agent-browser --session regretless @args; if ($LASTEXITCODE -ne 0) { throw 'Browser recording action failed' } }
function Click($name) { Browser find role button click --name $name }
Browser open 'http://127.0.0.1:5173'
Browser set viewport 1440 810
Browser snapshot -i
Start-Sleep -Seconds 2
Browser record start (Join-Path $outDir 'walkthrough-raw.mp4') --cursor --fps 10
$timer = [Diagnostics.Stopwatch]::StartNew()
$marks = @()
function Mark($name) { $script:marks += @{name=$name;start=$timer.Elapsed.TotalSeconds}; Write-Output "Recording scene: $name" }
try {
  Mark 'dashboard'
  Start-Sleep -Seconds 6
  Mark 'receipt'
  Click 'Add a purchase'
  Browser snapshot -i
  Browser find label 'Receipt text' fill 'DEMO RECEIPT - Nova Electronics (fictional merchant). Order DEMO-1042. Sony WH-1000XM5 wireless headphones, black. Quantity 1. Unit price paid USD 449.00. This is a fictional purchase for the Regretless walkthrough.'
  Start-Sleep -Seconds 4
  Mark 'manual'
  Click 'Enter details manually'
  Browser snapshot -i
  Browser find label 'Product name' fill 'Sony WH-1000XM5'
  Browser find label 'Merchant' fill 'Nova Electronics (demo)'
  Browser find label 'Unit price paid' fill '449'
  Start-Sleep -Seconds 3
  Mark 'replay'
  Click 'Close dialog'
  Browser snapshot -i
  Click 'Get my $50 back'
  Browser snapshot -i
  Click 'Replay demo'
  Start-Sleep -Seconds 8
  Mark 'policy'
  Click 'Policy & evidence'
  Browser snapshot -i
  Start-Sleep -Seconds 6
  Mark 'draft'
  Click 'Claim request'
  Browser snapshot -i
  Start-Sleep -Seconds 6
  Mark 'end'
} finally {
  $marks | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outDir 'marks.json')
  Browser record stop
}
