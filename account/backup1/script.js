// ======================================================
// CẤU HÌNH
// ======================================================
const API_BASE_URL = "http://127.0.0.1:8000";
const TOTAL_TABLES = 12;
const AUTO_REFRESH_MS = 1000;

let selectedTableNumber = null;
let currentItems = [];
let tableOrderRequestId = 0;
let statusInitialized = false;
let autoRefreshRunning = false;
let interactionInProgress = false;

// Lưu snapshot để phát hiện món mới mà không cần reload trang.
const tableSnapshots = new Map();
const tableNewFlags = new Set();

// Giữ lựa chọn robot tạm thời của người dùng khi auto-refresh chạy.
const robotDrafts = new Map();

// ======================================================
// ELEMENTS
// ======================================================
const tablesContainer = document.getElementById("tablesContainer");
const selectedTableTitle = document.getElementById("selectedTableTitle");
const selectedTableDescription = document.getElementById("selectedTableDescription");
const emptySelection = document.getElementById("emptySelection");
const loadingBox = document.getElementById("loadingBox");
const orderContent = document.getElementById("orderContent");
const orderItems = document.getElementById("orderItems");
const noItemsMessage = document.getElementById("noItemsMessage");
const tableTotal = document.getElementById("tableTotal");
const payButton = document.getElementById("payButton");
const refreshTablesButton = document.getElementById("refreshTablesButton");
const refreshOrderButton = document.getElementById("refreshOrderButton");

// ======================================================
// KHỞI ĐỘNG
// ======================================================
document.addEventListener("DOMContentLoaded", async () => {
    createTableCards();
    await refreshTableStatuses(true);

    // Polling 1 giây/lần:
    // - tự phát hiện bàn có món mới
    // - tự cập nhật trạng thái nấu 0 -> 1 -> 2
    // - tự cập nhật chi tiết bàn đang xem
    setInterval(autoRefreshDashboard, AUTO_REFRESH_MS);
});

// ======================================================
// TẠO BÀN 1 -> 12
// ======================================================
function createTableCards() {
    tablesContainer.innerHTML = "";

    for (let tableNumber = 1; tableNumber <= TOTAL_TABLES; tableNumber++) {
        const tableCard = document.createElement("button");
        tableCard.type = "button";
        tableCard.className = "table-card";
        tableCard.dataset.tableNumber = tableNumber;

        tableCard.innerHTML = `
            <span class="table-new-badge hidden">NEW</span>
            <span class="table-label">Bàn</span>
            <strong class="table-number">${tableNumber}</strong>
            <span class="table-order-badge hidden">0</span>
        `;

        tableCard.addEventListener("click", async () => {
            // Người quản lý đã mở bàn này
            // => coi như đã xem thông báo NEW
            clearNewFlag(tableNumber);

            await selectTable(tableNumber);
        });

        tablesContainer.appendChild(tableCard);
    }
}

// ======================================================
// AUTO REFRESH KHÔNG CẦN F5
// ======================================================
async function autoRefreshDashboard() {
    if (autoRefreshRunning || interactionInProgress) {
        return;
    }

    autoRefreshRunning = true;

    try {
        await refreshTableStatuses(false, true);

        if (selectedTableNumber !== null) {
            await loadTableOrder(
                selectedTableNumber,
                true
            );
        }
    }
    catch (error) {
        console.error(
            "Lỗi auto refresh:",
            error
        );
    }
    finally {
        autoRefreshRunning = false;
    }
}

// ======================================================
// REFRESH TRẠNG THÁI TẤT CẢ BÀN
//
// initial = true:
// lần đầu chỉ tạo snapshot, không hiện NEW.
//
// silent = true:
// không disable nút Làm mới.
// ======================================================
async function refreshTableStatuses(
    initial = false,
    silent = false
) {
    if (!silent) {
        refreshTablesButton.disabled = true;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/orders/tables/status`,
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                await getApiError(response)
            );
        }

        const data = await response.json();

        const statuses =
            Array.isArray(data.tables)
                ? data.tables
                : [];

        const statusMap = new Map(
            statuses.map(
                item => [
                    Number(item.table_number),
                    item
                ]
            )
        );

        for (
            let tableNumber = 1;
            tableNumber <= TOTAL_TABLES;
            tableNumber++
        ) {
            const status =
                statusMap.get(tableNumber)
                ||
                {
                    table_number: tableNumber,
                    item_count: 0,
                    max_item_id: 0
                };

            updateTableCardStatus(
                tableNumber,
                status,
                initial
            );
        }

        statusInitialized = true;
    }
    finally {
        if (!silent) {
            refreshTablesButton.disabled = false;
        }
    }
}

// ======================================================
// CẬP NHẬT CARD MỘT BÀN
// ======================================================
function updateTableCardStatus(
    tableNumber,
    status,
    initial = false
) {
    const tableCard =
        document.querySelector(
            `.table-card[data-table-number="${tableNumber}"]`
        );

    if (!tableCard) {
        return;
    }

    const countBadge =
        tableCard.querySelector(
            ".table-order-badge"
        );

    const newBadge =
        tableCard.querySelector(
            ".table-new-badge"
        );

    const itemCount =
        Number(
            status.item_count || 0
        );

    const maxItemId =
        Number(
            status.max_item_id || 0
        );

    const previous =
        tableSnapshots.get(
            tableNumber
        );

    // ==================================================
    // PHÁT HIỆN CÓ MÓN MỚI
    // ==================================================
    if (
        !initial
        &&
        statusInitialized
        &&
        previous
        &&
        maxItemId >
            Number(
                previous.maxItemId || 0
            )
    ) {
        tableNewFlags.add(
            tableNumber
        );
    }

    // ==================================================
    // BADGE SỐ MÓN
    // ==================================================
    if (itemCount > 0) {
        tableCard.classList.add(
            "has-order"
        );

        countBadge.textContent =
            itemCount;

        countBadge.classList.remove(
            "hidden"
        );
    }
    else {
        tableCard.classList.remove(
            "has-order"
        );

        countBadge.classList.add(
            "hidden"
        );

        tableNewFlags.delete(
            tableNumber
        );
    }

    // ==================================================
    // BADGE NEW
    // ==================================================
    if (
        tableNewFlags.has(
            tableNumber
        )
    ) {
        newBadge.classList.remove(
            "hidden"
        );
    }
    else {
        newBadge.classList.add(
            "hidden"
        );
    }

    // ==================================================
    // LƯU SNAPSHOT
    // ==================================================
    tableSnapshots.set(
        tableNumber,
        {
            itemCount,
            maxItemId
        }
    );
}

// ======================================================
// XÓA THÔNG BÁO NEW
// ======================================================
function clearNewFlag(
    tableNumber
) {
    tableNewFlags.delete(
        tableNumber
    );

    const tableCard =
        document.querySelector(
            `.table-card[data-table-number="${tableNumber}"]`
        );

    if (tableCard) {
        const newBadge =
            tableCard.querySelector(
                ".table-new-badge"
            );

        if (newBadge) {
            newBadge.classList.add(
                "hidden"
            );
        }
    }
}

// ======================================================
// CHỌN BÀN
// ======================================================
async function selectTable(
    tableNumber
) {
    selectedTableNumber =
        tableNumber;

    // Bỏ selected tất cả bàn
    document
        .querySelectorAll(
            ".table-card"
        )
        .forEach(
            card => {
                card.classList.remove(
                    "selected"
                );
            }
        );

    // Selected bàn hiện tại
    const selectedCard =
        document.querySelector(
            `.table-card[data-table-number="${tableNumber}"]`
        );

    if (selectedCard) {
        selectedCard.classList.add(
            "selected"
        );
    }

    selectedTableTitle.textContent =
        `Bàn ${tableNumber}`;

    selectedTableDescription.textContent =
        "Danh sách món của bàn";

    refreshOrderButton.disabled =
        false;

    await loadTableOrder(
        tableNumber,
        false
    );
}

// ======================================================
// LOAD ĐƠN CỦA BÀN
//
// silent = true:
// polling chạy ngầm,
// không làm màn hình nhấp nháy.
// ======================================================
async function loadTableOrder(
    tableNumber,
    silent = false
) {
    const requestId =
        ++tableOrderRequestId;

    if (!silent) {
        emptySelection.classList.add(
            "hidden"
        );

        loadingBox.classList.remove(
            "hidden"
        );

        orderContent.classList.add(
            "hidden"
        );
    }

    try {
        const response =
            await fetch(
                `${API_BASE_URL}/orders/table/${tableNumber}`,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                await getApiError(
                    response
                )
            );
        }

        const data =
            await response.json();

        // Nếu người dùng đã chuyển sang bàn khác
        // thì bỏ response cũ
        if (
            requestId !==
                tableOrderRequestId
            ||
            tableNumber !==
                selectedTableNumber
        ) {
            return;
        }

        currentItems =
            Array.isArray(data.items)
                ? data.items
                : [];

        cleanupRobotDrafts(
            currentItems
        );

        renderOrderItems(
            currentItems
        );

        loadingBox.classList.add(
            "hidden"
        );

        orderContent.classList.remove(
            "hidden"
        );
    }
    catch (error) {
        if (
            requestId !==
                tableOrderRequestId
            ||
            tableNumber !==
                selectedTableNumber
        ) {
            return;
        }

        if (!silent) {
            loadingBox.classList.add(
                "hidden"
            );

            orderContent.classList.remove(
                "hidden"
            );

            currentItems = [];

            orderItems.innerHTML = "";

            noItemsMessage.classList.remove(
                "hidden"
            );

            noItemsMessage.textContent =
                "Không thể tải dữ liệu từ server.";

            tableTotal.textContent =
                formatCurrency(0);

            payButton.disabled =
                true;
        }

        console.error(error);
    }
}

// ======================================================
// XÓA ROBOT DRAFT CỦA NHỮNG MÓN KHÔNG CÒN TỒN TẠI
// ======================================================
function cleanupRobotDrafts(
    items
) {
    const currentIds =
        new Set(
            items.map(
                item =>
                    Number(item.id)
            )
        );

    for (
        const itemId
        of robotDrafts.keys()
    ) {
        if (
            !currentIds.has(
                Number(itemId)
            )
        ) {
            robotDrafts.delete(
                itemId
            );
        }
    }
}

// ======================================================
// RENDER DANH SÁCH MÓN
// ======================================================
function renderOrderItems(
    items
) {
    orderItems.innerHTML = "";

    let total = 0;

    // ==================================================
    // KHÔNG CÓ MÓN
    // ==================================================
    if (
        !items
        ||
        items.length === 0
    ) {
        noItemsMessage.classList.remove(
            "hidden"
        );

        noItemsMessage.textContent =
            "Bàn này hiện không có món nào.";

        tableTotal.textContent =
            formatCurrency(0);

        payButton.disabled =
            true;

        return;
    }

    // ==================================================
    // CÓ MÓN
    // ==================================================
    noItemsMessage.classList.add(
        "hidden"
    );

    payButton.disabled =
        false;

    // ==================================================
    // DUYỆT MỖI MÓN
    // ==================================================
    items.forEach(
        item => {
            const itemId =
                Number(item.id);

            const quantity =
                Number(
                    item.quantity
                );

            const unitPrice =
                Number(
                    item.unit_price
                );

            const itemTotal =
                quantity
                *
                unitPrice;

            total += itemTotal;

            // ==========================================
            // GHI CHÚ
            // ==========================================
            const hasNote =
                item.note
                &&
                String(
                    item.note
                ).trim() !== "";

            const noteHtml =
                hasNote
                    ?
                    escapeHtml(
                        item.note
                    )
                    :
                    "—";

            const noteClass =
                hasNote
                    ?
                    "food-note"
                    :
                    "food-note empty-note";

            // ==========================================
            // TRẠNG THÁI NẤU
            //
            // 0 = xám
            // 1 = vàng
            // 2 = xanh
            // ==========================================
            const cookingStatus =
                Number(
                    item.cooking_status || 0
                );

            let cookingClass =
                "cooking-indicator waiting";

            let cookingTitle =
                "Mới nhận - chưa bắt đầu nấu";

            if (
                cookingStatus === 1
            ) {
                cookingClass =
                    "cooking-indicator cooking";

                cookingTitle =
                    "Đang nấu";
            }
            else if (
                cookingStatus >= 2
            ) {
                cookingClass =
                    "cooking-indicator cooked";

                cookingTitle =
                    "Đã nấu xong";
            }

            // ==========================================
            // ĐÃ GIAO
            // ==========================================
            const delivered =
                item.delivered === true;

            const deliveredClass =
                delivered
                    ?
                    "delivered-button delivered"
                    :
                    "delivered-button";

            const deliveredTitle =
                delivered
                    ?
                    "Đã giao - bấm để chuyển thành chưa giao"
                    :
                    "Chưa giao - bấm để đánh dấu đã giao";

            // ==========================================
            // ROBOT
            // ==========================================
            const databaseRobot =
                item.assigned_robot === 1
                ||
                item.assigned_robot === 2
                    ?
                    Number(
                        item.assigned_robot
                    )
                    :
                    "";

            let selectedRobot =
                databaseRobot;

            // Nếu người dùng đang chọn robot nhưng chưa xác nhận,
            // giữ lựa chọn đó qua các lần auto refresh
            if (
                robotDrafts.has(
                    itemId
                )
                &&
                item.robot_dispatched !==
                    true
            ) {
                selectedRobot =
                    robotDrafts.get(
                        itemId
                    );
            }

            const robotDispatched =
                item.robot_dispatched ===
                true;

            let robotButtonText =
                "Xác nhận";

            let robotButtonClass =
                "robot-dispatch-button";

            if (
                robotDispatched
                &&
                (
                    databaseRobot === 1
                    ||
                    databaseRobot === 2
                )
            ) {
                robotButtonText =
                    `✓ Robot ${databaseRobot}`;

                robotButtonClass =
                    "robot-dispatch-button dispatched";
            }

            // ==========================================
            // TRONG 5 GIÂY ĐẦU:
            // chưa cho xác nhận robot
            // ==========================================
            const dispatchDisabled =
                cookingStatus < 1;

            // ==========================================
            // TẠO ROW
            // ==========================================
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "order-item-row";

            row.dataset.itemId =
                itemId;

            row.innerHTML = `

                <!-- ==================================
                     1. MÓN ĂN
                =================================== -->
                <div class="food-name">
                    <span class="mobile-label">
                        Món:
                    </span>

                    <strong>
                        ${escapeHtml(item.food_name)}
                    </strong>
                </div>


                <!-- ==================================
                     2. GHI CHÚ
                =================================== -->
                <div class="${noteClass}">
                    <span class="mobile-label">
                        Ghi chú:
                    </span>

                    ${noteHtml}
                </div>


                <!-- ==================================
                     3. SỐ LƯỢNG
                =================================== -->
                <div class="quantity-manager">

                    <span class="mobile-label">
                        Số lượng:
                    </span>

                    <button
                        type="button"
                        class="quantity-minus"
                        data-item-id="${itemId}"
                        data-new-quantity="${quantity - 1}"
                        ${
                            quantity <= 1
                                ?
                                "disabled"
                                :
                                ""
                        }
                    >
                        -
                    </button>

                    <span class="quantity-value">
                        ${quantity}
                    </span>

                    <button
                        type="button"
                        class="quantity-plus"
                        data-item-id="${itemId}"
                        data-new-quantity="${quantity + 1}"
                    >
                        +
                    </button>

                </div>


                <!-- ==================================
                     4. ĐƠN GIÁ
                =================================== -->
                <div class="unit-price">

                    <span class="mobile-label">
                        Đơn giá:
                    </span>

                    ${formatCurrency(unitPrice)}

                </div>


                <!-- ==================================
                     5. THÀNH TIỀN
                =================================== -->
                <div class="item-total">

                    <span class="mobile-label">
                        Thành tiền:
                    </span>

                    <strong>
                        ${formatCurrency(itemTotal)}
                    </strong>

                </div>


                <!-- ==================================
                     6. ĐÃ NẤU
                =================================== -->
                <div class="cooking-status">

                    <span class="mobile-label">
                        Đã nấu:
                    </span>

                    <span
                        class="${cookingClass}"
                        title="${cookingTitle}"
                    >
                        ✓
                    </span>

                </div>


                <!-- ==================================
                     7. ĐÃ GIAO
                =================================== -->
                <div class="delivery-status">

                    <span class="mobile-label">
                        Đã giao:
                    </span>

                    <button
                        type="button"
                        class="${deliveredClass}"
                        data-item-id="${itemId}"
                        data-delivered="${delivered}"
                        title="${deliveredTitle}"
                    >
                        ✓
                    </button>

                </div>


                <!-- ==================================
                     8. ROBOT
                =================================== -->
                <div class="robot-assignment">

                    <span class="mobile-label">
                        Robot:
                    </span>

                    <select
                        class="robot-select"
                        data-item-id="${itemId}"
                    >

                        <option
                            value=""
                            ${
                                selectedRobot === ""
                                    ?
                                    "selected"
                                    :
                                    ""
                            }
                        >
                            Chọn robot
                        </option>

                        <option
                            value="1"
                            ${
                                selectedRobot === 1
                                    ?
                                    "selected"
                                    :
                                    ""
                            }
                        >
                            Robot 1
                        </option>

                        <option
                            value="2"
                            ${
                                selectedRobot === 2
                                    ?
                                    "selected"
                                    :
                                    ""
                            }
                        >
                            Robot 2
                        </option>

                    </select>

                </div>


                <!-- ==================================
                     9. CHUYỂN GIAO
                =================================== -->
                <div class="robot-dispatch-area">

                    <span class="mobile-label">
                        Chuyển giao:
                    </span>

                    <button
                        type="button"
                        class="${robotButtonClass}"
                        data-item-id="${itemId}"

                        title="${
                            dispatchDisabled
                                ?
                                "Chờ đủ 5 giây để món bắt đầu nấu"
                                :
                                "Xác nhận chuyển món cho robot"
                        }"

                        ${
                            dispatchDisabled
                                ?
                                "disabled"
                                :
                                ""
                        }
                    >
                        ${robotButtonText}
                    </button>

                </div>
            `;

            orderItems.appendChild(
                row
            );
        }
    );

    // ==================================================
    // TỔNG TIỀN
    // ==================================================
    tableTotal.textContent =
        formatCurrency(
            total
        );
}

// ======================================================
// CLICK TRÊN DANH SÁCH MÓN
// ======================================================
orderItems.addEventListener(
    "click",
    async event => {

        // ==================================================
        // NÚT TĂNG / GIẢM SỐ LƯỢNG
        // ==================================================
        const quantityButton =
            event.target.closest(
                ".quantity-minus, .quantity-plus"
            );

        if (quantityButton) {

            await withInteraction(
                async () => {

                    await changeQuantity(
                        Number(
                            quantityButton.dataset.itemId
                        ),
                        Number(
                            quantityButton.dataset.newQuantity
                        )
                    );

                }
            );

            return;
        }


        // ==================================================
        // NÚT ĐÃ GIAO
        // ==================================================
        const deliveredButton =
            event.target.closest(
                ".delivered-button"
            );

        if (deliveredButton) {

            await withInteraction(
                async () => {

                    const itemId =
                        Number(
                            deliveredButton.dataset.itemId
                        );

                    const currentDelivered =
                        deliveredButton.dataset.delivered
                        ===
                        "true";

                    await toggleDelivered(
                        itemId,
                        !currentDelivered
                    );

                }
            );

            return;
        }


        // ==================================================
        // NÚT XÁC NHẬN ROBOT
        // ==================================================
        const robotDispatchButton =
            event.target.closest(
                ".robot-dispatch-button"
            );

        if (robotDispatchButton) {

            // Nếu đang disable
            if (
                robotDispatchButton.disabled
            ) {
                return;
            }

            const itemId =
                Number(
                    robotDispatchButton.dataset.itemId
                );

            const row =
                robotDispatchButton.closest(
                    ".order-item-row"
                );

            const robotSelect =
                row.querySelector(
                    ".robot-select"
                );

            const robotNumber =
                Number(
                    robotSelect.value
                );

            if (
                robotNumber !== 1
                &&
                robotNumber !== 2
            ) {
                alert(
                    "Hãy chọn Robot 1 hoặc Robot 2 trước khi xác nhận."
                );

                return;
            }

            await withInteraction(
                async () => {

                    await dispatchToRobot(
                        itemId,
                        robotNumber,
                        robotDispatchButton
                    );

                }
            );
        }
    }
);

// ======================================================
// KHI NGƯỜI DÙNG ĐỔI ROBOT
//
// Giữ lựa chọn robot,
// tránh việc auto refresh 1 giây làm reset dropdown.
// ======================================================
orderItems.addEventListener(
    "change",
    event => {

        const robotSelect =
            event.target.closest(
                ".robot-select"
            );

        if (!robotSelect) {
            return;
        }

        const itemId =
            Number(
                robotSelect.dataset.itemId
            );

        const value =
            robotSelect.value === ""
                ?
                ""
                :
                Number(
                    robotSelect.value
                );

        robotDrafts.set(
            itemId,
            value
        );

        const row =
            robotSelect.closest(
                ".order-item-row"
            );

        const button =
            row?.querySelector(
                ".robot-dispatch-button"
            );

        if (
            button
            &&
            !button.disabled
        ) {
            button.classList.remove(
                "dispatched"
            );

            button.textContent =
                "Xác nhận";
        }
    }
);

// ======================================================
// KHÓA AUTO REFRESH TRONG LÚC NGƯỜI DÙNG THAO TÁC
// ======================================================
async function withInteraction(
    callback
) {
    interactionInProgress =
        true;

    try {
        await callback();
    }
    finally {
        interactionInProgress =
            false;
    }
}

// ======================================================
// CHUYỂN MÓN CHO ROBOT
// ======================================================
async function dispatchToRobot(
    itemId,
    robotNumber,
    button
) {
    const oldText =
        button.textContent;

    button.disabled =
        true;

    button.textContent =
        "Đang gửi...";

    try {
        const response =
            await fetch(
                `${API_BASE_URL}/order-items/${itemId}/robot-dispatch`,
                {
                    method:
                        "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            {
                                robot:
                                    robotNumber
                            }
                        )
                }
            );

        if (!response.ok) {
            throw new Error(
                await getApiError(
                    response
                )
            );
        }

        // Xác nhận rồi thì bỏ robot draft
        robotDrafts.delete(
            itemId
        );

        await loadTableOrder(
            selectedTableNumber,
            true
        );

        await refreshTableStatuses(
            false,
            true
        );
    }
    catch (error) {

        button.disabled =
            false;

        button.textContent =
            oldText;

        console.error(
            "Lỗi chuyển món cho robot:",
            error
        );

        alert(
            "Không thể chuyển món cho robot.\n"
            +
            error.message
        );
    }
}

// ======================================================
// THAY ĐỔI SỐ LƯỢNG
// ======================================================
async function changeQuantity(
    itemId,
    newQuantity
) {
    if (
        newQuantity < 1
    ) {
        return;
    }

    try {
        const response =
            await fetch(
                `${API_BASE_URL}/order-items/${itemId}/quantity`,
                {
                    method:
                        "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            {
                                quantity:
                                    newQuantity
                            }
                        )
                }
            );

        if (!response.ok) {
            throw new Error(
                await getApiError(
                    response
                )
            );
        }

        await loadTableOrder(
            selectedTableNumber,
            true
        );

        await refreshTableStatuses(
            false,
            true
        );
    }
    catch (error) {

        console.error(
            "Lỗi cập nhật số lượng:",
            error
        );

        alert(
            "Không thể cập nhật số lượng.\n"
            +
            error.message
        );
    }
}

// ======================================================
// THAY ĐỔI TRẠNG THÁI ĐÃ GIAO
// ======================================================
async function toggleDelivered(
    itemId,
    delivered
) {
    try {
        const response =
            await fetch(
                `${API_BASE_URL}/order-items/${itemId}/delivered`,
                {
                    method:
                        "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            {
                                delivered:
                                    delivered
                            }
                        )
                }
            );

        if (!response.ok) {
            throw new Error(
                await getApiError(
                    response
                )
            );
        }

        await loadTableOrder(
            selectedTableNumber,
            true
        );

        await refreshTableStatuses(
            false,
            true
        );
    }
    catch (error) {

        console.error(
            "Lỗi cập nhật trạng thái giao món:",
            error
        );

        alert(
            "Không thể cập nhật trạng thái giao món.\n"
            +
            error.message
        );
    }
}

// ======================================================
// THANH TOÁN
//
// 1. GET lại dữ liệu mới nhất
// 2. Kiểm tra món đã nấu chưa
// 3. Kiểm tra món đã giao chưa
// 4. Nếu tất cả OK mới DELETE
// ======================================================
payButton.addEventListener(
    "click",
    async () => {

        if (
            selectedTableNumber === null
        ) {
            return;
        }

        if (
            currentItems.length === 0
        ) {
            alert(
                "Bàn này không có món để thanh toán."
            );

            return;
        }


        // ==================================================
        // GET DỮ LIỆU MỚI NHẤT
        // ==================================================
        await loadTableOrder(
            selectedTableNumber,
            true
        );


        // ==================================================
        // KIỂM TRA CHƯA NẤU XONG
        // ==================================================
        const notCooked =
            currentItems.filter(
                item =>
                    Number(
                        item.cooking_status || 0
                    )
                    <
                    2
            );


        // ==================================================
        // KIỂM TRA CHƯA GIAO
        // ==================================================
        const notDelivered =
            currentItems.filter(
                item =>
                    item.delivered !==
                    true
            );


        // ==================================================
        // CÓ MÓN CHƯA HOÀN THÀNH
        // ==================================================
        if (
            notCooked.length > 0
            ||
            notDelivered.length > 0
        ) {
            const warnings =
                [];


            if (
                notCooked.length > 0
            ) {
                warnings.push(
                    "Món chưa nấu xong: "
                    +
                    notCooked
                        .map(
                            item =>
                                item.food_name
                        )
                        .join(", ")
                );
            }


            if (
                notDelivered.length > 0
            ) {
                warnings.push(
                    "Món chưa giao: "
                    +
                    notDelivered
                        .map(
                            item =>
                                item.food_name
                        )
                        .join(", ")
                );
            }


            alert(
                "CHƯA THỂ THANH TOÁN\n\n"
                +
                warnings.join("\n")
                +
                "\n\nHãy kiểm tra đồ trước khi thanh toán."
            );

            return;
        }


        // ==================================================
        // XÁC NHẬN THANH TOÁN
        // ==================================================
        const confirmed =
            confirm(
                `Tất cả món đã nấu và đã giao.\n\n`
                +
                `Xác nhận thanh toán Bàn ${selectedTableNumber}?\n`
                +
                `Tổng tiền: ${tableTotal.textContent}\n\n`
                +
                `Sau khi xác nhận, toàn bộ món và mã đặt của bàn sẽ bị xóa.`
            );


        if (!confirmed) {
            return;
        }


        await withInteraction(
            async () => {

                payButton.disabled =
                    true;

                payButton.textContent =
                    "Đang thanh toán...";


                try {

                    // ======================================
                    // DELETE TOÀN BỘ ĐƠN CỦA BÀN
                    // ======================================
                    const response =
                        await fetch(
                            `${API_BASE_URL}/orders/table/${selectedTableNumber}`,
                            {
                                method:
                                    "DELETE"
                            }
                        );


                    if (!response.ok) {
                        throw new Error(
                            await getApiError(
                                response
                            )
                        );
                    }


                    const result =
                        await response.json();


                    // ======================================
                    // THÔNG BÁO
                    // ======================================
                    alert(
                        "Thanh toán thành công!\n"
                        +
                        `Bàn: ${selectedTableNumber}\n`
                        +
                        `Tổng tiền: ${formatCurrency(result.total)}\n`
                        +
                        `Đã xóa ${result.deleted_items} món.`
                    );


                    // ======================================
                    // XÓA NEW
                    // ======================================
                    clearNewFlag(
                        selectedTableNumber
                    );


                    robotDrafts.clear();


                    // ======================================
                    // LOAD LẠI BÀN
                    // ======================================
                    await loadTableOrder(
                        selectedTableNumber,
                        true
                    );


                    // ======================================
                    // UPDATE DANH SÁCH BÀN
                    // ======================================
                    await refreshTableStatuses(
                        false,
                        true
                    );
                }
                catch (error) {

                    console.error(
                        "Lỗi thanh toán:",
                        error
                    );

                    alert(
                        "Thanh toán thất bại.\n"
                        +
                        error.message
                    );
                }
                finally {

                    payButton.textContent =
                        "Thanh toán";

                    payButton.disabled =
                        currentItems.length ===
                        0;
                }
            }
        );
    }
);

// ======================================================
// NÚT LÀM MỚI
// ======================================================
refreshTablesButton.addEventListener(
    "click",
    async () => {

        await refreshTableStatuses(
            false,
            false
        );

        if (
            selectedTableNumber !== null
        ) {
            await loadTableOrder(
                selectedTableNumber,
                true
            );
        }
    }
);

// ======================================================
// NÚT CẬP NHẬT
// ======================================================
refreshOrderButton.addEventListener(
    "click",
    async () => {

        if (
            selectedTableNumber === null
        ) {
            return;
        }


        clearNewFlag(
            selectedTableNumber
        );


        refreshOrderButton.disabled =
            true;


        const oldText =
            refreshOrderButton.textContent;


        refreshOrderButton.textContent =
            "Đang tải...";


        try {

            await loadTableOrder(
                selectedTableNumber,
                true
            );


            await refreshTableStatuses(
                false,
                true
            );
        }
        finally {

            refreshOrderButton.textContent =
                oldText;


            refreshOrderButton.disabled =
                false;
        }
    }
);

// ======================================================
// FORMAT TIỀN
// ======================================================
function formatCurrency(
    value
) {
    const number =
        Number(
            value
        );


    if (
        Number.isNaN(
            number
        )
    ) {
        return "0 VNĐ";
    }


    return (
        number.toLocaleString(
            "vi-VN"
        )
        +
        " VNĐ"
    );
}

// ======================================================
// CHỐNG CHÈN HTML
// ======================================================
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

// ======================================================
// ĐỌC LỖI FASTAPI
// ======================================================
async function getApiError(
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


        if (
            Array.isArray(
                data.detail
            )
        ) {
            return data.detail
                .map(
                    item =>
                        item.msg
                )
                .join(", ");
        }


        return (
            "Server trả về lỗi "
            +
            response.status
        );
    }
    catch {

        return (
            "Server trả về lỗi "
            +
            response.status
        );
    }
}