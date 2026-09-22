$ErrorActionPreference = 'Stop'
$outDir = Join-Path (Get-Location) '.local/recording'
function Browser { & 'C:/Program Files/nodejs/node.exe' 'C:/Program Files/nodejs/node_modules/npm/bin/npx-cli.js' agent-browser --session regretless @args; if ($LASTEXITCODE -ne 0) { throw 'Browser recording action failed' } }
function Click($name) { Browser find role button click --name $name }
Browser open 'http://127.0.0.1:5173'
Browser snapshot -i
Browser record start (Join-Path $outDir 'pickups-raw.mp4') --cursor --fps 5
$timer = [Diagnostics.Stopwatch]::StartNew()
$marks = @()
function Mark($name) { $script:marks += @{name=$name;start=$timer.Elapsed.TotalSeconds} }
try {
 Mark 'receipt'
 Click 'Add a purchase'
 Browser snapshot -i
 Browser find label 'Receipt text' fill 'DEMO RECEIPT - Nova Electronics (fictional merchant). Order DEMO-1042. Sony WH-1000XM5 wireless headphones, black. Quantity 1. Unit price paid USD 449.00. This is a fictional purchase for the Regretless walkthrough.'
 Start-Sleep -Seconds 5
 Mark 'transition'
 Click 'Close dialog'
 Click 'Get my $50 back'
 Browser snapshot -i
 Mark 'policy'
 Click 'Policy & evidence'
 Start-Sleep -Seconds 1
 Browser scroll down 400 --selector dialog
 Start-Sleep -Seconds 5
 Mark 'transition2'
 Browser scroll up 1000 --selector dialog
 Mark 'draft'
 Click 'Claim request'
 Start-Sleep -Seconds 1
 Browser scroll down 450 --selector dialog
 Start-Sleep -Seconds 5
 Mark 'end'
} finally {
 $marks | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outDir 'pickup-marks.json')
 Browser record stop
}
