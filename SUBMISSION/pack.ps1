# Regenerates SUBMISSION/ from the live root sources.
# Never edit a file inside SUBMISSION directly - edit the root copy, then re-run this.
$root = Split-Path $PSScriptRoot
$dst  = Join-Path $root 'SUBMISSION'

$stale = @('dvm-web\src', 'dvm-web\node_modules', 'dvm-web\dist', 'dvm-web\.vite', 'dvm-web\public', 'dvm-web\package-lock.json', 'dvm-web\vitest.config.js', 'python_tkinter', '__pycache__', 'tests\__pycache__', 'db')
foreach ($p in $stale) {
    $full = Join-Path $dst $p
    if (Test-Path -LiteralPath $full) { Remove-Item -LiteralPath $full -Recurse -Force }
}

# Top-level documents
Copy-Item -Force "$root\DVM_Project_Report.md","$root\README.md","$root\TODO_LIST.md" $dst

# Python implementation (archived sprint-1 reference only)
New-Item -ItemType Directory -Force "$dst\archive\python_tkinter_sprint1" | Out-Null
Copy-Item -Force "$root\archive\python_tkinter_sprint1\digital_voting_machine.py" "$dst\archive\python_tkinter_sprint1\digital_voting_machine.py"
Copy-Item -Force "$root\tests\test_python.py" "$dst\tests\test_python.py"

# Demo backend (optional, not called by the app)
if (Test-Path "$root\server") {
  New-Item -ItemType Directory -Force "$dst\server" | Out-Null
  Copy-Item -Force "$root\server\dvm_server.py","$root\server\demo.html","$root\server\test_server.py" "$dst\server\"
}

# Tests
Copy-Item -Force "$root\tests\test_python.py" "$dst\tests\test_python.py"

# dvm-web source (no node_modules / dist / caches / logs)
New-Item -ItemType Directory -Force "$dst\dvm-web" | Out-Null
Copy-Item -Recurse -Force "$root\dvm-web\src" "$dst\dvm-web\src"
Copy-Item -Force "$root\dvm-web\index.html","$root\dvm-web\vite.config.js","$root\dvm-web\vitest.config.js","$root\dvm-web\package.json","$root\dvm-web\package-lock.json","$root\dvm-web\README.md","$root\dvm-web\.npmrc","$root\dvm-web\favicon.svg","$root\dvm-web\.oxlintrc.json" "$dst\dvm-web\"
Copy-Item -Recurse -Force "$root\dvm-web\public" "$dst\dvm-web\public"

Write-Host "SUBMISSION regenerated from $root"
