# Converts HEIC images that carry a .jpg/.jpeg/.png extension into real JPEG
# files (in place), using the Windows built-in HEIF/HEVC imaging codec.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File assets/util/convert-heic.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File assets/util/convert-heic.ps1 -Dir assets/paintings
#
# Why: browsers cannot decode HEIC. Phones often save HEIC files that get
# renamed to .jpg, which then fail to load in <img> tags on the gallery cards.

param(
    [string]$Dir = "assets"
)

$ErrorActionPreference = "Stop"

# Detect HEIC files by inspecting the ISO-BMFF 'ftyp' box brand, regardless of
# the file extension.
function Test-Heic([string]$Path) {
    $b = [System.IO.File]::ReadAllBytes($Path)
    if ($b.Length -lt 12) { return $false }
    $ftyp = -join ($b[4..7] | ForEach-Object { [char]$_ })
    $brand = -join ($b[8..11] | ForEach-Object { [char]$_ })
    return ($ftyp -eq 'ftyp' -and ($brand -match 'hei|mif|hev|msf'))
}

$targets = Get-ChildItem (Join-Path $Dir '*') -Include *.jpg, *.jpeg, *.png -File -Recurse |
    Where-Object { Test-Heic $_.FullName }

if (-not $targets) {
    Write-Host "No HEIC-in-jpg/png files found under '$Dir'."
    return
}

Write-Host "Found $($targets.Count) HEIC file(s) to convert:"
$targets | ForEach-Object { Write-Host "  $($_.FullName)" }

# Use Windows.Graphics.Imaging (WinRT) to decode HEIC and re-encode as JPEG.
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

function Await($op, $resultType) {
    $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($op))
    $task.Wait() | Out-Null
    return $task.Result
}

function AwaitAction($action) {
    $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
    $task = $asTask.Invoke($null, @($action))
    $task.Wait() | Out-Null
}

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapEncoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime] | Out-Null

$jpegEncoderId = [Windows.Graphics.Imaging.BitmapEncoder]::JpegEncoderId

foreach ($file in $targets) {
    $full = $file.FullName
    Write-Host "Converting $($file.Name) ..." -NoNewline

    $sf = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($full)) ([Windows.Storage.StorageFile])
    $stream = Await ($sf.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $pixelProvider = Await ($decoder.GetPixelDataAsync()) ([Windows.Graphics.Imaging.PixelDataProvider])
    $pixels = $pixelProvider.DetachPixelData()
    $stream.Dispose()

    $memStream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $encoder = Await ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync($jpegEncoderId, $memStream)) ([Windows.Graphics.Imaging.BitmapEncoder])
    $encoder.SetPixelData(
        $decoder.BitmapPixelFormat,
        $decoder.BitmapAlphaMode,
        $decoder.PixelWidth,
        $decoder.PixelHeight,
        $decoder.DpiX,
        $decoder.DpiY,
        $pixels)
    AwaitAction ($encoder.FlushAsync())

    # Read the encoded JPEG bytes back out of the in-memory stream.
    $size = [uint32]$memStream.Size
    $reader = New-Object Windows.Storage.Streams.DataReader($memStream.GetInputStreamAt(0))
    Await ($reader.LoadAsync($size)) ([uint32]) | Out-Null
    $bytes = New-Object byte[] $size
    $reader.ReadBytes($bytes)
    $reader.Dispose()
    $memStream.Dispose()

    $w = $decoder.PixelWidth
    $h = $decoder.PixelHeight

    # Release WinRT handles that keep the source file memory-mapped before writing.
    $decoder = $null
    $pixelProvider = $null
    $sf = $null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
    [GC]::Collect()

    $tmp = "$full.tmp"
    [System.IO.File]::WriteAllBytes($tmp, $bytes)
    [System.IO.File]::Delete($full)
    [System.IO.File]::Move($tmp, $full)
    Write-Host " done ($w x $h, $([math]::Round($size/1KB)) KB)"
}

Write-Host "Conversion complete."
