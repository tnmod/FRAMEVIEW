$ErrorActionPreference = 'Stop'
$desktop = Join-Path $PSScriptRoot '../desktop'

function Test-FileHash($Path, $ExpectedHash) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }

    $stream = [IO.File]::OpenRead((Resolve-Path -LiteralPath $Path).Path)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        ([BitConverter]::ToString($sha256.ComputeHash($stream)).Replace('-', '') -eq $ExpectedHash)
    } finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

function Install-NativeArchive($Name, $Url, $ArchiveHash, $Files) {
    $pending = @($Files | Where-Object { -not (Test-FileHash $_.Destination $_.Hash) })
    if ($pending.Count -eq 0) {
        Write-Host "$Name is ready."
        return
    }

    Write-Host "Downloading $Name..."
    $archive = [IO.Path]::GetTempFileName()
    try {
        & curl.exe --fail --silent --show-error --location --retry 3 --output $archive $Url
        if ($LASTEXITCODE -ne 0 -or -not (Test-FileHash $archive $ArchiveHash)) {
            throw "Download or SHA-256 verification failed for $Name."
        }

        foreach ($file in $pending) {
            $directory = Split-Path -Parent $file.Destination
            New-Item -ItemType Directory -Force -Path $directory | Out-Null
            $staging = Join-Path $directory ([guid]::NewGuid().ToString())
            New-Item -ItemType Directory -Path $staging | Out-Null
            try {
                & tar.exe -xf $archive -C $staging $file.Entry
                $extracted = Join-Path $staging $file.Entry
                if ($LASTEXITCODE -ne 0 -or -not (Test-FileHash $extracted $file.Hash)) {
                    throw "Extraction or SHA-256 verification failed for $($file.Entry)."
                }

                for ($attempt = 1; $attempt -le 5; $attempt++) {
                    try {
                        if (Test-FileHash $file.Destination $file.Hash) { break }
                        if (Test-Path -LiteralPath $file.Destination) {
                            [IO.File]::Replace($extracted, $file.Destination, [NullString]::Value)
                        } else {
                            [IO.File]::Move($extracted, $file.Destination)
                        }
                        break
                    } catch [IO.IOException] {
                        if ($attempt -eq 5) { throw }
                        Start-Sleep -Seconds 1
                    }
                }
            } finally {
                # tar creates intermediate directories for nested entries.
                $resolvedStaging = (Resolve-Path -LiteralPath $staging).Path
                $resolvedParent = (Resolve-Path -LiteralPath $directory).Path
                if ((Split-Path -Parent $resolvedStaging) -eq $resolvedParent) {
                    Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
                }
            }
        }
    } finally {
        Remove-Item -LiteralPath $archive -Force
    }
}

Install-NativeArchive 'libmpv (fe753a7824)' `
    'https://github.com/zhongfly/mpv-winbuild/releases/download/2026-11-12-fe753a7824/mpv-dev-lgpl-x86_64-20261112-git-fe753a7824.7z' `
    '9b9f903e08a216d6636280042b98ee20b972a7321735ab3d1710c00881f47dcc' @(
        @{
            Entry = 'libmpv-2.dll'
            Destination = Join-Path $desktop 'lib/libmpv-2.dll'
            Hash = 'f58bf9be2b6d791a570b1c1e9e45f90bbad9e022c65b379a371b09629c09cca6'
        }
    )

$config = Get-Content -LiteralPath (Join-Path $desktop 'tauri.conf.json') -Raw | ConvertFrom-Json
$webview = $config.bundle.windows.webviewInstallMode.path
$webviewDirectory = Join-Path $desktop $webview
$webviewExecutable = Join-Path $webviewDirectory 'msedgewebview2.exe'
$webviewHash = '9d3646e6bbcb4f41546179bd47c08a928f2c942b0be46f5f528f72daa056739c'
if (-not (Test-FileHash $webviewExecutable $webviewHash)) {
    Write-Host "Downloading $webview..."
    $archive = [IO.Path]::GetTempFileName()
    $staging = Join-Path (Resolve-Path -LiteralPath $desktop).Path ([guid]::NewGuid().ToString())
    try {
        $url = "https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/1a76b522-6d76-4107-955b-8eea7dc5068d/$webview.cab"
        & curl.exe --fail --silent --show-error --location --retry 3 --output $archive $url
        if ($LASTEXITCODE -ne 0 -or -not (Test-FileHash $archive '9a7ac986794cee0edf2403aac9560043592a599e33a9808a24761aaa4ac9c01f')) {
            throw 'Download or SHA-256 verification failed for WebView2.'
        }

        New-Item -ItemType Directory -Path $staging | Out-Null
        & expand.exe $archive '-F:*' $staging | Out-Null
        $extracted = Join-Path $staging $webview
        if ($LASTEXITCODE -ne 0 -or -not (Test-FileHash (Join-Path $extracted 'msedgewebview2.exe') $webviewHash)) {
            throw 'Extraction or SHA-256 verification failed for WebView2.'
        }

        if (Test-Path -LiteralPath $webviewDirectory) {
            $resolvedWebview = Get-Item -LiteralPath $webviewDirectory
            if (($resolvedWebview.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
                ($resolvedWebview.Parent.FullName -ne (Resolve-Path -LiteralPath $desktop).Path)) {
                throw 'Unexpected WebView2 runtime directory.'
            }
            Remove-Item -LiteralPath $resolvedWebview.FullName -Recurse -Force
        }
        try {
            [IO.Directory]::Move($extracted, (Join-Path (Resolve-Path -LiteralPath $desktop).Path $webview))
        } catch [IO.IOException] {
            if (-not (Test-FileHash $webviewExecutable $webviewHash)) { throw }
        }
    } finally {
        if (Test-Path -LiteralPath $staging) {
            $resolvedStaging = (Resolve-Path -LiteralPath $staging).Path
            if ((Split-Path -Parent $resolvedStaging) -eq (Resolve-Path -LiteralPath $desktop).Path) {
                Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
            }
        }
        Remove-Item -LiteralPath $archive -Force
    }
}
Write-Host 'WebView2 Runtime is ready.'

$ffmpeg = 'ffmpeg-n9.0.2-57-gd838f9f9ae-win64-lgpl-9.0'
Install-NativeArchive 'FFprobe (d838f9f9ae)' `
    "https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/autobuild-2026-11-12-15-40/$ffmpeg.zip" `
    '7a7d4b2adafe4b2de2a0fe0077a37e3d1dae43de28df38538ca79bc5d861e33e' @(
        @{
            Entry = "$ffmpeg/bin/ffprobe.exe"
            Destination = Join-Path $desktop 'binaries/ffprobe-x86_64-pc-windows-msvc.exe'
            Hash = '23c2b75159cf473d70a4883786deb3c76ea34a1aa6b5598a44e94a04824b25bb'
        }
        @{
            Entry = "$ffmpeg/LICENSE.txt"
            Destination = Join-Path $desktop 'lib/FFmpeg-LICENSE.txt'
            Hash = 'da7eabb7bafdf7d3ae5e9f223aa5bdc1eece45ac569dc21b3b037520b4464768'
        }
    )
