// =============================================
// CẤU HÌNH API
// =============================================

const API_BASE_URL =
    "https://restaurant-api-t6pq.onrender.com";


// =============================================
// CẤU HÌNH SỐ BÀN
// =============================================
//
// Bàn 1:
// const DEFAULT_TABLE_NUMBER = 1;
//
// Bàn 2:
// const DEFAULT_TABLE_NUMBER = 2;
//
// ...
//
// Bàn 10:
// const DEFAULT_TABLE_NUMBER = 10;
//

const DEFAULT_TABLE_NUMBER = 7;


// =============================================
// LẤY CÁC PHẦN TỬ HTML
// =============================================

// Tất cả card món ăn
const foodCards =
    document.querySelectorAll(
        ".food-card"
    );


// Khung món đang chọn
const selectedItemsBox =
    document.getElementById(
        "selectedItems"
    );


// Tổng tiền
const totalPriceBox =
    document.getElementById(
        "totalPrice"
    );


// Nút đặt món
const orderButton =
    document.getElementById(
        "orderButton"
    );


// Input số bàn
const tableNumberInput =
    document.getElementById(
        "tableNumber"
    );


// =============================================
// DANH SÁCH MÓN BÀN ĐÃ ĐẶT
// =============================================

const orderedFoodsList =
    document.getElementById(
        "orderedFoodsList"
    );


const orderedFoodsCount =
    document.getElementById(
        "orderedFoodsCount"
    );


// =============================================
// HIỂN THỊ SỐ BÀN
// =============================================

tableNumberInput.value =
    DEFAULT_TABLE_NUMBER;


// =============================================
// XỬ LÝ TỪNG CARD MÓN ĂN
// =============================================

foodCards.forEach((card) => {

    // Checkbox chọn món
    const checkbox =
        card.querySelector(
            ".food-checkbox"
        );


    // Nút trừ
    const btnMinus =
        card.querySelector(
            ".btn-minus"
        );


    // Nút cộng
    const btnPlus =
        card.querySelector(
            ".btn-plus"
        );


    // Input số lượng
    const quantityInput =
        card.querySelector(
            ".quantity-input"
        );


    // Input ghi chú
    const noteInput =
        card.querySelector(
            ".note-input"
        );


    // =========================================
    // CHECKBOX CHỌN / BỎ CHỌN MÓN
    // =========================================

    checkbox.addEventListener(
        "change",
        () => {

            updateCardSelectedState(
                card
            );

            updateOrderSummary();

        }
    );


    // =========================================
    // NÚT GIẢM SỐ LƯỢNG
    // =========================================

    btnMinus.addEventListener(
        "click",
        () => {

            let currentQuantity =
                parseInt(
                    quantityInput.value
                );


            if (
                isNaN(
                    currentQuantity
                )
            ) {

                currentQuantity = 1;

            }


            if (
                currentQuantity > 1
            ) {

                quantityInput.value =
                    currentQuantity - 1;

            }


            updateOrderSummary();

        }
    );


    // =========================================
    // NÚT TĂNG SỐ LƯỢNG
    // =========================================

    btnPlus.addEventListener(
        "click",
        () => {

            let currentQuantity =
                parseInt(
                    quantityInput.value
                );


            if (
                isNaN(
                    currentQuantity
                )
            ) {

                currentQuantity = 1;

            }


            quantityInput.value =
                currentQuantity + 1;


            updateOrderSummary();

        }
    );


    // =========================================
    // NHẬP SỐ LƯỢNG TRỰC TIẾP
    // =========================================

    quantityInput.addEventListener(
        "input",
        () => {

            let currentQuantity =
                parseInt(
                    quantityInput.value
                );


            if (
                isNaN(
                    currentQuantity
                )
                ||
                currentQuantity < 1
            ) {

                quantityInput.value = 1;

            }


            updateOrderSummary();

        }
    );


    // =========================================
    // KHI THAY ĐỔI GHI CHÚ
    // =========================================

    if (noteInput) {

        noteInput.addEventListener(
            "input",
            () => {

                updateOrderSummary();

            }
        );

    }

});


// =============================================
// ĐỔI TRẠNG THÁI CARD ĐÃ CHỌN
// =============================================

function updateCardSelectedState(
    card
) {

    const checkbox =
        card.querySelector(
            ".food-checkbox"
        );


    if (
        checkbox.checked
    ) {

        card.classList.add(
            "selected"
        );

    }
    else {

        card.classList.remove(
            "selected"
        );

    }

}


// =============================================
// CẬP NHẬT KHUNG ĐƠN HÀNG ĐANG CHỌN
// =============================================

function updateOrderSummary() {

    let total = 0;

    let selectedItemsHtml = "";


    // =========================================
    // DUYỆT TẤT CẢ MÓN
    // =========================================

    foodCards.forEach(
        (card) => {

            const checkbox =
                card.querySelector(
                    ".food-checkbox"
                );


            const quantityInput =
                card.querySelector(
                    ".quantity-input"
                );


            const noteInput =
                card.querySelector(
                    ".note-input"
                );


            // =================================
            // TÊN MÓN
            // =================================

            const foodName =
                card.dataset.name;


            // =================================
            // GIÁ MÓN
            // =================================

            const foodPrice =
                parseInt(
                    card.dataset.price
                );


            // =================================
            // SỐ LƯỢNG
            // =================================

            let quantity =
                parseInt(
                    quantityInput.value
                );


            if (
                isNaN(
                    quantity
                )
                ||
                quantity < 1
            ) {

                quantity = 1;

            }


            // =================================
            // GHI CHÚ
            // =================================

            let note = "";


            if (noteInput) {

                note =
                    noteInput
                        .value
                        .trim();

            }


            // =================================
            // NẾU MÓN ĐƯỢC CHỌN
            // =================================

            if (
                checkbox.checked
            ) {

                const itemTotal =
                    foodPrice
                    *
                    quantity;


                total +=
                    itemTotal;


                let noteText =
                    "";


                if (
                    note !== ""
                ) {

                    noteText =
                        ` (${escapeHtml(note)})`;

                }


                selectedItemsHtml += `
                    <div class="selected-item">

                        <span>
                            ${escapeHtml(foodName)}
                            x ${quantity}${noteText}
                        </span>

                        <strong>
                            ${formatCurrency(itemTotal)}
                        </strong>

                    </div>
                `;

            }

        }
    );


    // =========================================
    // KHÔNG CÓ MÓN ĐƯỢC CHỌN
    // =========================================

    if (
        selectedItemsHtml === ""
    ) {

        selectedItemsBox.innerHTML =
            "Chưa chọn món nào.";

    }
    else {

        selectedItemsBox.innerHTML =
            selectedItemsHtml;

    }


    // =========================================
    // HIỂN THỊ TỔNG TIỀN
    // =========================================

    totalPriceBox.innerText =
        formatCurrency(
            total
        );

}


// =============================================
// ĐỊNH DẠNG TIỀN VNĐ
// =============================================

function formatCurrency(
    value
) {

    return (
        Number(value)
            .toLocaleString(
                "vi-VN"
            )
        +
        " VNĐ"
    );

}


// =============================================
// CHỐNG CHÈN HTML
// =============================================

function escapeHtml(
    text
) {

    return String(text)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// =========================================================
// TẢI DANH SÁCH MÓN BÀN ĐÃ ĐẶT
// =========================================================

async function loadOrderedFoods() {

    // Kiểm tra HTML có tồn tại hay không
    if (
        !orderedFoodsList
        ||
        !orderedFoodsCount
    ) {

        console.warn(
            "Không tìm thấy orderedFoodsList hoặc orderedFoodsCount trong HTML."
        );

        return;

    }


    const tableNumber =
        DEFAULT_TABLE_NUMBER;


    // =========================================
    // HIỂN THỊ LOADING
    // =========================================

    orderedFoodsList.innerHTML = `
        <div class="ordered-foods-loading">
            Đang tải món...
        </div>
    `;


    try {

        // =====================================
        // GỌI API
        // =====================================

        const response =
            await fetch(
                `${API_BASE_URL}/orders/table/${tableNumber}`,
                {
                    method:
                        "GET",

                    cache:
                        "no-store"
                }
            );


        if (
            !response.ok
        ) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        // =====================================
        // ĐỌC JSON
        // =====================================

        const data =
            await response.json();


        console.log(
            `Món đã đặt của bàn ${tableNumber}:`,
            data
        );


        // =====================================
        // HIỂN THỊ
        // =====================================

        renderOrderedFoods(
            data.items || []
        );

    }
    catch (error) {

        console.error(
            "Không tải được món đã đặt:",
            error
        );


        orderedFoodsList.innerHTML = `
            <div class="ordered-foods-empty">
                Không tải được danh sách món.
            </div>
        `;


        orderedFoodsCount.innerText =
            "0 phần";

    }

}


// =========================================================
// HIỂN THỊ DANH SÁCH MÓN BÀN ĐÃ ĐẶT
// =========================================================

function renderOrderedFoods(
    items
) {

    if (
        !orderedFoodsList
        ||
        !orderedFoodsCount
    ) {

        return;

    }


    // =========================================
    // KHÔNG CÓ MÓN
    // =========================================

    if (
        !Array.isArray(
            items
        )
        ||
        items.length === 0
    ) {

        orderedFoodsList.innerHTML = `
            <div class="ordered-foods-empty">
                Bàn chưa đặt món.
            </div>
        `;


        orderedFoodsCount.innerText =
            "0 phần";


        return;

    }


    // =========================================
    // TÍNH TỔNG SỐ PHẦN
    // =========================================

    const totalQuantity =
        items.reduce(
            (
                total,
                item
            ) => {

                return (
                    total
                    +
                    Number(
                        item.quantity || 0
                    )
                );

            },
            0
        );


    orderedFoodsCount.innerText =
        `${totalQuantity} phần`;


    // =========================================
    // MÓN MỚI NHẤT HIỆN TRÊN
    // =========================================

    const sortedItems =
        [...items]
            .reverse();


    // =========================================
    // TẠO HTML
    // =========================================

    const html =
        sortedItems

            .map(
                (item) => {

                    // =========================
                    // TRẠNG THÁI
                    // =========================

                    const status =
                        getOrderedFoodStatus(
                            item
                        );


                    // =========================
                    // GHI CHÚ
                    // =========================

                    let noteHtml =
                        "";


                    if (
                        item.note
                        &&
                        String(
                            item.note
                        )
                            .trim()
                        !==
                        ""
                    ) {

                        noteHtml = `
                            <div class="ordered-food-note">
                                Ghi chú:
                                ${escapeHtml(item.note)}
                            </div>
                        `;

                    }


                    // =========================
                    // HTML CỦA MỘT MÓN
                    // =========================

                    return `
                        <div
                            class="ordered-food-item"
                            data-item-id="${item.id}"
                        >

                            <div class="ordered-food-main">

                                <div class="ordered-food-info">

                                    <div class="ordered-food-name">

                                        ${escapeHtml(
                                            item.food_name
                                        )}

                                    </div>


                                    <div class="ordered-food-quantity">

                                        Số lượng:

                                        <strong>
                                            ${item.quantity}
                                        </strong>

                                    </div>

                                </div>


                                <span
                                    class="food-status ${status.className}"
                                >
                                    ${status.text}
                                </span>

                            </div>


                            ${noteHtml}

                        </div>
                    `;

                }
            )

            .join("");


    orderedFoodsList.innerHTML =
        html;

}


// =========================================================
// XÁC ĐỊNH TRẠNG THÁI MÓN
// =========================================================

// =========================================================
// XÁC ĐỊNH TRẠNG THÁI MÓN
// =========================================================

function getOrderedFoodStatus(item) {

    // =========================================
    // 1. ĐÃ GIAO
    // Ưu tiên cao nhất
    // =========================================

    if (
        item.delivered === true
        ||
        item.delivered === 1
        ||
        item.delivery_status === "delivered"
    ) {

        return {
            text: "✓ Đã giao",
            className: "delivered"
        };

    }


    // =========================================
    // 2. ĐÃ NẤU XONG
    // cooking_status = 2
    // =========================================

    if (
        Number(item.cooking_status) === 2
    ) {

        return {
            text: "✓ Đã nấu xong",
            className: "cooked"
        };

    }


    // =========================================
    // 3. ĐANG NẤU
    // cooking_status = 1
    // =========================================

    if (
        Number(item.cooking_status) === 1
    ) {

        return {
            text: "Đang nấu",
            className: "cooking"
        };

    }


    // =========================================
    // 4. CHƯA NẤU
    // cooking_status = 0
    // =========================================

    return {
        text: "Chờ nấu",
        className: "waiting"
    };

}


// =========================================================
// ĐẶT MÓN
// =========================================================

orderButton.addEventListener(
    "click",
    async () => {

        // =====================================
        // 1. LẤY SỐ BÀN
        // =====================================

        const tableNumber =
            parseInt(
                tableNumberInput.value
            );


        if (
            isNaN(
                tableNumber
            )
            ||
            tableNumber <= 0
        ) {

            alert(
                "Số bàn không hợp lệ."
            );

            return;

        }


        // =====================================
        // 2. LẤY DANH SÁCH MÓN ĐÃ CHỌN
        // =====================================

        const selectedFoods =
            [];


        foodCards.forEach(
            (card) => {

                const checkbox =
                    card.querySelector(
                        ".food-checkbox"
                    );


                const quantityInput =
                    card.querySelector(
                        ".quantity-input"
                    );


                const noteInput =
                    card.querySelector(
                        ".note-input"
                    );


                // =================================
                // CHỈ LẤY MÓN ĐƯỢC CHECK
                // =================================

                if (
                    checkbox.checked
                ) {

                    let quantity =
                        parseInt(
                            quantityInput.value
                        );


                    if (
                        isNaN(
                            quantity
                        )
                        ||
                        quantity < 1
                    ) {

                        quantity = 1;

                    }


                    const price =
                        parseInt(
                            card.dataset.price
                        );


                    selectedFoods.push(
                        {

                            name:
                                card.dataset.name,

                            price:
                                price,

                            quantity:
                                quantity,

                            note:
                                noteInput
                                    ?
                                    noteInput
                                        .value
                                        .trim()
                                    :
                                    ""

                        }
                    );

                }

            }
        );


        // =====================================
        // 3. KIỂM TRA ĐÃ CHỌN MÓN CHƯA
        // =====================================

        if (
            selectedFoods.length === 0
        ) {

            alert(
                "Bạn chưa chọn món nào."
            );

            return;

        }


        // =====================================
        // 4. JSON GỬI CHO FASTAPI
        // =====================================

        const orderData = {

            tableNumber:
                tableNumber,

            foods:
                selectedFoods

        };


        console.log(
            "Dữ liệu chuẩn bị gửi:",
            orderData
        );


        // =====================================
        // 5. KHÓA NÚT
        // =====================================

        orderButton.disabled =
            true;


        orderButton.innerText =
            "Đang đặt món...";


        // =====================================
        // 6. GỌI FASTAPI
        // =====================================

        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/orders`,
                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify(
                                orderData
                            )

                    }
                );


            // =================================
            // 7. ĐỌC RESPONSE
            // =================================

            const result =
                await response.json();


            console.log(
                "HTTP status:",
                response.status
            );


            console.log(
                "FastAPI trả về:",
                result
            );


            // =================================
            // 8. SERVER TRẢ LỖI
            // =================================

            if (
                !response.ok
            ) {

                console.error(
                    "Đặt món lỗi:",
                    result
                );


                let errorMessage =
                    "Đặt món thất bại.";


                if (
                    result.detail
                ) {

                    if (
                        typeof result.detail
                        ===
                        "string"
                    ) {

                        errorMessage =
                            result.detail;

                    }
                    else {

                        errorMessage =
                            JSON.stringify(
                                result.detail
                            );

                    }

                }


                alert(
                    errorMessage
                );


                return;

            }


            // =================================
            // 9. RESET FORM CHỌN MÓN
            // =================================

            foodCards.forEach(
                (card) => {

                    const checkbox =
                        card.querySelector(
                            ".food-checkbox"
                        );


                    const quantityInput =
                        card.querySelector(
                            ".quantity-input"
                        );


                    const noteInput =
                        card.querySelector(
                            ".note-input"
                        );


                    // Bỏ chọn
                    checkbox.checked =
                        false;


                    // Quantity về 1
                    quantityInput.value =
                        1;


                    // Xóa ghi chú
                    if (
                        noteInput
                    ) {

                        noteInput.value =
                            "";

                    }


                    // Xóa viền selected
                    card.classList.remove(
                        "selected"
                    );

                }
            );


            // =================================
            // 10. RESET KHUNG MÓN ĐANG CHỌN
            // =================================

            updateOrderSummary();


            // =================================
            // 11. QUAN TRỌNG:
            // TẢI LẠI MÓN ĐÃ ĐẶT
            // =================================
            //
            // Đây chính là phần file cũ của bạn
            // đang thiếu.
            //
            // Không cần Ctrl + S.
            // Không cần F5.
            //

            await loadOrderedFoods();


            // =================================
            // 12. THÔNG BÁO THÀNH CÔNG
            // =================================

            alert(
                "Đặt món thành công!"
                +
                "\nBàn số: "
                +
                result.table_number
                +
                "\nMã đặt món: "
                +
                result.order_code
                +
                "\nTổng tiền: "
                +
                formatCurrency(
                    result.total
                )
            );

        }
        catch (error) {

            // =================================
            // LỖI KẾT NỐI
            // =================================

            console.error(
                "Lỗi kết nối FastAPI:",
                error
            );


            alert(
                "Không kết nối được tới FastAPI.\n"
                +
                "Kiểm tra server."
            );

        }
        finally {

            // =================================
            // MỞ LẠI NÚT
            // =================================

            orderButton.disabled =
                false;


            orderButton.innerText =
                "Đặt món";

        }

    }
);


// =========================================================
// WEBSOCKET REALTIME
// =========================================================
//
// https://abc.com
// ->
// wss://abc.com
//

const WS_BASE_URL =
    API_BASE_URL.replace(
        /^http/,
        "ws"
    );


let dashboardSocket =
    null;


let reconnectTimer =
    null;


// =========================================================
// KẾT NỐI WEBSOCKET
// =========================================================

function connectDashboardWebSocket() {

    // Không tạo kết nối mới nếu
    // WebSocket hiện tại vẫn hoạt động

    if (
        dashboardSocket
        &&
        (
            dashboardSocket.readyState
            ===
            WebSocket.OPEN
            ||
            dashboardSocket.readyState
            ===
            WebSocket.CONNECTING
        )
    ) {

        return;

    }


    const wsUrl =
        `${WS_BASE_URL}/ws/dashboard`;


    console.log(
        "Đang kết nối WebSocket:",
        wsUrl
    );


    dashboardSocket =
        new WebSocket(
            wsUrl
        );


    // =========================================
    // KẾT NỐI THÀNH CÔNG
    // =========================================

    dashboardSocket.onopen =
        () => {

            console.log(
                "✓ WebSocket đã kết nối."
            );

        };


    // =========================================
    // NHẬN DỮ LIỆU REALTIME
    // =========================================

    dashboardSocket.onmessage =
        async (event) => {

            try {

                const data =
                    JSON.parse(
                        event.data
                    );


                console.log(
                    "WebSocket nhận:",
                    data
                );


                // =================================
                // CHỈ XỬ LÝ BÀN HIỆN TẠI
                // =================================

                if (
                    Number(
                        data.table
                    )
                    !==
                    DEFAULT_TABLE_NUMBER
                ) {

                    return;

                }


                // =================================
                // CÁC EVENT CẦN LOAD LẠI
                // =================================

                const refreshEvents =
                    [

                        "order_created",

                        "item_cooking_status",

                        "item_delivered",

                        "item_delivery_changed",

                        "table_items_updated",

                        "robot_dispatched",

                        "table_cleared"

                    ];


                if (
                    refreshEvents.includes(
                        data.type
                    )
                ) {

                    console.log(
                        "Có thay đổi bàn "
                        +
                        DEFAULT_TABLE_NUMBER
                        +
                        ", tải lại danh sách món..."
                    );


                    await loadOrderedFoods();

                }

            }
            catch (error) {

                console.error(
                    "Lỗi xử lý dữ liệu WebSocket:",
                    error
                );

            }

        };


    // =========================================
    // WEBSOCKET BỊ NGẮT
    // =========================================

    dashboardSocket.onclose =
        () => {

            console.log(
                "WebSocket bị ngắt."
            );


            dashboardSocket =
                null;


            clearTimeout(
                reconnectTimer
            );


            // Thử kết nối lại sau 3 giây
            reconnectTimer =
                setTimeout(
                    () => {

                        connectDashboardWebSocket();

                    },
                    3000
                );

        };


    // =========================================
    // WEBSOCKET LỖI
    // =========================================

    dashboardSocket.onerror =
        (error) => {

            console.error(
                "WebSocket lỗi:",
                error
            );

        };

}


// =========================================================
// KHI MỞ TRANG
// =========================================================
//
// 1. Tải các món bàn đã đặt.
//
// 2. Kết nối WebSocket để nhận thay đổi realtime.
//

loadOrderedFoods();


connectDashboardWebSocket();