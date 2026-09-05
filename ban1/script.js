// =========================================================
// CẤU HÌNH API
// =========================================================
const API_BASE_URL =
    "https://restaurant-api-t6pq.onrender.com";
// =========================================================
// CẤU HÌNH BÀN
// =========================================================
const DEFAULT_TABLE_NUMBER = 1;
// =========================================================
// ELEMENT - MENU
// =========================================================
const foodCards =
    document.querySelectorAll(
        ".food-card"
    );
const selectedItemsBox =
    document.getElementById(
        "selectedItems"
    );
const totalPriceBox =
    document.getElementById(
        "totalPrice"
    );
const orderButton =
    document.getElementById(
        "orderButton"
    );
const tableNumberInput =
    document.getElementById(
        "tableNumber"
    );
// =========================================================
// ELEMENT - TAB
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
// =========================================================
// ELEMENT - MÓN ĐÃ ĐẶT
// =========================================================
const orderedFoodsList =
    document.getElementById(
        "orderedFoodsList"
    );
const orderedFoodsCount =
    document.getElementById(
        "orderedFoodsCount"
    );
const orderedTabCount =
    document.getElementById(
        "orderedTabCount"
    );
const orderedFoodsTotal =
    document.getElementById(
        "orderedFoodsTotal"
    );
// =========================================================
// ELEMENT - ORDER PANEL
// =========================================================
const orderSummary =
    document.getElementById(
        "orderSummary"
    );
const orderPanelToggle =
    document.getElementById(
        "orderPanelToggle"
    );
const pickedFoodButton =
    document.getElementById(
        "pickedFoodButton"
    );
const pickedCount =
    document.getElementById(
        "pickedCount"
    );
// =========================================================
// CHỐNG UPDATE TRÙNG
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
// FORMAT TIỀN
// =========================================================
function formatCurrency(
    value
) {
    return (
        Number(
            value || 0
        ).toLocaleString(
            "vi-VN"
        )
        +
        " VNĐ"
    );
}
// =========================================================
// ESCAPE HTML
// =========================================================
function escapeHtml(
    text
) {
    return String(
        text ?? ""
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
// MỞ / THU GỌN ORDER PANEL
// =========================================================
function setOrderPanelExpanded(
    expanded
) {
    if (
        !orderSummary
    ) {
        return;
    }
    orderSummary.classList.toggle(
        "expanded",
        expanded
    );
    // =====================================================
    // HANDLE PHÍA TRÊN
    // =====================================================
    if (
        orderPanelToggle
    ) {
        orderPanelToggle.setAttribute(
            "aria-expanded",
            expanded
                ?
                "true"
                :
                "false"
        );
        orderPanelToggle.setAttribute(
            "aria-label",
            expanded
                ?
                "Thu gọn đơn hàng"
                :
                "Mở rộng đơn hàng"
        );
    }
    // =====================================================
    // ICON 🍽️
    // =====================================================
    if (
        pickedFoodButton
    ) {
        pickedFoodButton.setAttribute(
            "aria-expanded",
            expanded
                ?
                "true"
                :
                "false"
        );
        pickedFoodButton.setAttribute(
            "aria-label",
            expanded
                ?
                "Thu gọn đơn hàng"
                :
                "Mở rộng đơn hàng"
        );
    }
}
// =========================================================
// TOGGLE ORDER PANEL
// =========================================================
function toggleOrderPanel() {
    if (
        !orderSummary
    ) {
        return;
    }
    const isExpanded =
        orderSummary.classList.contains(
            "expanded"
        );
    setOrderPanelExpanded(
        !isExpanded
    );
}
// =========================================================
// CLICK HANDLE
// =========================================================
if (
    orderPanelToggle
) {
    orderPanelToggle.addEventListener(
        "click",
        toggleOrderPanel
    );
}
// =========================================================
// CLICK ICON 🍽️
// =========================================================
if (
    pickedFoodButton
) {
    pickedFoodButton.addEventListener(
        "click",
        toggleOrderPanel
    );
}
// =========================================================
// CHUYỂN TAB
// =========================================================
function switchTab(
    tabName
) {
    // =====================================================
    // ACTIVE BUTTON
    // =====================================================
    menuTabs.forEach(
        (
            button
        ) => {
            button.classList.toggle(
                "active",
                button.dataset.tab === tabName
            );
        }
    );
    // =====================================================
    // TAB GỌI MÓN
    // =====================================================
    if (
        newOrderTab
    ) {
        newOrderTab.classList.toggle(
            "active",
            tabName === "newOrder"
        );
    }
    // =====================================================
    // TAB MÓN ĐÃ ĐẶT
    // =====================================================
    if (
        orderedTab
    ) {
        orderedTab.classList.toggle(
            "active",
            tabName === "ordered"
        );
    }
    // =====================================================
    // MỞ TAB MÓN ĐÃ ĐẶT
    // =====================================================
    if (
        tabName === "ordered"
    ) {
        loadOrderedFoods();
    }
    // =====================================================
    // RỜI TAB GỌI MÓN
    // =====================================================
    if (
        tabName !== "newOrder"
    ) {
        setOrderPanelExpanded(
            false
        );
    }
}
// =========================================================
// EVENT TAB
// =========================================================
menuTabs.forEach(
    (
        button
    ) => {
        button.addEventListener(
            "click",
            () => {
                switchTab(
                    button.dataset.tab
                );
            }
        );
    }
);
// =========================================================
// XỬ LÝ CARD MENU
// =========================================================
foodCards.forEach(
    (
        card
    ) => {
        const checkbox =
            card.querySelector(
                ".food-checkbox"
            );
        const btnMinus =
            card.querySelector(
                ".btn-minus"
            );
        const btnPlus =
            card.querySelector(
                ".btn-plus"
            );
        const quantityInput =
            card.querySelector(
                ".quantity-input"
            );
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
        // NÚT -
        // =================================================
        if (
            btnMinus
            &&
            quantityInput
        ) {
            btnMinus.addEventListener(
                "click",
                () => {
                    let quantity =
                        parseInt(
                            quantityInput.value
                        );
                    if (
                        isNaN(
                            quantity
                        )
                    ) {
                        quantity =
                            1;
                    }
                    if (
                        quantity > 1
                    ) {
                        quantityInput.value =
                            quantity - 1;
                    }
                    updateOrderSummary();
                }
            );
        }
        // =================================================
        // NÚT +
        // =================================================
        if (
            btnPlus
            &&
            quantityInput
        ) {
            btnPlus.addEventListener(
                "click",
                () => {
                    let quantity =
                        parseInt(
                            quantityInput.value
                        );
                    if (
                        isNaN(
                            quantity
                        )
                    ) {
                        quantity =
                            1;
                    }
                    quantityInput.value =
                        quantity + 1;
                    updateOrderSummary();
                }
            );
        }
        // =================================================
        // NHẬP QUANTITY
        // =================================================
        if (
            quantityInput
        ) {
            quantityInput.addEventListener(
                "input",
                () => {
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
                        quantityInput.value =
                            1;
                    }
                    updateOrderSummary();
                }
            );
        }
        // =================================================
        // NOTE
        // =================================================
        if (
            noteInput
        ) {
            noteInput.addEventListener(
                "input",
                updateOrderSummary
            );
        }
    }
);
// =========================================================
// CARD ĐƯỢC CHỌN
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
    card.classList.toggle(
        "selected",
        checkbox.checked
    );
}
// =========================================================
// CẬP NHẬT ĐƠN ĐANG PICK
// =========================================================
function updateOrderSummary() {
    let total =
        0;
    let selectedHtml =
        "";
    let totalPickedQuantity =
        0;
    foodCards.forEach(
        (
            card
        ) => {
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
                !checkbox.checked
            ) {
                return;
            }
            // =================================================
            // FOOD
            // =================================================
            const foodName =
                card.dataset.name;
            const foodPrice =
                Number(
                    card.dataset.price
                    ||
                    0
                );
            // =================================================
            // QUANTITY
            // =================================================
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
            // =================================================
            // BADGE ICON
            // =================================================
            totalPickedQuantity +=
                quantity;
            // =================================================
            // NOTE
            // =================================================
            const note =
                noteInput
                    ?
                    noteInput.value.trim()
                    :
                    "";
            // =================================================
            // TOTAL
            // =================================================
            const itemTotal =
                foodPrice
                *
                quantity;
            total +=
                itemTotal;
            // =================================================
            // NOTE HTML
            // =================================================
            let noteHtml =
                "";
            if (
                note !== ""
            ) {
                noteHtml = `
                    <small>
                        (${escapeHtml(
                            note
                        )})
                    </small>
                `;
            }
            // =================================================
            // HTML
            // =================================================
            selectedHtml += `
                <div class="selected-item">
                    <span>
                        ${escapeHtml(
                            foodName
                        )}
                        x ${quantity}
                        ${noteHtml}
                    </span>
                    <strong>
                        ${formatCurrency(
                            itemTotal
                        )}
                    </strong>
                </div>
            `;
        }
    );
    // =====================================================
    // DANH SÁCH
    // =====================================================
    if (
        selectedItemsBox
    ) {
        if (
            selectedHtml === ""
        ) {
            selectedItemsBox.innerHTML =
                "Chưa chọn món nào.";
        }
        else {
            selectedItemsBox.innerHTML =
                selectedHtml;
        }
    }
    // =====================================================
    // TOTAL
    // =====================================================
    if (
        totalPriceBox
    ) {
        totalPriceBox.innerText =
            formatCurrency(
                total
            );
    }
    // =====================================================
    // BADGE ICON
    // =====================================================
    if (
        pickedCount
    ) {
        pickedCount.innerText =
            String(
                totalPickedQuantity
            );
        pickedCount.classList.toggle(
            "hidden",
            totalPickedQuantity === 0
        );
    }
}
// =========================================================
// LOAD MÓN ĐÃ ĐẶT
// =========================================================
async function loadOrderedFoods() {
    if (
        !orderedFoodsList
        ||
        !orderedFoodsCount
    ) {
        return;
    }
    orderedFoodsList.innerHTML = `
        <div class="ordered-foods-loading">
            Đang tải món...
        </div>
    `;
    try {
        const response =
            await fetch(
                `${API_BASE_URL}/orders/table/${DEFAULT_TABLE_NUMBER}`,
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
            `Món đã đặt Bàn ${DEFAULT_TABLE_NUMBER}:`,
            data
        );
        renderOrderedFoods(
            data.items
            ||
            []
        );
    }
    catch (
        error
    ) {
        console.error(
            "Không tải được món:",
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
        if (
            orderedFoodsTotal
        ) {
            orderedFoodsTotal.innerText =
                formatCurrency(
                    0
                );
        }
    }
}
// =========================================================
// RENDER MÓN ĐÃ ĐẶT
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
    // =====================================================
    // KHÔNG CÓ MÓN
    // =====================================================
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
        if (
            orderedFoodsTotal
        ) {
            orderedFoodsTotal.innerText =
                formatCurrency(
                    0
                );
        }
        return;
    }
    // =====================================================
    // TỔNG SỐ PHẦN
    // =====================================================
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
            String(
                totalQuantity
            );
    }
    // =====================================================
    // TỔNG TIỀN MÓN ĐÃ ĐẶT
    // =====================================================
    const orderedTotal =
        items.reduce(
            (
                total,
                item
            ) => {
                const quantity =
                    Number(
                        item.quantity
                        ||
                        0
                    );
                const unitPrice =
                    Number(
                        item.unit_price
                        ||
                        0
                    );
                return (
                    total
                    +
                    quantity
                    *
                    unitPrice
                );
            },
            0
        );
    if (
        orderedFoodsTotal
    ) {
        orderedFoodsTotal.innerText =
            formatCurrency(
                orderedTotal
            );
    }
    // =====================================================
    // MÓN MỚI NHẤT TRƯỚC
    // =====================================================
    const sortedItems =
        [
            ...items
        ].sort(
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
    // =====================================================
    // BUILD HTML
    // =====================================================
    const html =
        sortedItems
            .map(
                (
                    item
                ) => {
                    // =========================================
                    // STATUS
                    // =========================================
                    const status =
                        getOrderedFoodStatus(
                            item
                        );
                    // =========================================
                    // CHỈ CHỜ NẤU ĐƯỢC SỬA
                    // =========================================
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
                    // =========================================
                    // NOTE
                    // =========================================
                    let noteHtml =
                        "";
                    if (
                        item.note
                        &&
                        String(
                            item.note
                        ).trim()
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
                    // =========================================
                    // QUANTITY
                    // =========================================
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
                                >
                                    −
                                </button>
                                <span
                                    class="ordered-current-quantity"
                                >
                                    ${item.quantity}
                                </span>
                                <button
                                    type="button"
                                    class="ordered-plus"
                                    data-id="${item.id}"
                                    data-quantity="${item.quantity}"
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
                    // =========================================
                    // ITEM
                    // =========================================
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
            .join(
                ""
            );
    orderedFoodsList.innerHTML =
        html;
}
// =========================================================
// TRẠNG THÁI MÓN
// =========================================================
function getOrderedFoodStatus(
    item
) {
    // =====================================================
    // ĐÃ GIAO
    // =====================================================
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
    // =====================================================
    // ĐÃ NẤU
    // =====================================================
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
    // =====================================================
    // ĐANG NẤU
    // =====================================================
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
    // =====================================================
    // CHỜ NẤU
    // =====================================================
    return {
        text:
            "Chờ nấu",
        className:
            "waiting"
    };
}
// =========================================================
// UPDATE QUANTITY MÓN ĐÃ ĐẶT
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
        if (
            !response.ok
        ) {
            alert(
                result.detail
                ||
                "Không thể cập nhật số lượng."
            );
            await loadOrderedFoods();
            return;
        }
        // =================================================
        // LOAD LẠI
        // => tự tính lại tổng tiền
        // =================================================
        await loadOrderedFoods();
    }
    catch (
        error
    ) {
        console.error(
            "Update quantity error:",
            error
        );
        alert(
            "Không thể kết nối server."
        );
    }
    finally {
        updatingItemIds.delete(
            itemId
        );
    }
}
// =========================================================
// XÓA MÓN
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
    const confirmed =
        confirm(
            `Bạn có chắc muốn xóa "${foodName}"?`
        );
    if (
        !confirmed
    ) {
        return;
    }
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
        if (
            !response.ok
        ) {
            alert(
                result.detail
                ||
                "Không thể xóa món."
            );
            await loadOrderedFoods();
            return;
        }
        // =================================================
        // LOAD LẠI
        // MÓN ĐÃ XÓA KHÔNG CÒN TRONG ITEMS
        // => TOTAL TỰ GIẢM
        // =================================================
        await loadOrderedFoods();
    }
    catch (
        error
    ) {
        console.error(
            "Delete food error:",
            error
        );
        alert(
            "Không thể kết nối server."
        );
    }
    finally {
        updatingItemIds.delete(
            itemId
        );
    }
}
// =========================================================
// EVENT + / - / DELETE MÓN ĐÃ ĐẶT
// =========================================================
if (
    orderedFoodsList
) {
    orderedFoodsList.addEventListener(
        "click",
        async (
            event
        ) => {
            // =================================================
            // +
            // =================================================
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
                const quantity =
                    Number(
                        plusButton.dataset.quantity
                    );
                await updateOrderedQuantity(
                    itemId,
                    quantity + 1
                );
                return;
            }
            // =================================================
            // -
            // =================================================
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
                const quantity =
                    Number(
                        minusButton.dataset.quantity
                    );
                if (
                    quantity <= 1
                ) {
                    return;
                }
                await updateOrderedQuantity(
                    itemId,
                    quantity - 1
                );
                return;
            }
            // =================================================
            // DELETE
            // =================================================
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
            // =================================================
            // TABLE
            // =================================================
            const tableNumber =
                Number(
                    tableNumberInput.value
                );
            if (
                !Number.isInteger(
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
            // =================================================
            // SELECTED FOODS
            // =================================================
            const selectedFoods =
                [];
            foodCards.forEach(
                (
                    card
                ) => {
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
                        !checkbox.checked
                    ) {
                        return;
                    }
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
                    selectedFoods.push(
                        {
                            name:
                                card.dataset.name,
                            price:
                                Number(
                                    card.dataset.price
                                    ||
                                    0
                                ),
                            quantity:
                                quantity,
                            note:
                                noteInput
                                    ?
                                    noteInput.value.trim()
                                    :
                                    ""
                        }
                    );
                }
            );
            // =================================================
            // CHƯA CHỌN MÓN
            // =================================================
            if (
                selectedFoods.length === 0
            ) {
                alert(
                    "Bạn chưa chọn món nào."
                );
                return;
            }
            // =================================================
            // ORDER DATA
            // =================================================
            const orderData =
            {
                tableNumber:
                    tableNumber,
                foods:
                    selectedFoods
            };
            console.log(
                "Order:",
                orderData
            );
            // =================================================
            // LOCK BUTTON
            // =================================================
            orderButton.disabled =
                true;
            orderButton.innerText =
                "Đang đặt...";
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
                // =================================================
                // ERROR
                // =================================================
                if (
                    !response.ok
                ) {
                    let message =
                        "Đặt món thất bại.";
                    if (
                        result.detail
                    ) {
                        message =
                            typeof result.detail
                            ===
                            "string"
                                ?
                                result.detail
                                :
                                JSON.stringify(
                                    result.detail
                                );
                    }
                    alert(
                        message
                    );
                    return;
                }
                // =================================================
                // RESET MENU
                // =================================================
                foodCards.forEach(
                    (
                        card
                    ) => {
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
                // =================================================
                // RESET PANEL
                // =================================================
                updateOrderSummary();
                setOrderPanelExpanded(
                    false
                );
                // =================================================
                // LOAD MÓN ĐÃ ĐẶT
                // =================================================
                await loadOrderedFoods();
                // =================================================
                // CHUYỂN TAB
                // =================================================
                switchTab(
                    "ordered"
                );
                // =================================================
                // SUCCESS
                // =================================================
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
                    "Order error:",
                    error
                );
                alert(
                    "Không kết nối được tới server."
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
// WEBSOCKET
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
// CONNECT WEBSOCKET
// =========================================================
function connectDashboardWebSocket() {
    // =====================================================
    // ĐÃ CONNECT
    // =====================================================
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
        "Connecting WebSocket:",
        wsUrl
    );
    dashboardSocket =
        new WebSocket(
            wsUrl
        );
    // =====================================================
    // OPEN
    // =====================================================
    dashboardSocket.onopen =
        () => {
            console.log(
                "✓ WebSocket connected"
            );
        };
    // =====================================================
    // MESSAGE
    // =====================================================
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
                    "WebSocket:",
                    data
                );
                // =================================================
                // CHỈ BÀN 1
                // =================================================
                if (
                    Number(
                        data.table
                    )
                    !==
                    DEFAULT_TABLE_NUMBER
                ) {
                    return;
                }
                // =================================================
                // EVENT REFRESH
                // =================================================
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
                    await loadOrderedFoods();
                }
            }
            catch (
                error
            ) {
                console.error(
                    "WebSocket message error:",
                    error
                );
            }
        };
    // =====================================================
    // CLOSE
    // =====================================================
    dashboardSocket.onclose =
        () => {
            console.log(
                "WebSocket disconnected"
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
    // =====================================================
    // ERROR
    // =====================================================
    dashboardSocket.onerror =
        (
            error
        ) => {
            console.error(
                "WebSocket error:",
                error
            );
        };
}
// =========================================================
// KHỞI TẠO
// =========================================================
// Hiển thị đơn đang pick
updateOrderSummary();
// Mặc định tab gọi món
switchTab(
    "newOrder"
);
// Panel mobile mặc định thu gọn
setOrderPanelExpanded(
    false
);
// Load món đã đặt
loadOrderedFoods();
// WebSocket realtime
connectDashboardWebSocket();