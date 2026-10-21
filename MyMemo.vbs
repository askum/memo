Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

venvPython = currentDir & "\.venv\Scripts\pythonw.exe"

If fso.FileExists(venvPython) Then
    WshShell.CurrentDirectory = currentDir
    WshShell.Run Chr(34) & venvPython & Chr(34) & " main.py", 0, False
Else
    WshShell.CurrentDirectory = currentDir
    WshShell.Run "pythonw main.py", 0, False
End If
