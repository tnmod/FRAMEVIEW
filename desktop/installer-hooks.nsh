!macro NSIS_HOOK_POSTINSTALL
  ; WebView2 Fixed Version requires AppContainer read access on Windows 10.
  nsExec::ExecToLog '"$SYSDIR\icacls.exe" "$INSTDIR\Microsoft.WebView2.FixedVersionRuntime.157.0.4341.57.x64" /grant "*S-1-15-2-1:(OI)(CI)(RX)" "*S-1-15-2-2:(OI)(CI)(RX)"'
  Pop $0
  ${If} $0 != 0
    Abort "Could not set permissions for the bundled WebView2 Runtime."
  ${EndIf}
!macroend
