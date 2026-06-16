; 文匠 Studio — NSIS 安装目录自定义
; 安装文件夹使用英文 literary-studio（避免中文路径问题）
; 快捷方式名称仍由 package.json nsis.shortcutName 控制（文匠 Studio）
; StrContains.nsh 由 electron-builder 模板已引入，此处勿重复 include

!define INSTALL_DIR_NAME "literary-studio"

!macro customInit
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${INSTALL_DIR_NAME}"
!macroend

; 目录页点「下一步」时补全子目录（如 E:\ → E:\literary-studio）
Function .onVerifyInstDir
  Call NormalizeInstallDirPath
FunctionEnd

; 修正 electron-builder 内置 instFilesPre 可能追加的产品目录名
; 安装时清空 userData/data，避免重装后仍看到 pytest/历史项目
!macro customInstall
  Call NormalizeInstallDirPath
  RMDir /r "$APPDATA\literary-studio\data"
!macroend

Function NormalizeInstallDirPath
  ; 若路径末尾被追加了 \${APP_FILENAME}，去掉
  StrLen $1 "${APP_FILENAME}"
  StrCpy $0 $INSTDIR "" -$1
  StrCmp $0 "\${APP_FILENAME}" 0 +3
    IntOp $1 $1 + 1
    StrCpy $INSTDIR $INSTDIR -$1

  ; 若路径中还没有 literary-studio，则追加
  StrLen $1 "${INSTALL_DIR_NAME}"
  StrCpy $0 $INSTDIR "" -$1
  StrCmp $0 "\${INSTALL_DIR_NAME}" +2 0
    StrCpy $INSTDIR "$INSTDIR\${INSTALL_DIR_NAME}"
FunctionEnd
