// ======================================================
// CẤU HÌNH
// ======================================================

const API_BASE_URL = "https://2dd9-2402-800-61ae-b947-a9b3-5783-f5a9-71bb.ngrok-free.app";
const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
const TOTAL_TABLES = 10;


// ======================================================
// STATE
// ======================================================

let selectedTableNumber = null;
let currentItems = [];
let tableOrderRequestId = 0;
let dashboardSocket = null;
let websocketReconnectTimer = null;
let interactionInProgress = false;
let pendingServerReload = false;

// Snapshot dữ liệu server theo từng bàn.
// Nếu fetch lần sau giống snapshot cũ thì KHÔNG render lại.
async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});

    headers.set("ngrok-skip-browser-warning", "1");

    return fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers
    });
}
const previousServerSnapshots = new Map();

// Snapshot trạng thái card bàn.
const tableSnapshots = new Map();

// Bàn có đơn mới.
const tableNewFlags = new Set();

// Robot user đang chọn nhưng chưa xác nhận.
const robotDrafts = new Map();

// State sửa note/quantity local, chưa ghi DB.
const editStates = new Map();


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
const saveChangesButton = document.getElementById("saveChangesButton");
const refreshTablesButton = document.getElementById("refreshTablesButton");
const refreshOrderButton = document.getElementById("refreshOrderButton");
const connectionStatus = document.getElementById("connectionStatus");
const pendingServerNotice = document.getElementById("pendingServerNotice");


// ======================================================
// KHỞI ĐỘNG
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {
    createTableCards();
    await refreshTableStatuses(true);
    connectDashboardWebSocket();
});


// ======================================================
// TẠO BÀN
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
            await selectTable(tableNumber);
        });

        tablesContainer.appendChild(tableCard);
    }
}


// ======================================================
// WEBSOCKET REALTIME
// ======================================================

function connectDashboardWebSocket() {
    if (
        dashboardSocket &&
        (
            dashboardSocket.readyState === WebSocket.OPEN ||
            dashboardSocket.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }

    setConnectionState("connecting", "Realtime: đang kết nối...");

    dashboardSocket = new WebSocket(`${WS_BASE_URL}/ws/dashboard`);

    dashboardSocket.addEventListener("open", async () => {
        setConnectionState("connected", "Realtime: đã kết nối");

        // Đồng bộ một lần sau reconnect.
        await refreshTableStatuses(false, true);

        if (selectedTableNumber !== null && !hasUnsavedLocalState()) {
            await loadTableOrder(selectedTableNumber, {
                silent: true,
                forceRender: false,
            });
        }
    });

    dashboardSocket.addEventListener("message", event => {
        try {
            const data = JSON.parse(event.data);
            handleRealtimeMessage(data);
        }
        catch (error) {
            console.error("WebSocket JSON error:", error);
        }
    });

    dashboardSocket.addEventListener("close", () => {
        setConnectionState("disconnected", "Realtime: mất kết nối");

        clearTimeout(websocketReconnectTimer);
        websocketReconnectTimer = setTimeout(
            connectDashboardWebSocket,
            2000
        );
    });

    dashboardSocket.addEventListener("error", error => {
        console.error("WebSocket error:", error);
    });
}


function setConnectionState(className, text) {
    connectionStatus.className = `connection-status ${className}`;
    connectionStatus.textContent = text;
}


async function handleRealtimeMessage(data) {
    const type = data?.type;

    if (!type) {
        return;
    }

    // ==================================================
    // CÓ ĐƠN MỚI
    // ==================================================
    if (type === "order_created") {
        const tableNumber = Number(data.table);

        updateTableCardSummary(
            tableNumber,
            Number(data.item_count || 0),
            Number(data.max_item_id || 0),
            true
        );

        if (tableNumber === selectedTableNumber) {
            await requestReloadFromRealtime();
        }

        return;
    }

    // ==================================================
    // UPDATE / DELETE ITEM TỪ CLIENT KHÁC
    // ==================================================
    if (type === "table_items_updated") {
        const tableNumber = Number(data.table);

        updateTableCardSummary(
            tableNumber,
            Number(data.item_count || 0),
            Number(data.max_item_id || 0),
            false
        );

        if (tableNumber === selectedTableNumber) {
            await requestReloadFromRealtime();
        }

        return;
    }

    // ==================================================
    // BÀN ĐÃ THANH TOÁN / XÓA TOÀN BỘ
    // ==================================================
    if (type === "table_cleared") {
        const tableNumber = Number(data.table);

        updateTableCardSummary(tableNumber, 0, 0, false);
        clearNewFlag(tableNumber);

        if (tableNumber === selectedTableNumber) {
            if (hasUnsavedLocalState()) {
                markPendingServerReload();
            }
            else {
                previousServerSnapshots.delete(tableNumber);

                await loadTableOrder(tableNumber, {
                    silent: true,
                    forceRender: true,
                });
            }
        }

        return;
    }

    // ==================================================
    // TRẠNG THÁI NẤU 0 -> 1 -> 2
    // Chỉ update đúng ô, không render toàn bảng.
    // ==================================================
    if (type === "item_cooking_status") {
        applyCookingRealtime(data);
        return;
    }

    // ==================================================
    // BACKEND ĐÃ GỬI COMMAND MQTT TỚI ROBOT
    // ==================================================
    if (type === "robot_dispatched") {
        applyRobotDispatchedRealtime(data);
        return;
    }

    // ==================================================
    // ROBOT ESP32 BÁO ĐÃ ĐẾN BÀN
    // ==================================================
    if (type === "item_delivered") {
        applyDeliveredRealtime(data);
        return;
    }

    // ==================================================
    // USER ĐÁNH DẤU ĐÃ GIAO THỦ CÔNG
    // ==================================================
    if (type === "item_delivery_changed") {
        applyDeliveryChangedRealtime(data);
    }
}


async function requestReloadFromRealtime() {
    if (selectedTableNumber === null) {
        return;
    }

    if (hasUnsavedLocalState()) {
        markPendingServerReload();
        return;
    }

    await loadTableOrder(selectedTableNumber, {
        silent: true,
        forceRender: false,
    });
}


function markPendingServerReload() {
    pendingServerReload = true;
    pendingServerNotice.classList.remove("hidden");
}


function clearPendingServerReload() {
    pendingServerReload = false;
    pendingServerNotice.classList.add("hidden");
}


async function flushPendingServerReloadIfPossible() {
    if (
        !pendingServerReload ||
        selectedTableNumber === null ||
        hasUnsavedLocalState()
    ) {
        return;
    }

    clearPendingServerReload();

    await loadTableOrder(selectedTableNumber, {
        silent: true,
        forceRender: false,
    });
}


// ======================================================
// TABLE STATUS
// ======================================================

async function refreshTableStatuses(initial = false, silent = false) {
    if (!silent) {
        refreshTablesButton.disabled = true;
    }

    try {
        const response = await apiFetch(
            "/orders/tables/status",
            {
                method: "GET",
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(await getApiError(response));
        }

        const data = await response.json();
        const statuses = Array.isArray(data.tables) ? data.tables : [];

        for (const status of statuses) {
            const tableNumber = Number(status.table_number);
            const itemCount = Number(status.item_count || 0);
            const maxItemId = Number(status.max_item_id || 0);

            const previous = tableSnapshots.get(tableNumber);

            const newOrderDetected = (
                !initial &&
                previous &&
                maxItemId > Number(previous.maxItemId || 0)
            );

            updateTableCardSummary(
                tableNumber,
                itemCount,
                maxItemId,
                Boolean(newOrderDetected)
            );
        }
    }
    catch (error) {
        console.error(
            "Không tải được trạng thái bàn:",
            error
        );
    }
    finally {
        if (!silent) {
            refreshTablesButton.disabled = false;
        }
    }
}


function updateTableCardSummary(
    tableNumber,
    itemCount,
    maxItemId,
    markNew = false
) {
    const tableCard = document.querySelector(
        `.table-card[data-table-number="${tableNumber}"]`
    );

    if (!tableCard) {
        return;
    }

    const countBadge = tableCard.querySelector(
        ".table-order-badge"
    );

    const newBadge = tableCard.querySelector(
        ".table-new-badge"
    );

    if (markNew && itemCount > 0) {
        tableNewFlags.add(tableNumber);
    }

    if (itemCount > 0) {
        tableCard.classList.add("has-order");

        countBadge.textContent = itemCount;

        countBadge.classList.remove("hidden");
    }
    else {
        tableCard.classList.remove("has-order");

        countBadge.classList.add("hidden");

        tableNewFlags.delete(tableNumber);
    }

    if (tableNewFlags.has(tableNumber)) {
        newBadge.classList.remove("hidden");
    }
    else {
        newBadge.classList.add("hidden");
    }

    tableSnapshots.set(tableNumber, {
        itemCount,
        maxItemId,
    });
}


function clearNewFlag(tableNumber) {
    tableNewFlags.delete(tableNumber);

    const card = document.querySelector(
        `.table-card[data-table-number="${tableNumber}"]`
    );

    card
        ?.querySelector(".table-new-badge")
        ?.classList.add("hidden");
}


// ======================================================
// CHỌN BÀN
// ======================================================

async function selectTable(tableNumber) {
    if (
        selectedTableNumber !== null &&
        selectedTableNumber !== tableNumber &&
        hasUnsavedLocalState()
    ) {
        const confirmed = confirm(
            "Bạn đang có thay đổi chưa lưu ở bàn hiện tại.\n\n" +
            "Nếu chuyển bàn, các thay đổi local chưa Update sẽ bị bỏ.\n\n" +
            "Bạn có muốn tiếp tục?"
        );

        if (!confirmed) {
            return;
        }

        discardLocalStateForTable(
            selectedTableNumber
        );
    }

    selectedTableNumber = tableNumber;

    clearNewFlag(tableNumber);

    clearPendingServerReload();

    document
        .querySelectorAll(".table-card")
        .forEach(card => {
            card.classList.remove(
                "selected"
            );
        });

    document
        .querySelector(
            `.table-card[data-table-number="${tableNumber}"]`
        )
        ?.classList.add("selected");

    selectedTableTitle.textContent =
        `Bàn ${tableNumber}`;

    selectedTableDescription.textContent =
        "Danh sách món của bàn";

    refreshOrderButton.disabled =
        false;

    await loadTableOrder(
        tableNumber,
        {
            silent: false,
            forceRender: true,
        }
    );
}


function discardLocalStateForTable(tableNumber) {
    for (const [itemId, state] of editStates.entries()) {
        if (
            Number(state.tableNumber) ===
            Number(tableNumber)
        ) {
            editStates.delete(itemId);
        }
    }

    for (const item of currentItems) {
        if (
            Number(item.table_number) ===
            Number(tableNumber)
        ) {
            robotDrafts.delete(
                Number(item.id)
            );
        }
    }
}


// ======================================================
// SNAPSHOT SERVER
// ======================================================

function createServerSnapshot(items) {
    if (!Array.isArray(items)) {
        return "[]";
    }

    const normalized = items
        .map(item => ({
            id:
                Number(item.id),

            order_code:
                String(
                    item.order_code ?? ""
                ),

            table_number:
                Number(
                    item.table_number || 0
                ),

            food_name:
                String(
                    item.food_name ?? ""
                ),

            quantity:
                Number(
                    item.quantity || 0
                ),

            unit_price:
                Number(
                    item.unit_price || 0
                ),

            note:
                String(
                    item.note ?? ""
                ),

            delivered:
                item.delivered === true,

            cooking_status:
                Number(
                    item.cooking_status ?? 0
                ),

            assigned_robot:
                item.assigned_robot ?? null,

            robot_dispatched:
                item.robot_dispatched === true,

            delivery_status:
                String(
                    item.delivery_status ?? "waiting"
                ),

            dispatch_command_id:
                item.dispatch_command_id ?? null,
        }))
        .sort(
            (a, b) =>
                a.id - b.id
        );

    return JSON.stringify(
        normalized
    );
}


function syncSnapshotForCurrentTable() {
    if (selectedTableNumber === null) {
        return;
    }

    previousServerSnapshots.set(
        selectedTableNumber,
        createServerSnapshot(
            currentItems
        )
    );
}


// ======================================================
// LOAD DANH SÁCH MÓN
// ======================================================

async function loadTableOrder(
    tableNumber,
    {
        silent = false,
        forceRender = false,
    } = {}
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
        const response = await apiFetch(
            `/orders/table/${tableNumber}`,
            {
                method: "GET",
                cache: "no-store",
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

        if (
            requestId !== tableOrderRequestId ||
            tableNumber !== selectedTableNumber
        ) {
            return false;
        }

        const newItems =
            Array.isArray(data.items)
                ? data.items
                : [];

        const newSnapshot =
            createServerSnapshot(
                newItems
            );

        const previousSnapshot =
            previousServerSnapshots.get(
                tableNumber
            );

        // ==================================================
        // KHÔNG KHÁC SERVER LẦN TRƯỚC
        // => KHÔNG RENDER
        // ==================================================

        if (
            !forceRender &&
            previousSnapshot !== undefined &&
            previousSnapshot === newSnapshot
        ) {
            console.log(
                `Bàn ${tableNumber}: dữ liệu server không đổi -> không render`
            );

            loadingBox.classList.add(
                "hidden"
            );

            orderContent.classList.remove(
                "hidden"
            );

            return false;
        }

        // ==================================================
        // USER ĐANG CÓ DỮ LIỆU LOCAL
        // => KHÔNG RENDER FULL
        // ==================================================

        if (
            !forceRender &&
            hasUnsavedLocalState()
        ) {
            markPendingServerReload();

            return false;
        }

        previousServerSnapshots.set(
            tableNumber,
            newSnapshot
        );

        currentItems =
            newItems;

        syncEditStates(
            currentItems
        );

        cleanupRobotDrafts(
            currentItems
        );

        renderOrderItems(
            currentItems
        );

        clearPendingServerReload();

        loadingBox.classList.add(
            "hidden"
        );

        orderContent.classList.remove(
            "hidden"
        );

        return true;
    }
    catch (error) {
        if (
            requestId !== tableOrderRequestId ||
            tableNumber !== selectedTableNumber
        ) {
            return false;
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

            saveChangesButton.disabled =
                true;
        }

        console.error(
            "loadTableOrder error:",
            error
        );

        return false;
    }
}


// ======================================================
// EDIT STATE
// ======================================================

function normalizeNote(note) {
    return String(
        note ?? ""
    );
}


function syncEditStates(items) {
    const serverIds =
        new Set();

    for (const item of items) {
        const itemId =
            Number(item.id);

        serverIds.add(
            itemId
        );

        const serverQuantity =
            Number(item.quantity);

        const serverNote =
            normalizeNote(item.note);

        const existing =
            editStates.get(itemId);

        if (!existing) {
            editStates.set(
                itemId,
                {
                    tableNumber:
                        Number(
                            item.table_number
                        ),

                    foodName:
                        item.food_name,

                    unitPrice:
                        Number(
                            item.unit_price
                        ),

                    originalQuantity:
                        serverQuantity,

                    originalNote:
                        serverNote,

                    quantity:
                        serverQuantity,

                    note:
                        serverNote,

                    dirty:
                        false,
                }
            );

            continue;
        }

        existing.tableNumber =
            Number(
                item.table_number
            );

        existing.foodName =
            item.food_name;

        existing.unitPrice =
            Number(
                item.unit_price
            );

        if (!existing.dirty) {
            existing.originalQuantity =
                serverQuantity;

            existing.originalNote =
                serverNote;

            existing.quantity =
                serverQuantity;

            existing.note =
                serverNote;
        }
    }

    for (
        const [itemId, state]
        of editStates.entries()
    ) {
        if (
            Number(state.tableNumber) ===
                Number(selectedTableNumber) &&
            !serverIds.has(
                Number(itemId)
            )
        ) {
            editStates.delete(
                itemId
            );
        }
    }
}


function getEditState(item) {
    const itemId =
        Number(item.id);

    if (
        !editStates.has(
            itemId
        )
    ) {
        syncEditStates(
            [item]
        );
    }

    return editStates.get(
        itemId
    );
}


function updateDirtyState(state) {
    state.dirty = (
        Number(state.quantity) !==
            Number(state.originalQuantity) ||
        normalizeNote(state.note) !==
            normalizeNote(state.originalNote)
    );
}


function hasPendingChanges() {
    return currentItems.some(
        item => {
            return (
                editStates.get(
                    Number(item.id)
                )?.dirty === true
            );
        }
    );
}


function hasRobotDraftsForCurrentTable() {
    return currentItems.some(
        item =>
            robotDrafts.has(
                Number(item.id)
            )
    );
}


function hasFocusedEditor() {
    const active =
        document.activeElement;

    if (!active) {
        return false;
    }

    return (
        active.classList?.contains(
            "note-input"
        ) ||
        active.classList?.contains(
            "robot-select"
        )
    );
}


function hasUnsavedLocalState() {
    return (
        hasPendingChanges() ||
        hasRobotDraftsForCurrentTable() ||
        hasFocusedEditor()
    );
}


function getPendingChanges() {
    return currentItems
        .map(item => {
            const state =
                editStates.get(
                    Number(item.id)
                );

            if (!state?.dirty) {
                return null;
            }

            return {
                id:
                    Number(item.id),

                foodName:
                    item.food_name,

                originalQuantity:
                    Number(
                        state.originalQuantity
                    ),

                quantity:
                    Number(
                        state.quantity
                    ),

                originalNote:
                    normalizeNote(
                        state.originalNote
                    ),

                note:
                    normalizeNote(
                        state.note
                    ),
            };
        })
        .filter(Boolean);
}


// ======================================================
// RENDER
// ======================================================

function renderOrderItems(items) {
    orderItems.innerHTML = "";

    if (
        !items ||
        items.length === 0
    ) {
        noItemsMessage.classList.remove(
            "hidden"
        );

        noItemsMessage.textContent =
            "Bàn này hiện không có món nào.";

        tableTotal.textContent =
            formatCurrency(0);

        saveChangesButton.disabled =
            true;

        payButton.disabled =
            true;

        return;
    }

    noItemsMessage.classList.add(
        "hidden"
    );

    for (const item of items) {
        const itemId =
            Number(item.id);

        const state =
            getEditState(item);

        const quantity =
            Number(state.quantity);

        const unitPrice =
            Number(item.unit_price);

        const itemTotal =
            quantity * unitPrice;

        const cookingStatus =
            Number(
                item.cooking_status ?? 0
            );

        const cookingInfo =
            getCookingInfo(
                cookingStatus
            );

        const delivered =
            item.delivered === true;

        const deliveredClass =
            delivered
                ? "delivered-button delivered"
                : "delivered-button";

        const databaseRobot = (
            item.assigned_robot === 1 ||
            item.assigned_robot === 2
        )
            ? Number(
                item.assigned_robot
            )
            : "";

        let selectedRobot =
            databaseRobot;

        if (
            robotDrafts.has(itemId) &&
            item.robot_dispatched !== true
        ) {
            selectedRobot =
                robotDrafts.get(
                    itemId
                );
        }

        const dispatchInfo =
            getDispatchInfo(
                item,
                state
            );

        const row =
            document.createElement(
                "div"
            );

        row.className =
            "order-item-row";

        row.dataset.itemId =
            itemId;

        if (state.dirty) {
            row.classList.add(
                "dirty-row"
            );
        }

        if (quantity === 0) {
            row.classList.add(
                "marked-for-delete"
            );
        }

        row.innerHTML = `
            <div class="food-name">
                <span class="mobile-label">Món:</span>
                <strong>${escapeHtml(item.food_name)}</strong>
            </div>

            <div class="food-note-editor">
                <span class="mobile-label">Ghi chú:</span>

                <input
                    type="text"
                    class="note-input ${
                        state.note !== state.originalNote
                            ? "changed"
                            : ""
                    }"
                    data-item-id="${itemId}"
                    maxlength="500"
                    value="${escapeHtml(state.note)}"
                    placeholder="Nhập ghi chú..."
                >
            </div>

            <div class="quantity-manager">
                <span class="mobile-label">Số lượng:</span>

                <button
                    type="button"
                    class="quantity-minus"
                    data-item-id="${itemId}"
                    ${
                        quantity <= 0
                            ? "disabled"
                            : ""
                    }
                >
                    -
                </button>

                <span
                    class="quantity-value ${
                        quantity === 0
                            ? "zero-quantity"
                            : ""
                    }"
                >
                    ${quantity}
                </span>

                <button
                    type="button"
                    class="quantity-plus"
                    data-item-id="${itemId}"
                >
                    +
                </button>
            </div>

            <div class="unit-price">
                <span class="mobile-label">Đơn giá:</span>
                ${formatCurrency(unitPrice)}
            </div>

            <div class="item-total">
                <span class="mobile-label">Thành tiền:</span>
                <strong>${formatCurrency(itemTotal)}</strong>
            </div>

            <div class="cooking-status">
                <span class="mobile-label">Đã nấu:</span>

                <span
                    class="${cookingInfo.className}"
                    title="${cookingInfo.title}"
                >
                    ✓
                </span>
            </div>

            <div class="delivery-status">
                <span class="mobile-label">Đã giao:</span>

                <button
                    type="button"
                    class="${deliveredClass}"
                    data-item-id="${itemId}"
                    data-delivered="${delivered}"
                    title="${
                        delivered
                            ? "Đã giao"
                            : "Chưa giao - bấm để đánh dấu thủ công"
                    }"
                >
                    ✓
                </button>
            </div>

            <div class="robot-assignment">
                <span class="mobile-label">Robot:</span>

                <select
                    class="robot-select"
                    data-item-id="${itemId}"
                    ${
                        dispatchInfo.lockRobotSelect
                            ? "disabled"
                            : ""
                    }
                >
                    <option
                        value=""
                        ${
                            selectedRobot === ""
                                ? "selected"
                                : ""
                        }
                    >
                        Chọn robot
                    </option>

                    <option
                        value="1"
                        ${
                            selectedRobot === 1
                                ? "selected"
                                : ""
                        }
                    >
                        Robot 1
                    </option>

                    <option
                        value="2"
                        ${
                            selectedRobot === 2
                                ? "selected"
                                : ""
                        }
                    >
                        Robot 2
                    </option>
                </select>
            </div>

            <div class="robot-dispatch-area">
                <span class="mobile-label">Chuyển giao:</span>

                <button
                    type="button"
                    class="${dispatchInfo.className}"
                    data-item-id="${itemId}"
                    title="${dispatchInfo.title}"
                    ${
                        dispatchInfo.disabled
                            ? "disabled"
                            : ""
                    }
                >
                    ${dispatchInfo.text}
                </button>
            </div>
        `;

        orderItems.appendChild(
            row
        );
    }

    updateTotalFromDrafts();

    refreshActionButtons();
}


// ======================================================
// COOKING
// ======================================================

function getCookingInfo(cookingStatus) {
    if (cookingStatus === 1) {
        return {
            className:
                "cooking-indicator cooking",

            title:
                "Đang nấu",
        };
    }

    if (cookingStatus >= 2) {
        return {
            className:
                "cooking-indicator cooked",

            title:
                "Đã nấu xong",
        };
    }

    return {
        className:
            "cooking-indicator waiting",

        title:
            "Chưa bắt đầu nấu",
    };
}


// ======================================================
// ROBOT DISPATCH UI
// ======================================================

function getDispatchInfo(item, state) {
    const cookingStatus =
        Number(
            item.cooking_status ?? 0
        );

    const delivered =
        item.delivered === true;

    const robotDispatched =
        item.robot_dispatched === true;

    const deliveryStatus =
        String(
            item.delivery_status ?? "waiting"
        );

    const assignedRobot = (
        item.assigned_robot === 1 ||
        item.assigned_robot === 2
    )
        ? Number(item.assigned_robot)
        : null;

    // ==================================================
    // ĐÃ GIAO
    // ==================================================

    if (
        delivered ||
        deliveryStatus === "delivered"
    ) {
        return {
            text:
                assignedRobot
                    ? `✓ Robot ${assignedRobot}`
                    : "✓ Đã giao",

            className:
                "robot-dispatch-button dispatched",

            disabled:
                true,

            title:
                "Robot đã giao món thành công",

            lockRobotSelect:
                true,
        };
    }

    // ==================================================
    // ĐANG GIAO
    // ==================================================

    if (
        robotDispatched ||
        deliveryStatus === "dispatched"
    ) {
        return {
            text:
                assignedRobot
                    ? `Robot ${assignedRobot} đang giao...`
                    : "Robot đang giao...",

            className:
                "robot-dispatch-button dispatching",

            disabled:
                true,

            title:
                "Đã gửi lệnh MQTT, đang chờ robot báo đã đến bàn",

            lockRobotSelect:
                true,
        };
    }

    // ==================================================
    // GỬI THẤT BẠI
    // ==================================================

    if (
        deliveryStatus === "failed"
    ) {
        return {
            text:
                "Gửi lại",

            className:
                "robot-dispatch-button failed",

            disabled:
                state.dirty ||
                Number(state.quantity) <= 0,

            title:
                "Lần gửi trước thất bại - chọn robot và gửi lại",

            lockRobotSelect:
                false,
        };
    }

    // ==================================================
    // CHƯA GỬI
    // ==================================================

    const disabled = (
        cookingStatus < 1 ||
        state.dirty ||
        Number(state.quantity) <= 0
    );

    let title =
        "Xác nhận chuyển món cho robot";

    if (cookingStatus < 1) {
        title =
            "Chờ đủ 5 giây để món bắt đầu nấu";
    }
    else if (state.dirty) {
        title =
            "Hãy bấm Update để lưu thay đổi trước khi chuyển robot";
    }
    else if (
        Number(state.quantity) <= 0
    ) {
        title =
            "Món có số lượng 0 sẽ bị xóa khi Update";
    }

    return {
        text:
            "Xác nhận",

        className:
            "robot-dispatch-button",

        disabled,

        title,

        lockRobotSelect:
            false,
    };
}


// ======================================================
// REALTIME UPDATE TỪ WEBSOCKET
// KHÔNG RENDER FULL
// ======================================================

function findCurrentItem(itemId) {
    return currentItems.find(
        item =>
            Number(item.id) ===
            Number(itemId)
    );
}


function findItemRow(itemId) {
    return orderItems.querySelector(
        `.order-item-row[data-item-id="${Number(itemId)}"]`
    );
}


// ======================================================
// UPDATE COOKING REALTIME
// ======================================================

function applyCookingRealtime(data) {
    const tableNumber =
        Number(data.table);

    const itemId =
        Number(data.item_id);

    if (
        tableNumber !==
        selectedTableNumber
    ) {
        return;
    }

    const item =
        findCurrentItem(
            itemId
        );

    const row =
        findItemRow(
            itemId
        );

    if (
        !item ||
        !row
    ) {
        return;
    }

    item.cooking_status =
        Number(
            data.cooking_status || 0
        );

    const info =
        getCookingInfo(
            item.cooking_status
        );

    const indicator =
        row.querySelector(
            ".cooking-indicator"
        );

    if (indicator) {
        indicator.className =
            info.className;

        indicator.title =
            info.title;
    }

    refreshDispatchControlForRow(
        item,
        row
    );

    syncSnapshotForCurrentTable();
}


// ======================================================
// BACKEND ĐÃ PUBLISH MQTT
// ======================================================

function applyRobotDispatchedRealtime(data) {
    const tableNumber =
        Number(data.table);

    const itemId =
        Number(data.item_id);

    if (
        tableNumber !==
        selectedTableNumber
    ) {
        return;
    }

    const item =
        findCurrentItem(
            itemId
        );

    const row =
        findItemRow(
            itemId
        );

    if (
        !item ||
        !row
    ) {
        return;
    }

    item.assigned_robot =
        Number(data.robot);

    item.robot_dispatched =
        true;

    item.delivery_status =
        "dispatched";

    item.dispatch_command_id =
        data.command_id ?? null;

    robotDrafts.delete(
        itemId
    );

    const robotSelect =
        row.querySelector(
            ".robot-select"
        );

    if (robotSelect) {
        robotSelect.value =
            String(data.robot);

        robotSelect.disabled =
            true;
    }

    refreshDispatchControlForRow(
        item,
        row
    );

    syncSnapshotForCurrentTable();

    flushPendingServerReloadIfPossible();
}


// ======================================================
// ESP32 ĐÃ ĐẾN BÀN
// ======================================================

function applyDeliveredRealtime(data) {
    const tableNumber =
        Number(data.table);

    const itemId =
        Number(data.item_id);

    if (
        tableNumber !==
        selectedTableNumber
    ) {
        return;
    }

    const item =
        findCurrentItem(
            itemId
        );

    const row =
        findItemRow(
            itemId
        );

    if (
        !item ||
        !row
    ) {
        return;
    }

    item.delivered =
        true;

    item.delivery_status =
        "delivered";

    item.assigned_robot =
        Number(
            data.robot ||
            item.assigned_robot ||
            0
        )
        ||
        item.assigned_robot;

    // ==================================================
    // CHỈ UPDATE NÚT ĐÃ GIAO
    // ==================================================

    const deliveredButton =
        row.querySelector(
            ".delivered-button"
        );

    if (deliveredButton) {
        deliveredButton.classList.add(
            "delivered"
        );

        deliveredButton.dataset.delivered =
            "true";

        deliveredButton.title =
            "Đã giao";
    }

    // ==================================================
    // ROBOT SELECT
    // ==================================================

    const robotSelect =
        row.querySelector(
            ".robot-select"
        );

    if (
        robotSelect &&
        data.robot
    ) {
        robotSelect.value =
            String(data.robot);

        robotSelect.disabled =
            true;
    }

    // ==================================================
    // CHUYỂN GIAO
    // ==================================================

    refreshDispatchControlForRow(
        item,
        row
    );

    syncSnapshotForCurrentTable();

    refreshActionButtons();

    console.log(
        `✓ ${data.food_name || "Món"} đã được Robot ${data.robot} giao tới Bàn ${tableNumber}`
    );
}


// ======================================================
// THAY ĐỔI ĐÃ GIAO THỦ CÔNG
// ======================================================

function applyDeliveryChangedRealtime(data) {
    const tableNumber =
        Number(data.table);

    const itemId =
        Number(data.item_id);

    if (
        tableNumber !==
        selectedTableNumber
    ) {
        return;
    }

    const item =
        findCurrentItem(
            itemId
        );

    const row =
        findItemRow(
            itemId
        );

    if (
        !item ||
        !row
    ) {
        return;
    }

    item.delivered =
        data.delivered === true;

    item.delivery_status =
        String(
            data.delivery_status ||
            "waiting"
        );

    const deliveredButton =
        row.querySelector(
            ".delivered-button"
        );

    if (deliveredButton) {
        deliveredButton.classList.toggle(
            "delivered",
            item.delivered
        );

        deliveredButton.dataset.delivered =
            String(
                item.delivered
            );

        deliveredButton.title =
            item.delivered
                ? "Đã giao"
                : "Chưa giao - bấm để đánh dấu thủ công";
    }

    refreshDispatchControlForRow(
        item,
        row
    );

    syncSnapshotForCurrentTable();

    refreshActionButtons();
}


// ======================================================
// UPDATE RIÊNG CONTROL ROBOT CỦA ROW
// ======================================================

function refreshDispatchControlForRow(
    item,
    row
) {
    const state =
        editStates.get(
            Number(item.id)
        )
        ||
        getEditState(
            item
        );

    const info =
        getDispatchInfo(
            item,
            state
        );

    const button =
        row.querySelector(
            ".robot-dispatch-button"
        );

    const robotSelect =
        row.querySelector(
            ".robot-select"
        );

    if (button) {
        button.className =
            info.className;

        button.textContent =
            info.text;

        button.disabled =
            info.disabled;

        button.title =
            info.title;
    }

    if (robotSelect) {
        robotSelect.disabled =
            info.lockRobotSelect;
    }
}


// ======================================================
// NOTE INPUT
// ======================================================

orderItems.addEventListener(
    "input",
    event => {
        const noteInput =
            event.target.closest(
                ".note-input"
            );

        if (!noteInput) {
            return;
        }

        const itemId =
            Number(
                noteInput.dataset.itemId
            );

        const state =
            editStates.get(
                itemId
            );

        if (!state) {
            return;
        }

        state.note =
            noteInput.value;

        updateDirtyState(
            state
        );

        noteInput.classList.toggle(
            "changed",
            state.note !==
                state.originalNote
        );

        const row =
            noteInput.closest(
                ".order-item-row"
            );

        row?.classList.toggle(
            "dirty-row",
            state.dirty
        );

        const item =
            findCurrentItem(
                itemId
            );

        if (
            item &&
            row
        ) {
            refreshDispatchControlForRow(
                item,
                row
            );
        }

        refreshActionButtons();
    }
);


// ======================================================
// CLICK TRONG BẢNG
// ======================================================

orderItems.addEventListener(
    "click",
    async event => {

        // ==================================================
        // -
        // ==================================================

        const quantityMinus =
            event.target.closest(
                ".quantity-minus"
            );

        if (quantityMinus) {
            changeQuantityDraft(
                Number(
                    quantityMinus.dataset.itemId
                ),
                -1
            );

            return;
        }

        // ==================================================
        // +
        // ==================================================

        const quantityPlus =
            event.target.closest(
                ".quantity-plus"
            );

        if (quantityPlus) {
            changeQuantityDraft(
                Number(
                    quantityPlus.dataset.itemId
                ),
                +1
            );

            return;
        }

        // ==================================================
        // DELIVERED
        // ==================================================

        const deliveredButton =
            event.target.closest(
                ".delivered-button"
            );

        if (deliveredButton) {
            const itemId =
                Number(
                    deliveredButton.dataset.itemId
                );

            const currentDelivered =
                deliveredButton.dataset.delivered ===
                "true";

            await withInteraction(
                async () => {
                    await toggleDelivered(
                        itemId,
                        !currentDelivered
                    );
                }
            );

            return;
        }

        // ==================================================
        // ROBOT DISPATCH
        // ==================================================

        const robotDispatchButton =
            event.target.closest(
                ".robot-dispatch-button"
            );

        if (robotDispatchButton) {
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
                row?.querySelector(
                    ".robot-select"
                );

            const robotNumber =
                Number(
                    robotSelect?.value
                );

            if (
                robotNumber !== 1 &&
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
// QUANTITY LOCAL
//
// 1 -> 0 được phép.
// Chỉ disable dấu - khi quantity = 0.
// ======================================================

function changeQuantityDraft(
    itemId,
    delta
) {
    const state =
        editStates.get(
            itemId
        );

    if (!state) {
        return;
    }

    const currentQuantity =
        Number(
            state.quantity
        );

    const newQuantity =
        Math.max(
            0,
            currentQuantity + delta
        );

    if (
        newQuantity ===
        currentQuantity
    ) {
        return;
    }

    state.quantity =
        newQuantity;

    updateDirtyState(
        state
    );

    // User chủ động bấm +/- nên render local được phép.
    renderOrderItems(
        currentItems
    );
}


// ======================================================
// ROBOT SELECT LOCAL
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
                ? ""
                : Number(
                    robotSelect.value
                );

        if (value === "") {
            robotDrafts.delete(
                itemId
            );
        }
        else {
            robotDrafts.set(
                itemId,
                value
            );
        }

        const row =
            robotSelect.closest(
                ".order-item-row"
            );

        const item =
            findCurrentItem(
                itemId
            );

        if (
            item &&
            row
        ) {
            refreshDispatchControlForRow(
                item,
                row
            );
        }
    }
);


function cleanupRobotDrafts(items) {
    const ids =
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
            !ids.has(
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
// TOTAL + BUTTONS
// ======================================================

function updateTotalFromDrafts() {
    let total = 0;

    for (
        const item
        of currentItems
    ) {
        const state =
            getEditState(
                item
            );

        total +=
            Number(
                state.quantity
            )
            *
            Number(
                item.unit_price
            );
    }

    tableTotal.textContent =
        formatCurrency(
            total
        );
}


function refreshActionButtons() {
    const hasItems =
        currentItems.length > 0;

    const dirty =
        hasPendingChanges();

    saveChangesButton.disabled =
        !dirty;

    payButton.disabled =
        !hasItems ||
        dirty;

    payButton.title =
        dirty
            ? "Hãy bấm Update để lưu thay đổi trước khi thanh toán"
            : "Thanh toán";
}


// ======================================================
// UPDATE NOTE + QUANTITY
// ======================================================

saveChangesButton.addEventListener(
    "click",
    async () => {
        if (
            selectedTableNumber ===
            null
        ) {
            return;
        }

        const changes =
            getPendingChanges();

        if (
            changes.length === 0
        ) {
            saveChangesButton.disabled =
                true;

            return;
        }

        const confirmationText =
            buildUpdateConfirmation(
                changes
            );

        if (
            !confirm(
                confirmationText
            )
        ) {
            return;
        }

        await withInteraction(
            async () => {
                const oldText =
                    saveChangesButton.textContent;

                saveChangesButton.disabled =
                    true;

                saveChangesButton.textContent =
                    "Đang lưu...";

                try {
                    const response =
                        await apiFetch(
                            `/orders/table/${selectedTableNumber}/items`,
                            {
                                method:
                                    "PATCH",

                                headers: {
                                    "Content-Type":
                                        "application/json",
                                },

                                body:
                                    JSON.stringify(
                                        {
                                            items:
                                                changes.map(
                                                    change => ({
                                                        id:
                                                            change.id,

                                                        quantity:
                                                            change.quantity,

                                                        note:
                                                            change.note,
                                                    })
                                                ),
                                        }
                                    ),
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

                    for (
                        const change
                        of changes
                    ) {
                        editStates.delete(
                            change.id
                        );

                        if (
                            change.quantity === 0
                        ) {
                            robotDrafts.delete(
                                change.id
                            );
                        }
                    }

                    currentItems =
                        Array.isArray(
                            result.items
                        )
                            ? result.items
                            : [];

                    previousServerSnapshots.set(
                        selectedTableNumber,
                        createServerSnapshot(
                            currentItems
                        )
                    );

                    syncEditStates(
                        currentItems
                    );

                    cleanupRobotDrafts(
                        currentItems
                    );

                    renderOrderItems(
                        currentItems
                    );

                    clearPendingServerReload();

                    updateTableCardSummary(
                        selectedTableNumber,
                        currentItems.length,
                        currentItems.length > 0
                            ? Math.max(
                                ...currentItems.map(
                                    item =>
                                        Number(item.id)
                                )
                            )
                            : 0,
                        false
                    );

                    const messages =
                        [
                            "Cập nhật thành công!"
                        ];

                    if (
                        Number(
                            result.updated_items || 0
                        ) > 0
                    ) {
                        messages.push(
                            `Đã cập nhật: ${result.updated_items} món.`
                        );
                    }

                    if (
                        Number(
                            result.deleted_items || 0
                        ) > 0
                    ) {
                        messages.push(
                            `Đã xóa: ${result.deleted_items} món có số lượng bằng 0.`
                        );
                    }

                    alert(
                        messages.join("\n")
                    );

                    await flushPendingServerReloadIfPossible();
                }
                catch (error) {
                    console.error(
                        "Update error:",
                        error
                    );

                    alert(
                        "Không thể cập nhật đơn hàng.\n" +
                        error.message
                    );
                }
                finally {
                    saveChangesButton.textContent =
                        oldText;

                    refreshActionButtons();
                }
            }
        );
    }
);


// ======================================================
// CONFIRM UPDATE
// ======================================================

function buildUpdateConfirmation(changes) {
    const lines = [
        `XÁC NHẬN CẬP NHẬT BÀN ${selectedTableNumber}`,
        "",
        "Thông tin trước và sau thay đổi:",
    ];

    changes.forEach(
        (change, index) => {
            lines.push("");

            lines.push(
                `${index + 1}. ${change.foodName}`
            );

            if (
                change.originalQuantity !==
                change.quantity
            ) {
                lines.push(
                    `   Số lượng: ${change.originalQuantity} -> ${change.quantity}`
                );
            }

            if (
                change.originalNote !==
                change.note
            ) {
                lines.push(
                    `   Ghi chú: ${displayNote(change.originalNote)} -> ${displayNote(change.note)}`
                );
            }

            if (
                change.quantity === 0
            ) {
                lines.push(
                    "   ⚠ Món này sẽ bị XÓA khỏi database."
                );
            }
        }
    );

    lines.push("");

    lines.push(
        "Bấm OK để lưu thay đổi."
    );

    return lines.join(
        "\n"
    );
}


function displayNote(note) {
    const value =
        normalizeNote(
            note
        ).trim();

    return value === ""
        ? "(trống)"
        : `"${value}"`;
}


// ======================================================
// MQTT ROBOT DISPATCH API
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
            await apiFetch(
                `/order-items/${itemId}/robot-dispatch`,
                {
                    method:
                        "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body:
                        JSON.stringify(
                            {
                                robot:
                                    robotNumber,
                            }
                        ),
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

        // REST response cập nhật ngay.
        // WebSocket nhận cùng event lần nữa vẫn an toàn.
        applyRobotDispatchedRealtime(
            result
        );

        console.log(
            `MQTT sent -> ${result.topic}: item ${itemId}, bàn ${result.table}`
        );
    }
    catch (error) {
        button.disabled =
            false;

        button.textContent =
            oldText;

        console.error(
            "Robot dispatch error:",
            error
        );

        alert(
            "Không thể gửi món cho robot.\n" +
            error.message
        );
    }
}


// ======================================================
// TOGGLE DELIVERED THỦ CÔNG
// ======================================================

async function toggleDelivered(
    itemId,
    delivered
) {
    try {
        const response =
            await apiFetch(
                `/order-items/${itemId}/delivered`,
                {
                    method:
                        "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body:
                        JSON.stringify(
                            {
                                delivered,
                            }
                        ),
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

        const item =
            findCurrentItem(
                itemId
            );

        if (item) {
            applyDeliveryChangedRealtime(
                {
                    type:
                        "item_delivery_changed",

                    item_id:
                        itemId,

                    table:
                        item.table_number,

                    delivered:
                        result.delivered,

                    delivery_status:
                        result.delivery_status,
                }
            );
        }
    }
    catch (error) {
        console.error(
            "Delivered update error:",
            error
        );

        alert(
            "Không thể cập nhật trạng thái giao món.\n" +
            error.message
        );
    }
}


// ======================================================
// THANH TOÁN
// ======================================================

payButton.addEventListener(
    "click",
    async () => {
        if (
            selectedTableNumber ===
            null
        ) {
            return;
        }

        if (
            hasPendingChanges()
        ) {
            alert(
                "Bạn đang có thay đổi chưa lưu. Hãy bấm Update trước khi thanh toán."
            );

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
        // FETCH MỘT LẦN TRƯỚC THANH TOÁN
        // ==================================================

        await loadTableOrder(
            selectedTableNumber,
            {
                silent:
                    true,

                forceRender:
                    false,
            }
        );

        // ==================================================
        // KIỂM TRA NẤU
        // ==================================================

        const notCooked =
            currentItems.filter(
                item =>
                    Number(
                        item.cooking_status ?? 0
                    ) < 2
            );

        // ==================================================
        // KIỂM TRA GIAO
        // ==================================================

        const notDelivered =
            currentItems.filter(
                item =>
                    item.delivered !== true
            );

        if (
            notCooked.length > 0 ||
            notDelivered.length > 0
        ) {
            const warnings =
                [];

            if (
                notCooked.length > 0
            ) {
                warnings.push(
                    "Món chưa nấu xong: " +
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
                    "Món chưa giao: " +
                    notDelivered
                        .map(
                            item =>
                                item.food_name
                        )
                        .join(", ")
                );
            }

            alert(
                "CHƯA THỂ THANH TOÁN\n\n" +
                warnings.join("\n") +
                "\n\nHãy kiểm tra đồ trước khi thanh toán."
            );

            return;
        }

        // ==================================================
        // CONFIRM
        // ==================================================

        const confirmed =
            confirm(
                `Tất cả món đã nấu và đã giao.\n\n` +
                `Xác nhận thanh toán Bàn ${selectedTableNumber}?\n` +
                `Tổng tiền: ${tableTotal.textContent}\n\n` +
                `Sau khi xác nhận, toàn bộ món và mã đặt của bàn sẽ bị xóa.`
            );

        if (!confirmed) {
            return;
        }

        // ==================================================
        // DELETE
        // ==================================================

        await withInteraction(
            async () => {
                const oldText =
                    payButton.textContent;

                payButton.disabled =
                    true;

                payButton.textContent =
                    "Đang thanh toán...";

                try {
                    const response =
                        await apiFetch(
                            `/orders/table/${selectedTableNumber}`,
                            {
                                method:
                                    "DELETE",
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

                    alert(
                        "Thanh toán thành công!\n" +
                        `Bàn: ${selectedTableNumber}\n` +
                        `Tổng tiền: ${formatCurrency(result.total)}\n` +
                        `Đã xóa ${result.deleted_items} món.`
                    );

                    discardLocalStateForTable(
                        selectedTableNumber
                    );

                    currentItems =
                        [];

                    previousServerSnapshots.set(
                        selectedTableNumber,
                        "[]"
                    );

                    renderOrderItems(
                        []
                    );

                    updateTableCardSummary(
                        selectedTableNumber,
                        0,
                        0,
                        false
                    );

                    clearNewFlag(
                        selectedTableNumber
                    );

                    clearPendingServerReload();
                }
                catch (error) {
                    console.error(
                        "Payment error:",
                        error
                    );

                    alert(
                        "Thanh toán thất bại.\n" +
                        error.message
                    );
                }
                finally {
                    payButton.textContent =
                        oldText;

                    refreshActionButtons();
                }
            }
        );
    }
);


// ======================================================
// REFRESH DANH SÁCH BÀN
// ======================================================

refreshTablesButton.addEventListener(
    "click",
    async () => {
        await refreshTableStatuses(
            false,
            false
        );

        if (
            selectedTableNumber !== null &&
            !hasUnsavedLocalState()
        ) {
            await loadTableOrder(
                selectedTableNumber,
                {
                    silent:
                        true,

                    forceRender:
                        false,
                }
            );
        }
    }
);


// ======================================================
// REFRESH BÀN HIỆN TẠI
// ======================================================

refreshOrderButton.addEventListener(
    "click",
    async () => {
        if (
            selectedTableNumber ===
            null
        ) {
            return;
        }

        if (
            hasPendingChanges()
        ) {
            const confirmed =
                confirm(
                    "Bạn có thay đổi ghi chú/số lượng chưa Update.\n\n" +
                    "Bấm OK sẽ bỏ các thay đổi local và tải lại dữ liệu từ server."
                );

            if (!confirmed) {
                return;
            }

            discardLocalStateForTable(
                selectedTableNumber
            );
        }

        refreshOrderButton.disabled =
            true;

        const oldText =
            refreshOrderButton.textContent;

        refreshOrderButton.textContent =
            "Đang tải...";

        try {
            clearNewFlag(
                selectedTableNumber
            );

            clearPendingServerReload();

            await loadTableOrder(
                selectedTableNumber,
                {
                    silent:
                        true,

                    forceRender:
                        true,
                }
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
// INTERACTION LOCK
// ======================================================

async function withInteraction(callback) {
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
// HELPERS
// ======================================================

function formatCurrency(value) {
    const number =
        Number(value);

    if (
        Number.isNaN(number)
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


function escapeHtml(text) {
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


async function getApiError(response) {
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
            "Server trả về lỗi " +
            response.status
        );
    }
    catch {
        return (
            "Server trả về lỗi " +
            response.status
        );
    }
}