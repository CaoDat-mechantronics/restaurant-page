// =========================================================
// CẤU HÌNH API
// =========================================================
const API_BASE_URL =
    "https://restaurant-api-t6pq.onrender.com";
// =========================================================
// CẤU HÌNH SỐ BÀN
// =========================================================
//
// Bàn 1:
// const DEFAULT_TABLE_NUMBER = 1;
//
// Bàn 2:
// const DEFAULT_TABLE_NUMBER = 2;
//
// ...
//
const DEFAULT_TABLE_NUMBER = 1;
// =========================================================
// LẤY CÁC PHẦN TỬ HTML
// =========================================================
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
// =========================================================
// DANH SÁCH MÓN BÀN ĐÃ ĐẶT
// =========================================================
const orderedFoodsList =
    document.getElementById(
        "orderedFoodsList"
    );
const orderedFoodsCount =
    document.getElementById(
        "orderedFoodsCount"
    );
// =========================================================
// TAB
// =========================================================
const menuTabs =
    document.querySelectorAll(
        ".menu-tab"
    );
const newOrderTab =
    document.getElementById(
        "newOrderTab"
    );
const orderedTab =
    document.getElementById(
        "orderedTab"
    );
const orderedTabCount =
    document.getElementById(
        "orderedTabCount"
    );
// =========================================================
// TRẠNG THÁI KHÓA CÁC NÚT UPDATE
// =========================================================
const updatingItemIds =
    new Set();
// =========================================================
// HIỂN THỊ SỐ BÀN
// =========================================================
if (
    tableNumberInput
) {
    tableNumberInput.value =
        DEFAULT_TABLE_NUMBER;
}
// =========================================================
// CHUYỂN TAB
// =========================================================
function switchTab(
    tabName
) {
    // =========================================
    // ACTIVE BUTTON
    // =========================================
    menuTabs.forEach(
        (button) => {
            const isActive =
                button.dataset.tab
                ===
                tabName;
            button.classList.toggle(
                "active",
                isActive
            );
        }
    );
    // =========================================
    // TAB GỌI MÓN
    // =========================================
    if (
        newOrderTab
    ) {
        newOrderTab.classList.toggle(
            "active",
            tabName === "newOrder"
        );
    }
    // =========================================
    // TAB MÓN ĐÃ ĐẶT
    // =========================================
    if (
        orderedTab
    ) {
        orderedTab.classList.toggle(
            "active",
            tabName === "ordered"
        );
    }
    // =========================================
    // KHI MỞ TAB MÓN ĐÃ ĐẶT
    // TẢI DỮ LIỆU MỚI NHẤT
    // =========================================
    if (
        tabName === "ordered"
    ) {
        loadOrderedFoods();
    }
}
// =========================================================
// EVENT CHUYỂN TAB
// =========================================================
menuTabs.forEach(
    (button) => {
        button.addEventListener(
            "click",
            () => {
                const tabName =
                    button.dataset.tab;
                switchTab(
                    tabName
                );
            }
        );
    }
);
// =========================================================
// XỬ LÝ TỪNG CARD MÓN ĂN
// =========================================================
foodCards.forEach(
    (card) => {
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
        // =================================================
        // CHECKBOX
        // =================================================
        if (
            checkbox
        ) {
            checkbox.addEventListener(
                "change",
                () => {
                    updateCardSelectedState(
                        card
                    );
                    updateOrderSummary();
                }
            );
        }
        // =================================================
        // GIẢM SỐ LƯỢNG
        // =================================================
        if (
            btnMinus
            &&
            quantityInput
        ) {
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
                        currentQuantity =
                            1;
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
        }
        // =================================================
        // TĂNG SỐ LƯỢNG
        // =================================================
        if (
            btnPlus
            &&
            quantityInput
        ) {
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
                        currentQuantity =
                            1;
                    }
                    quantityInput.value =
                        currentQuantity + 1;
                    updateOrderSummary();
                }
            );
        }
        // =================================================
        // NHẬP SỐ LƯỢNG TRỰC TIẾP
        // =================================================
        if (
            quantityInput
        ) {
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
                        quantityInput.value =
                            1;
                    }
                    updateOrderSummary();
                }
            );
        }
        // =================================================
        // THAY ĐỔI GHI CHÚ
        // =================================================
        if (
            noteInput
        ) {
            noteInput.addEventListener(
                "input",
                () => {
                    updateOrderSummary();
                }
            );
        }
    }
);
// =========================================================
// ĐỔI TRẠNG THÁI CARD ĐÃ CHỌN
// =========================================================
function updateCardSelectedState(
    card
) {
    const checkbox =
        card.querySelector(
            ".food-checkbox"
        );
    if (
        !checkbox
    ) {
        return;
    }
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
// =========================================================
// CẬP NHẬT ĐƠN HÀNG ĐANG CHỌN
// =========================================================
function updateOrderSummary() {
    let total =
        0;
    let selectedItemsHtml =
        "";
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
            if (
                !checkbox
                ||
                !quantityInput
            ) {
                return;
            }
            const foodName =
                card.dataset.name;
            const foodPrice =
                parseInt(
                    card.dataset.price
                );
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
                quantity =
                    1;
            }
            let note =
                "";
            if (
                noteInput
            ) {
                note =
                    noteInput
                        .value
                        .trim();
            }
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
                            x ${quantity}
                            ${noteText}
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
    // DANH SÁCH MÓN
    // =========================================
    if (
        selectedItemsBox
    ) {
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
    }
    // =========================================
    // TỔNG TIỀN
    // =========================================
    if (
        totalPriceBox
    ) {
        totalPriceBox.innerText =
            formatCurrency(
                total
            );
    }
}
// =========================================================
// ĐỊNH DẠNG TIỀN
// =========================================================
function formatCurrency(
    value
) {
    return (
        Number(
            value
        )
            .toLocaleString(
                "vi-VN"
            )
        +
        " VNĐ"
    );
}
// =========================================================
// CHỐNG CHÈN HTML
// =========================================================
function escapeHtml(
    text
) {
    return String(
        text
    )
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
    if (
        !orderedFoodsList
        ||
        !orderedFoodsCount
    ) {
        console.warn(
            "Không tìm thấy orderedFoodsList hoặc orderedFoodsCount."
        );
        return;
    }
    const tableNumber =
        DEFAULT_TABLE_NUMBER;
    // =========================================
    // LOADING
    // =========================================
    orderedFoodsList.innerHTML = `
        <div class="ordered-foods-loading">
            Đang tải món...
        </div>
    `;
    try {
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
        const data =
            await response.json();
        console.log(
            `Món đã đặt của bàn ${tableNumber}:`,
            data
        );
        renderOrderedFoods(
            data.items || []
        );
    }
    catch (
        error
    ) {
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
        if (
            orderedTabCount
        ) {
            orderedTabCount.innerText =
                "0";
        }
    }
}
// =========================================================
// HIỂN THỊ DANH SÁCH MÓN ĐÃ ĐẶT
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
        if (
            orderedTabCount
        ) {
            orderedTabCount.innerText =
                "0";
        }
        return;
    }
    // =========================================
    // TỔNG SỐ PHẦN
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
                        item.quantity
                        ||
                        0
                    )
                );
            },
            0
        );
    orderedFoodsCount.innerText =
        `${totalQuantity} phần`;
    if (
        orderedTabCount
    ) {
        orderedTabCount.innerText =
            totalQuantity;
    }
    // =========================================
    // MÓN MỚI NHẤT HIỆN TRÊN
    // =========================================
    const sortedItems =
        [
            ...items
        ]
            .sort(
                (
                    a,
                    b
                ) => {
                    return (
                        Number(
                            b.id
                        )
                        -
                        Number(
                            a.id
                        )
                    );
                }
            );
    // =========================================
    // TẠO HTML
    // =========================================
    const html =
        sortedItems
            .map(
                (item) => {
                    // =================================
                    // TRẠNG THÁI
                    // =================================
                    const status =
                        getOrderedFoodStatus(
                            item
                        );
                    // =================================
                    // CHỈ CHỜ NẤU MỚI ĐƯỢC SỬA
                    // =================================
                    const canEdit =
                        Number(
                            item.cooking_status
                            ||
                            0
                        )
                        ===
                        0
                        &&
                        item.delivered
                        !==
                        true;
                    // =================================
                    // GHI CHÚ
                    // =================================
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
                                ${escapeHtml(
                                    item.note
                                )}
                            </div>
                        `;
                    }
                    // =================================
                    // SỐ LƯỢNG
                    // =================================
                    let quantityHtml =
                        "";
                    if (
                        canEdit
                    ) {
                        const minusDisabled =
                            Number(
                                item.quantity
                            )
                            <=
                            1;
                        quantityHtml = `
                            <div class="ordered-edit-row">
                                <button
                                    type="button"
                                    class="ordered-minus"
                                    data-id="${item.id}"
                                    data-quantity="${item.quantity}"
                                    ${
                                        minusDisabled
                                            ?
                                            "disabled"
                                            :
                                            ""
                                    }
                                    title="Giảm số lượng"
                                >
                                    −
                                </button>
                                <span class="ordered-current-quantity">
                                    ${item.quantity}
                                </span>
                                <button
                                    type="button"
                                    class="ordered-plus"
                                    data-id="${item.id}"
                                    data-quantity="${item.quantity}"
                                    title="Tăng số lượng"
                                >
                                    +
                                </button>
                                <button
                                    type="button"
                                    class="ordered-delete"
                                    data-id="${item.id}"
                                    data-name="${escapeHtml(
                                        item.food_name
                                    )}"
                                >
                                    Xóa
                                </button>
                            </div>
                        `;
                    }
                    else {
                        quantityHtml = `
                            <div class="ordered-food-quantity">
                                Số lượng:
                                <strong>
                                    ${item.quantity}
                                </strong>
                            </div>
                        `;
                    }
                    // =================================
                    // HTML MỘT MÓN
                    // =================================
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
                                    ${
                                        canEdit
                                            ?
                                            ""
                                            :
                                            quantityHtml
                                    }
                                </div>
                                <span
                                    class="food-status ${status.className}"
                                >
                                    ${status.text}
                                </span>
                            </div>
                            ${noteHtml}
                            ${
                                canEdit
                                    ?
                                    quantityHtml
                                    :
                                    ""
                            }
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
function getOrderedFoodStatus(
    item
) {
    // =========================================
    // 1. ĐÃ GIAO
    // =========================================
    if (
        item.delivered === true
        ||
        item.delivered === 1
        ||
        item.delivery_status
        ===
        "delivered"
    ) {
        return {
            text:
                "✓ Đã giao",
            className:
                "delivered"
        };
    }
    // =========================================
    // 2. ĐÃ NẤU XONG
    // =========================================
    if (
        Number(
            item.cooking_status
        )
        ===
        2
    ) {
        return {
            text:
                "✓ Đã nấu xong",
            className:
                "cooked"
        };
    }
    // =========================================
    // 3. ĐANG NẤU
    // =========================================
    if (
        Number(
            item.cooking_status
        )
        ===
        1
    ) {
        return {
            text:
                "Đang nấu",
            className:
                "cooking"
        };
    }
    // =========================================
    // 4. CHỜ NẤU
    // =========================================
    return {
        text:
            "Chờ nấu",
        className:
            "waiting"
    };
}
// =========================================================
// CẬP NHẬT SỐ LƯỢNG MÓN ĐÃ ĐẶT
// =========================================================
async function updateOrderedQuantity(
    itemId,
    quantity
) {
    itemId =
        Number(
            itemId
        );
    quantity =
        Number(
            quantity
        );
    if (
        !Number.isInteger(
            itemId
        )
        ||
        itemId <= 0
    ) {
        return;
    }
    if (
        !Number.isInteger(
            quantity
        )
        ||
        quantity < 1
    ) {
        return;
    }
    // =========================================
    // CHỐNG NHẤN NHIỀU LẦN
    // =========================================
    if (
        updatingItemIds.has(
            itemId
        )
    ) {
        return;
    }
    updatingItemIds.add(
        itemId
    );
    try {
        const response =
            await fetch(
                `${API_BASE_URL}/order-items/${itemId}/quantity`,
                {
                    method:
                        "PATCH",
                    headers:
                    {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify(
                            {
                                quantity:
                                    quantity
                            }
                        )
                }
            );
        let result =
            {};
        try {
            result =
                await response.json();
        }
        catch (
            error
        ) {
            result =
                {};
        }
        console.log(
            "Update quantity:",
            result
        );
        if (
            !response.ok
        ) {
            alert(
                result.detail
                ||
                "Không thể cập nhật số lượng món."
            );
            return;
        }
        // =========================================
        // TẢI LẠI NGAY
        // =========================================
        await loadOrderedFoods();
    }
    catch (
        error
    ) {
        console.error(
            "Lỗi cập nhật số lượng:",
            error
        );
        alert(
            "Không thể kết nối server để cập nhật món."
        );
    }
    finally {
        updatingItemIds.delete(
            itemId
        );
    }
}
// =========================================================
// XÓA MÓN ĐÃ ĐẶT
// =========================================================
async function deleteOrderedFood(
    itemId,
    foodName
) {
    itemId =
        Number(
            itemId
        );
    if (
        !Number.isInteger(
            itemId
        )
        ||
        itemId <= 0
    ) {
        return;
    }
    // =========================================
    // XÁC NHẬN
    // =========================================
    const confirmed =
        confirm(
            `Bạn có chắc muốn xóa "${foodName}"?`
        );
    if (
        !confirmed
    ) {
        return;
    }
    // =========================================
    // CHỐNG NHẤN NHIỀU LẦN
    // =========================================
    if (
        updatingItemIds.has(
            itemId
        )
    ) {
        return;
    }
    updatingItemIds.add(
        itemId
    );
    try {
        const response =
            await fetch(
                `${API_BASE_URL}/orders/table/${DEFAULT_TABLE_NUMBER}/items`,
                {
                    method:
                        "PATCH",
                    headers:
                    {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify(
                            {
                                items:
                                [
                                    {
                                        id:
                                            itemId,
                                        quantity:
                                            0,
                                        note:
                                            ""
                                    }
                                ]
                            }
                        )
                }
            );
        let result =
            {};
        try {
            result =
                await response.json();
        }
        catch (
            error
        ) {
            result =
                {};
        }
        console.log(
            "Xóa món:",
            result
        );
        if (
            !response.ok
        ) {
            alert(
                result.detail
                ||
                "Không thể xóa món."
            );
            return;
        }
        await loadOrderedFoods();
    }
    catch (
        error
    ) {
        console.error(
            "Lỗi xóa món:",
            error
        );
        alert(
            "Không thể kết nối server để xóa món."
        );
    }
    finally {
        updatingItemIds.delete(
            itemId
        );
    }
}
// =========================================================
// EVENT CHO + / - / XÓA MÓN ĐÃ ĐẶT
// =========================================================
//
// Vì các nút được tạo động bằng innerHTML,
// dùng event delegation trên orderedFoodsList.
//
if (
    orderedFoodsList
) {
    orderedFoodsList.addEventListener(
        "click",
        async (
            event
        ) => {
            // =====================================
            // NÚT +
            // =====================================
            const plusButton =
                event.target.closest(
                    ".ordered-plus"
                );
            if (
                plusButton
            ) {
                const itemId =
                    Number(
                        plusButton.dataset.id
                    );
                const currentQuantity =
                    Number(
                        plusButton.dataset.quantity
                    );
                await updateOrderedQuantity(
                    itemId,
                    currentQuantity + 1
                );
                return;
            }
            // =====================================
            // NÚT -
            // =====================================
            const minusButton =
                event.target.closest(
                    ".ordered-minus"
                );
            if (
                minusButton
            ) {
                if (
                    minusButton.disabled
                ) {
                    return;
                }
                const itemId =
                    Number(
                        minusButton.dataset.id
                    );
                const currentQuantity =
                    Number(
                        minusButton.dataset.quantity
                    );
                if (
                    currentQuantity <= 1
                ) {
                    return;
                }
                await updateOrderedQuantity(
                    itemId,
                    currentQuantity - 1
                );
                return;
            }
            // =====================================
            // NÚT XÓA
            // =====================================
            const deleteButton =
                event.target.closest(
                    ".ordered-delete"
                );
            if (
                deleteButton
            ) {
                const itemId =
                    Number(
                        deleteButton.dataset.id
                    );
                const foodName =
                    deleteButton.dataset.name
                    ||
                    "món này";
                await deleteOrderedFood(
                    itemId,
                    foodName
                );
                return;
            }
        }
    );
}
// =========================================================
// ĐẶT MÓN
// =========================================================
if (
    orderButton
) {
    orderButton.addEventListener(
        "click",
        async () => {
            // =====================================
            // 1. SỐ BÀN
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
            // 2. DANH SÁCH MÓN ĐƯỢC CHỌN
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
                    if (
                        !checkbox
                        ||
                        !quantityInput
                    ) {
                        return;
                    }
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
                            quantity =
                                1;
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
            // 3. CHƯA CHỌN MÓN
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
            // 4. JSON GỬI BACKEND
            // =====================================
            const orderData =
            {
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
            // 6. GỌI API
            // =====================================
            try {
                const response =
                    await fetch(
                        `${API_BASE_URL}/orders`,
                        {
                            method:
                                "POST",
                            headers:
                            {
                                "Content-Type":
                                    "application/json"
                            },
                            body:
                                JSON.stringify(
                                    orderData
                                )
                        }
                    );
                let result =
                    {};
                try {
                    result =
                        await response.json();
                }
                catch (
                    error
                ) {
                    result =
                        {};
                }
                console.log(
                    "HTTP status:",
                    response.status
                );
                console.log(
                    "FastAPI trả về:",
                    result
                );
                // =================================
                // SERVER TRẢ LỖI
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
                // 7. RESET FORM
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
                        if (
                            checkbox
                        ) {
                            checkbox.checked =
                                false;
                        }
                        if (
                            quantityInput
                        ) {
                            quantityInput.value =
                                1;
                        }
                        if (
                            noteInput
                        ) {
                            noteInput.value =
                                "";
                        }
                        card.classList.remove(
                            "selected"
                        );
                    }
                );
                // =================================
                // 8. RESET ĐƠN ĐANG CHỌN
                // =================================
                updateOrderSummary();
                // =================================
                // 9. TẢI MÓN ĐÃ ĐẶT
                // =================================
                await loadOrderedFoods();
                // =================================
                // 10. CHUYỂN SANG TAB MÓN ĐÃ ĐẶT
                // =================================
                switchTab(
                    "ordered"
                );
                // =================================
                // 11. THÔNG BÁO
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
            catch (
                error
            ) {
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
                orderButton.disabled =
                    false;
                orderButton.innerText =
                    "Đặt món";
            }
        }
    );
}
// =========================================================
// WEBSOCKET REALTIME
// =========================================================
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
    // =========================================
    // ĐÃ CONNECT / ĐANG CONNECT
    // =========================================
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
    // CONNECT THÀNH CÔNG
    // =========================================
    dashboardSocket.onopen =
        () => {
            console.log(
                "✓ WebSocket đã kết nối."
            );
        };
    // =========================================
    // NHẬN REALTIME
    // =========================================
    dashboardSocket.onmessage =
        async (
            event
        ) => {
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
                // CHỈ BÀN HIỆN TẠI
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
                // EVENT CẦN REFRESH
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
                        ", tải lại món..."
                    );
                    await loadOrderedFoods();
                }
            }
            catch (
                error
            ) {
                console.error(
                    "Lỗi xử lý dữ liệu WebSocket:",
                    error
                );
            }
        };
    // =========================================
    // SOCKET BỊ NGẮT
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
            reconnectTimer =
                setTimeout(
                    () => {
                        connectDashboardWebSocket();
                    },
                    3000
                );
        };
    // =========================================
    // SOCKET LỖI
    // =========================================
    dashboardSocket.onerror =
        (
            error
        ) => {
            console.error(
                "WebSocket lỗi:",
                error
            );
        };
}
// =========================================================
// KHỞI TẠO TRANG
// =========================================================
// Cập nhật đơn đang chọn
updateOrderSummary();
// Mặc định mở tab gọi món
switchTab(
    "newOrder"
);
// Tải các món bàn đã đặt để
// số lượng trên badge hiện ngay
loadOrderedFoods();
// Kết nối realtime
connectDashboardWebSocket();