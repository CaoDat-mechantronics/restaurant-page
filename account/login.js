const API_BASE_URL = "https://restaurant-api-t6pq.onrender.com";
const AUTH_TOKEN_KEY = "restaurant_access_token";
const AUTH_USER_KEY = "restaurant_user";
// ======================================================
// ELEMENTS
// ======================================================
const loginForm =
    document.getElementById("loginForm");
const usernameInput =
    document.getElementById("usernameInput");
const passwordInput =
    document.getElementById("passwordInput");
const loginButton =
    document.getElementById("loginButton");
const loginMessage =
    document.getElementById("loginMessage");
// ======================================================
// HIỂN THỊ THÔNG BÁO
// ======================================================
function showLoginMessage(
    message,
    isError = true
) {
    loginMessage.textContent =
        message;
    loginMessage.classList.remove(
        "hidden",
        "success"
    );
    loginMessage.classList.toggle(
        "error",
        isError
    );
    loginMessage.classList.toggle(
        "success",
        !isError
    );
}
// ======================================================
// XÓA TOKEN + USER LOCAL
// ======================================================
function clearStoredAuth() {
    localStorage.removeItem(
        AUTH_TOKEN_KEY
    );
    localStorage.removeItem(
        AUTH_USER_KEY
    );
}
// ======================================================
// ĐỌC MESSAGE LỖI TỪ FASTAPI
// ======================================================
async function getErrorMessage(
    response
) {
    try {
        const data =
            await response.json();
        if (
            typeof data.detail ===
            "string"
        ) {
            return data.detail;
        }
        return (
            `Server trả về lỗi ${response.status}`
        );
    }
    catch {
        return (
            `Server trả về lỗi ${response.status}`
        );
    }
}
// ======================================================
// KIỂM TRA USER ĐÃ ĐĂNG NHẬP CHƯA
//
// Nếu đã có token:
//     GET /auth/me
//
// Nếu token còn hợp lệ:
//     chuyển thẳng sang index.html
//
// Nếu token hết hạn / sai:
//     xóa token
//     vẫn ở login.html
// ======================================================
async function checkExistingSession() {
    const token =
        localStorage.getItem(
            AUTH_TOKEN_KEY
        );
    if (!token) {
        return;
    }
    try {
        const response =
            await fetch(
                `${API_BASE_URL}/auth/me`,
                {
                    method:
                        "GET",
                    headers: {
                        "Authorization":
                            `Bearer ${token}`,
                        "ngrok-skip-browser-warning":
                            "1"
                    },
                    cache:
                        "no-store"
                }
            );
        // =============================================
        // TOKEN KHÔNG CÒN HỢP LỆ
        // =============================================
        if (!response.ok) {
            clearStoredAuth();
            return;
        }
        // =============================================
        // TOKEN HỢP LỆ
        // =============================================
        const user =
            await response.json();
        localStorage.setItem(
            AUTH_USER_KEY,
            JSON.stringify(
                user
            )
        );
        // Người dùng đã đăng nhập rồi
        // => không cần login lại.
        window.location.replace(
            "index.html"
        );
    }
    catch (error) {
        console.error(
            "Session check error:",
            error
        );
    }
}
// ======================================================
// SUBMIT LOGIN
// ======================================================
loginForm.addEventListener(
    "submit",
    async event => {
        event.preventDefault();
        // =============================================
        // LẤY USERNAME / PASSWORD
        // =============================================
        const username =
            usernameInput.value.trim();
        const password =
            passwordInput.value;
        // =============================================
        // KIỂM TRA RỖNG
        // =============================================
        if (!username) {
            showLoginMessage(
                "Hãy nhập tên đăng nhập."
            );
            usernameInput.focus();
            return;
        }
        if (!password) {
            showLoginMessage(
                "Hãy nhập mật khẩu."
            );
            passwordInput.focus();
            return;
        }
        // =============================================
        // TRẠNG THÁI ĐANG LOGIN
        // =============================================
        loginButton.disabled =
            true;
        loginButton.textContent =
            "Đang đăng nhập...";
        loginMessage.classList.add(
            "hidden"
        );
        try {
            // =========================================
            // GỌI API LOGIN
            // =========================================
            const response =
                await fetch(
                    `${API_BASE_URL}/auth/login`,
                    {
                        method:
                            "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                            "ngrok-skip-browser-warning":
                                "1"
                        },
                        body:
                            JSON.stringify(
                                {
                                    username,
                                    password
                                }
                            )
                    }
                );
            // =========================================
            // LOGIN THẤT BẠI
            // =========================================
            if (!response.ok) {
                throw new Error(
                    await getErrorMessage(
                        response
                    )
                );
            }
            // =========================================
            // LOGIN THÀNH CÔNG
            // =========================================
            const data =
                await response.json();
            // Server dự kiến trả:
            //
            // {
            //     access_token: "...",
            //     token_type: "bearer",
            //     user: {
            //         id: "...",
            //         username: "...",
            //         role: "admin" | "manager",
            //         active: true
            //     }
            // }
            if (!data.access_token) {
                throw new Error(
                    "Server không trả về access token."
                );
            }
            // =========================================
            // LƯU JWT
            // =========================================
            localStorage.setItem(
                AUTH_TOKEN_KEY,
                data.access_token
            );
            // =========================================
            // LƯU USER
            // =========================================
            localStorage.setItem(
                AUTH_USER_KEY,
                JSON.stringify(
                    data.user || {}
                )
            );
            // =========================================
            // CHUYỂN SANG DASHBOARD
            // =========================================
            window.location.replace(
                "index.html"
            );
        }
        catch (error) {
            console.error(
                "Login error:",
                error
            );
            // Xóa dữ liệu login cũ nếu có.
            clearStoredAuth();
            showLoginMessage(
                error.message ||
                "Không thể đăng nhập."
            );
        }
        finally {
            loginButton.disabled =
                false;
            loginButton.textContent =
                "Đăng nhập";
        }
    }
);
// ======================================================
// KHỞI ĐỘNG
// ======================================================
checkExistingSession();
