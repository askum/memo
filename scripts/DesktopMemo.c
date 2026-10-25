#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <shellapi.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <wchar.h>

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "shell32.lib")

static BOOL IsPortListening(int port) {
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        return FALSE;
    }

    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) {
        WSACleanup();
        return FALSE;
    }

    u_long nonBlocking = 1;
    ioctlsocket(s, FIONBIO, &nonBlocking);

    struct sockaddr_in addr;
    ZeroMemory(&addr, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons((u_short)port);
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");

    connect(s, (struct sockaddr*)&addr, sizeof(addr));

    fd_set writeSet;
    FD_ZERO(&writeSet);
    FD_SET(s, &writeSet);

    struct timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 300000; // 300ms

    int selectRes = select(0, NULL, &writeSet, NULL, &tv);
    BOOL isAlive = (selectRes > 0);

    closesocket(s);
    WSACleanup();
    return isAlive;
}

static void OpenBrowserApp(const wchar_t* url) {
    wchar_t appArg[512];
    wsprintfW(appArg, L"--app=%s", url);

    // Try MS Edge (Built into Windows 10/11)
    HINSTANCE hEdge = ShellExecuteW(NULL, L"open", L"msedge.exe", appArg, NULL, SW_SHOWNORMAL);
    if ((INT_PTR)hEdge > 32) return;

    // Try Google Chrome
    HINSTANCE hChrome = ShellExecuteW(NULL, L"open", L"chrome.exe", appArg, NULL, SW_SHOWNORMAL);
    if ((INT_PTR)hChrome > 32) return;

    // Fallback to default browser
    ShellExecuteW(NULL, L"open", url, NULL, NULL, SW_SHOWNORMAL);
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(NULL, exePath, MAX_PATH);

    // Get Directory of executable
    wchar_t dirPath[MAX_PATH];
    wcscpy(dirPath, exePath);
    wchar_t* lastSlash = wcsrchr(dirPath, L'\\');
    if (lastSlash) {
        *lastSlash = L'\0';
    } else {
        wcscpy(dirPath, L".");
    }

    wchar_t serverJs[MAX_PATH];
    wsprintfW(serverJs, L"%s\\server.js", dirPath);

    // Check if server.js exists
    if (GetFileAttributesW(serverJs) == INVALID_FILE_ATTRIBUTES) {
        MessageBoxW(NULL,
            L"server.js 파일을 찾을 수 없습니다.\nDesktopMemo.exe 파일이 memo 프로젝트 폴더 안에 있는지 확인해 주세요.",
            L"Desktop Memo - 오류",
            MB_ICONERROR | MB_OK);
        return 1;
    }

    // Check if server is already running on port 3333
    if (IsPortListening(3333)) {
        OpenBrowserApp(L"http://localhost:3333");
        return 0;
    }

    // Find node.exe in PATH or common directories
    wchar_t nodePath[MAX_PATH];
    DWORD found = SearchPathW(NULL, L"node.exe", NULL, MAX_PATH, nodePath, NULL);
    if (found == 0) {
        // Check standard locations
        const wchar_t* commonPaths[] = {
            L"C:\\Program Files\\nodejs\\node.exe",
            L"C:\\Program Files (x86)\\nodejs\\node.exe"
        };
        for (int i = 0; i < 2; i++) {
            if (GetFileAttributesW(commonPaths[i]) != INVALID_FILE_ATTRIBUTES) {
                wcscpy(nodePath, commonPaths[i]);
                found = 1;
                break;
            }
        }
    }

    if (found == 0) {
        int res = MessageBoxW(NULL,
            L"Desktop Memo를 실행하려면 Node.js가 필요합니다.\n\nNode.js 공식 다운로드 페이지(https://nodejs.org)로 이동하시겠습니까?",
            L"Desktop Memo - Node.js 필요",
            MB_ICONWARNING | MB_YESNO | MB_DEFBUTTON1);
        if (res == IDYES) {
            ShellExecuteW(NULL, L"open", L"https://nodejs.org", NULL, NULL, SW_SHOWNORMAL);
        }
        return 1;
    }

    // Launch node server.js completely hidden without console window
    wchar_t cmdLine[MAX_PATH * 3];
    wsprintfW(cmdLine, L"\"%s\" \"%s\"", nodePath, serverJs);

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    ZeroMemory(&pi, sizeof(pi));

    BOOL success = CreateProcessW(
        nodePath,
        cmdLine,
        NULL,
        NULL,
        FALSE,
        CREATE_NO_WINDOW | DETACHED_PROCESS,
        NULL,
        dirPath,
        &si,
        &pi
    );

    if (success) {
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
    } else {
        MessageBoxW(NULL,
            L"서버 실행에 실패했습니다. 관리자 권한이나 실행 설정을 확인해 주세요.",
            L"Desktop Memo - 실행 오류",
            MB_ICONERROR | MB_OK);
        return 1;
    }

    return 0;
}
