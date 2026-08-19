// ======================================================
// CẤU HÌNH
// ======================================================

const API_BASE_URL = "http://127.0.0.1:8000";

const TOTAL_TABLES = 12;

// Kiểm tra server mỗi 1 giây.
// Có fetch nhưng CHỈ render nếu dữ liệu server thay đổi.
const AUTO_REFRESH_MS = 1000;


// ======================================================
// BIẾN TOÀN CỤC
// ======================================================

// Bàn hiện tại
let selectedTableNumber = null;

// Danh sách món server trả về gần nhất
let currentItems = [];

// Tránh request cũ ghi đè request mới
let tableOrderRequestId = 0;

// Kiểm tra trạng thái bàn đã khởi tạo chưa
let statusInitialized = false;

// Tránh polling chạy chồng nhau
let autoRefreshRunning = false;

// Khi đang PATCH / DELETE,
// tạm dừng polling
let interactionInProgress = false;


// ======================================================
// SNAPSHOT TRẠNG THÁI CÁC BÀN
// ======================================================

const tableSnapshots = new Map();


// Bàn nào có món mới thì lưu ở đây
const tableNewFlags = new Set();


// ======================================================
// SNAPSHOT DANH SÁCH MÓN
//
// Đây là phần QUAN TRỌNG.
//
// Lần fetch sau nếu snapshot giống lần trước:
//      => KHÔNG render.
// ======================================================

const previousServerSnapshots = new Map();


// ======================================================
// ROBOT DRAFT
//
// Giữ robot người dùng đang chọn
// trong lúc chưa bấm xác nhận.
// ======================================================

const robotDrafts = new Map();


// ======================================================
// EDIT STATE
//
// Dùng cho ghi chú + số lượng.
//
// itemId ->
//
// {
//     tableNumber,
//     foodName,
//     unitPrice,
//
//     originalQuantity,
//     originalNote,
//
//     quantity,
//     note,
//
//     dirty
// }
// ======================================================

const editStates = new Map();


// ======================================================
// ELEMENT
// ======================================================

const tablesContainer =
    document.getElementById(
        "tablesContainer"
    );

const selectedTableTitle =
    document.getElementById(
        "selectedTableTitle"
    );

const selectedTableDescription =
    document.getElementById(
        "selectedTableDescription"
    );

const emptySelection =
    document.getElementById(
        "emptySelection"
    );

const loadingBox =
    document.getElementById(
        "loadingBox"
    );

const orderContent =
    document.getElementById(
        "orderContent"
    );

const orderItems =
    document.getElementById(
        "orderItems"
    );

const noItemsMessage =
    document.getElementById(
        "noItemsMessage"
    );

const tableTotal =
    document.getElementById(
        "tableTotal"
    );

const payButton =
    document.getElementById(
        "payButton"
    );

const saveChangesButton =
    document.getElementById(
        "saveChangesButton"
    );

const refreshTablesButton =
    document.getElementById(
        "refreshTablesButton"
    );

const refreshOrderButton =
    document.getElementById(
        "refreshOrderButton"
    );


// ======================================================
// KHỞI ĐỘNG
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        // Tạo Bàn 1 -> 12
        createTableCards();


        // Lấy trạng thái ban đầu
        await refreshTableStatuses(
            true
        );


        // ==================================================
        // AUTO FETCH
        //
        // Vẫn fetch mỗi giây.
        //
        // Nhưng loadTableOrder() sẽ tự kiểm tra:
        //
        // server giống lần trước
        //          ↓
        // KHÔNG render.
        // ==================================================

        setInterval(
            autoRefreshDashboard,
            AUTO_REFRESH_MS
        );
    }
);


// ======================================================
// TẠO DANH SÁCH BÀN
// ======================================================

function createTableCards() {

    tablesContainer.innerHTML = "";


    for (
        let tableNumber = 1;
        tableNumber <= TOTAL_TABLES;
        tableNumber++
    ) {

        const tableCard =
            document.createElement(
                "button"
            );


        tableCard.type =
            "button";


        tableCard.className =
            "table-card";


        tableCard.dataset.tableNumber =
            tableNumber;


        tableCard.innerHTML = `

            <span
                class="table-new-badge hidden"
            >
                NEW
            </span>


            <span class="table-label">
                Bàn
            </span>


            <strong class="table-number">
                ${tableNumber}
            </strong>


            <span
                class="table-order-badge hidden"
            >
                0
            </span>
        `;


        // ==================================================
        // CLICK BÀN
        // ==================================================

        tableCard.addEventListener(
            "click",
            async () => {

                // Người quản lý đã xem bàn này
                clearNewFlag(
                    tableNumber
                );


                await selectTable(
                    tableNumber
                );
            }
        );


        tablesContainer.appendChild(
            tableCard
        );
    }
}


// ======================================================
// AUTO REFRESH
// ======================================================

async function autoRefreshDashboard() {

    // Nếu vòng polling trước vẫn chạy
    if (
        autoRefreshRunning
        ||
        interactionInProgress
    ) {

        return;
    }


    autoRefreshRunning =
        true;


    try {

        // ==================================================
        // 1. Kiểm tra số món của các bàn
        // ==================================================

        await refreshTableStatuses(
            false,
            true
        );


        // ==================================================
        // 2. Fetch bàn đang xem
        //
        // loadTableOrder() sẽ tự so sánh snapshot.
        //
        // Nếu server không đổi:
        //
        //      KHÔNG render.
        // ==================================================

        if (
            selectedTableNumber !==
            null
        ) {

            await loadTableOrder(
                selectedTableNumber,
                true,
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

        autoRefreshRunning =
            false;
    }
}


// ======================================================
// REFRESH TRẠNG THÁI TẤT CẢ CÁC BÀN
// ======================================================

async function refreshTableStatuses(
    initial = false,
    silent = false
) {

    if (
        !silent
        &&
        refreshTablesButton
    ) {

        refreshTablesButton.disabled =
            true;
    }


    try {

        // ==================================================
        // API STATUS NHẸ
        // ==================================================

        const response =
            await fetch(
                `${API_BASE_URL}/orders/tables/status`,
                {
                    method:
                        "GET",

                    cache:
                        "no-store"
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


        const statuses =
            Array.isArray(
                data.tables
            )
                ?
                data.tables
                :
                [];


        // ==================================================
        // CHUYỂN THÀNH MAP
        // ==================================================

        const statusMap =
            new Map(

                statuses.map(
                    item => [

                        Number(
                            item.table_number
                        ),

                        item
                    ]
                )
            );


        // ==================================================
        // UPDATE 12 BÀN
        // ==================================================

        for (
            let tableNumber = 1;
            tableNumber <= TOTAL_TABLES;
            tableNumber++
        ) {

            const status =
                statusMap.get(
                    tableNumber
                )
                ||
                {

                    table_number:
                        tableNumber,

                    item_count:
                        0,

                    max_item_id:
                        0
                };


            updateTableCardStatus(
                tableNumber,
                status,
                initial
            );
        }


        statusInitialized =
            true;
    }

    catch (error) {

        console.error(
            "Không thể lấy trạng thái bàn:",
            error
        );
    }

    finally {

        if (
            !silent
            &&
            refreshTablesButton
        ) {

            refreshTablesButton.disabled =
                false;
        }
    }
}


// ======================================================
// UPDATE CARD BÀN
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
            status.item_count
            ||
            0
        );


    const maxItemId =
        Number(
            status.max_item_id
            ||
            0
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
                previous.maxItemId
                ||
                0
            )
    ) {

        tableNewFlags.add(
            tableNumber
        );
    }


    // ==================================================
    // BÀN CÓ MÓN
    // ==================================================

    if (
        itemCount > 0
    ) {

        tableCard.classList.add(
            "has-order"
        );


        if (
            countBadge
        ) {

            countBadge.textContent =
                itemCount;


            countBadge.classList.remove(
                "hidden"
            );
        }
    }

    // ==================================================
    // KHÔNG CÓ MÓN
    // ==================================================

    else {

        tableCard.classList.remove(
            "has-order"
        );


        if (
            countBadge
        ) {

            countBadge.classList.add(
                "hidden"
            );
        }


        tableNewFlags.delete(
            tableNumber
        );
    }


    // ==================================================
    // NEW
    // ==================================================

    if (
        newBadge
    ) {

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
// XÓA NEW
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


    const newBadge =
        tableCard?.querySelector(
            ".table-new-badge"
        );


    newBadge?.classList.add(
        "hidden"
    );
}


// ======================================================
// CHỌN BÀN
// ======================================================

async function selectTable(
    tableNumber
) {

    selectedTableNumber =
        tableNumber;


    // ==================================================
    // BỎ SELECT BÀN CŨ
    // ==================================================

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


    // ==================================================
    // SELECT BÀN MỚI
    // ==================================================

    const selectedCard =
        document.querySelector(
            `.table-card[data-table-number="${tableNumber}"]`
        );


    selectedCard?.classList.add(
        "selected"
    );


    // ==================================================
    // TITLE
    // ==================================================

    selectedTableTitle.textContent =
        `Bàn ${tableNumber}`;


    selectedTableDescription.textContent =
        "Danh sách món của bàn";


    refreshOrderButton.disabled =
        false;


    // ==================================================
    // LOAD BÀN
    //
    // silent = false
    //
    // => luôn render khi người dùng
    // chủ động chọn bàn.
    // ==================================================

    await loadTableOrder(
        tableNumber,
        false,
        false
    );
}


// ======================================================
// TẠO SNAPSHOT DỮ LIỆU SERVER
//
// Chỉ lấy các field ảnh hưởng đến UI.
//
// KHÔNG lấy các field như:
// server_time,
// timestamp hiện tại...
//
// nếu các field đó thay đổi mỗi request.
// ======================================================

function createServerSnapshot(
    items
) {

    if (
        !Array.isArray(
            items
        )
    ) {

        return "[]";
    }


    const normalizedItems =
        items

            .map(
                item => ({

                    id:
                        Number(
                            item.id
                        ),

                    order_code:
                        String(
                            item.order_code
                            ??
                            ""
                        ),

                    table_number:
                        Number(
                            item.table_number
                            ||
                            0
                        ),

                    food_name:
                        String(
                            item.food_name
                            ??
                            ""
                        ),

                    quantity:
                        Number(
                            item.quantity
                            ||
                            0
                        ),

                    unit_price:
                        Number(
                            item.unit_price
                            ||
                            0
                        ),

                    note:
                        String(
                            item.note
                            ??
                            ""
                        ),

                    delivered:
                        item.delivered
                        ===
                        true,

                    cooking_status:
                        Number(
                            item.cooking_status
                            ??
                            0
                        ),

                    assigned_robot:
                        item.assigned_robot
                        ??
                        null,

                    robot_dispatched:
                        item.robot_dispatched
                        ===
                        true
                })
            )

            // Đảm bảo thứ tự luôn ổn định
            .sort(
                (
                    a,
                    b
                ) =>

                    a.id
                    -
                    b.id
            );


    return JSON.stringify(
        normalizedItems
    );
}


// ======================================================
// LOAD DANH SÁCH MÓN
//
// QUAN TRỌNG:
//
// Nếu silent = true:
//
//      fetch server
//          ↓
//      tạo snapshot
//          ↓
//      so với snapshot trước
//          ↓
//      giống nhau
//          ↓
//      RETURN
//
// KHÔNG render.
// ======================================================

async function loadTableOrder(
    tableNumber,
    silent = false,
    preserveEdits = false
) {

    const requestId =
        ++tableOrderRequestId;


    // ==================================================
    // LOADING
    // ==================================================

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

        // ==================================================
        // FETCH
        // ==================================================

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


        if (!response.ok) {

            throw new Error(
                await getApiError(
                    response
                )
            );
        }


        const data =
            await response.json();


        // ==================================================
        // REQUEST CŨ
        // ==================================================

        if (
            requestId !==
                tableOrderRequestId
            ||
            tableNumber !==
                selectedTableNumber
        ) {

            return;
        }


        // ==================================================
        // ITEMS MỚI
        // ==================================================

        const newItems =
            Array.isArray(
                data.items
            )
                ?
                data.items
                :
                [];


        // ==================================================
        // SNAPSHOT MỚI
        // ==================================================

        const newSnapshot =
            createServerSnapshot(
                newItems
            );


        // ==================================================
        // SNAPSHOT CŨ
        // ==================================================

        const previousSnapshot =
            previousServerSnapshots.get(
                tableNumber
            );


        // ==================================================
        // DỮ LIỆU KHÔNG THAY ĐỔI
        //
        // Đây chính là phần giúp input
        // ghi chú và robot không bị reset.
        // ==================================================

        if (
            silent
            &&
            previousSnapshot !==
                undefined
            &&
            previousSnapshot ===
                newSnapshot
        ) {

            // Có thể bỏ console.log
            // nếu không muốn Console nhiều thông tin.

            console.log(
                `Bàn ${tableNumber}: dữ liệu không đổi → không render`
            );


            return;
        }


        // ==================================================
        // SERVER ĐÃ THAY ĐỔI
        // ==================================================

        console.log(
            `Bàn ${tableNumber}: dữ liệu thay đổi → cập nhật`
        );


        // ==================================================
        // LƯU SNAPSHOT MỚI
        // ==================================================

        previousServerSnapshots.set(
            tableNumber,
            newSnapshot
        );


        // ==================================================
        // SO SÁNH ID TRƯỚC / SAU
        //
        // Dùng để biết có món mới/xóa món hay không.
        // ==================================================

        const oldIds =
            currentItems

                .map(
                    item =>
                        Number(
                            item.id
                        )
                )

                .sort(
                    (
                        a,
                        b
                    ) =>
                        a - b
                )

                .join(",");


        const newIds =
            newItems

                .map(
                    item =>
                        Number(
                            item.id
                        )
                )

                .sort(
                    (
                        a,
                        b
                    ) =>
                        a - b
                )

                .join(",");


        // ==================================================
        // CẬP NHẬT SERVER DATA
        // ==================================================

        currentItems =
            newItems;


        // ==================================================
        // EDIT STATE
        // ==================================================

        syncEditStates(
            currentItems
        );


        cleanupRobotDrafts(
            currentItems
        );


        // ==================================================
        // NẾU NGƯỜI DÙNG ĐANG SỬA GHI CHÚ
        // HOẶC SỐ LƯỢNG
        //
        // Và danh sách món không đổi,
        // không render toàn bộ bảng.
        //
        // Chỉ update:
        //
        // cooking
        // delivered
        // robot dispatch
        //
        // để không mất input đang nhập.
        // ==================================================

        if (
            preserveEdits
            &&
            hasPendingChanges()
            &&
            oldIds ===
                newIds
            &&
            orderItems.children.length ===
                currentItems.length
        ) {

            updateLiveStatusesOnly(
                currentItems
            );


            updateTotalFromDrafts();


            refreshActionButtons();


            loadingBox.classList.add(
                "hidden"
            );


            orderContent.classList.remove(
                "hidden"
            );


            return;
        }


        // ==================================================
        // DỮ LIỆU CÓ THAY ĐỔI THẬT
        //
        // => render.
        // ==================================================

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

        // ==================================================
        // REQUEST CŨ
        // ==================================================

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


            currentItems =
                [];


            orderItems.innerHTML =
                "";


            noItemsMessage.classList.remove(
                "hidden"
            );


            noItemsMessage.textContent =
                "Không thể tải dữ liệu từ server.";


            tableTotal.textContent =
                formatCurrency(
                    0
                );


            payButton.disabled =
                true;


            if (
                saveChangesButton
            ) {

                saveChangesButton.disabled =
                    true;
            }
        }


        console.error(
            "Lỗi loadTableOrder:",
            error
        );
    }
}


// ======================================================
// NORMALIZE NOTE
// ======================================================

function normalizeNote(
    note
) {

    return String(
        note
        ??
        ""
    );
}


// ======================================================
// ĐỒNG BỘ EDIT STATE
// ======================================================

function syncEditStates(
    items
) {

    // ID hiện tồn tại trên server
    const serverIds =
        new Set();


    for (
        const item
        of items
    ) {

        const itemId =
            Number(
                item.id
            );


        serverIds.add(
            itemId
        );


        const serverQuantity =
            Number(
                item.quantity
            );


        const serverNote =
            normalizeNote(
                item.note
            );


        const existing =
            editStates.get(
                itemId
            );


        // ==================================================
        // CHƯA CÓ STATE
        // ==================================================

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
                        false
                }
            );


            continue;
        }


        // ==================================================
        // UPDATE THÔNG TIN CƠ BẢN
        // ==================================================

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


        // ==================================================
        // NẾU USER KHÔNG SỬA
        //
        // mới đồng bộ server.
        //
        // Nếu dirty = true:
        //
        // giữ dữ liệu người dùng đang nhập.
        // ==================================================

        if (
            !existing.dirty
        ) {

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


    // ==================================================
    // XÓA STATE CỦA MÓN KHÔNG CÒN TRÊN SERVER
    // ==================================================

    for (
        const [
            itemId,
            state
        ]
        of editStates.entries()
    ) {

        // Chỉ xét bàn đang mở
        if (
            Number(
                state.tableNumber
            )
            !==
            Number(
                selectedTableNumber
            )
        ) {

            continue;
        }


        if (
            !serverIds.has(
                Number(
                    itemId
                )
            )
        ) {

            editStates.delete(
                itemId
            );
        }
    }
}


// ======================================================
// GET EDIT STATE
// ======================================================

function getEditState(
    item
) {

    const itemId =
        Number(
            item.id
        );


    if (
        !editStates.has(
            itemId
        )
    ) {

        syncEditStates(
            [
                item
            ]
        );
    }


    return editStates.get(
        itemId
    );
}


// ======================================================
// UPDATE DIRTY
// ======================================================

function updateDirtyState(
    state
) {

    state.dirty =

        Number(
            state.quantity
        )
        !==
        Number(
            state.originalQuantity
        )

        ||

        normalizeNote(
            state.note
        )
        !==
        normalizeNote(
            state.originalNote
        );
}


// ======================================================
// CÓ THAY ĐỔI CHƯA LƯU?
// ======================================================

function hasPendingChanges() {

    return currentItems.some(
        item => {

            const state =
                editStates.get(
                    Number(
                        item.id
                    )
                );


            return (
                state?.dirty ===
                true
            );
        }
    );
}


// ======================================================
// LẤY DANH SÁCH THAY ĐỔI
// ======================================================

function getPendingChanges() {

    return currentItems

        .map(
            item => {

                const state =
                    editStates.get(
                        Number(
                            item.id
                        )
                    );


                if (
                    !state
                    ||
                    !state.dirty
                ) {

                    return null;
                }


                return {

                    id:
                        Number(
                            item.id
                        ),

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
                        )
                };
            }
        )

        .filter(
            Boolean
        );
}


// ======================================================
// RENDER DANH SÁCH MÓN
// ======================================================

function renderOrderItems(
    items
) {

    orderItems.innerHTML =
        "";


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
            formatCurrency(
                0
            );


        payButton.disabled =
            true;


        if (
            saveChangesButton
        ) {

            saveChangesButton.disabled =
                true;
        }


        return;
    }


    // ==================================================
    // CÓ MÓN
    // ==================================================

    noItemsMessage.classList.add(
        "hidden"
    );


    // ==================================================
    // DUYỆT TỪNG MÓN
    // ==================================================

    for (
        const item
        of items
    ) {

        const itemId =
            Number(
                item.id
            );


        const state =
            getEditState(
                item
            );


        const quantity =
            Number(
                state.quantity
            );


        const unitPrice =
            Number(
                item.unit_price
            );


        const itemTotal =
            quantity
            *
            unitPrice;


        // ==================================================
        // COOKING
        // ==================================================

        const cookingStatus =
            Number(
                item.cooking_status
                ??
                0
            );


        const cookingInfo =
            getCookingInfo(
                cookingStatus
            );


        // ==================================================
        // DELIVERED
        // ==================================================

        const delivered =
            item.delivered ===
            true;


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


        // ==================================================
        // ROBOT
        // ==================================================

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


        // ==================================================
        // GIỮ ROBOT USER ĐANG CHỌN
        // ==================================================

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


        // ==================================================
        // CHỈ ENABLE XÁC NHẬN SAU 5 GIÂY
        // ==================================================

        const dispatchDisabled =
            cookingStatus < 1;


        // ==================================================
        // ROW
        // ==================================================

        const row =
            document.createElement(
                "div"
            );


        row.className =
            "order-item-row";


        row.dataset.itemId =
            itemId;


        if (
            state.dirty
        ) {

            row.classList.add(
                "dirty-row"
            );
        }


        // quantity = 0
        // sẽ xóa khi Update
        if (
            quantity === 0
        ) {

            row.classList.add(
                "marked-for-delete"
            );
        }


        // ==================================================
        // HTML
        // ==================================================

        row.innerHTML = `

            <!-- ==============================
                 MÓN ĂN
            =============================== -->

            <div class="food-name">

                <span class="mobile-label">
                    Món:
                </span>

                <strong>
                    ${escapeHtml(item.food_name)}
                </strong>

            </div>


            <!-- ==============================
                 GHI CHÚ
            =============================== -->

            <div class="food-note-editor">

                <span class="mobile-label">
                    Ghi chú:
                </span>

                <input

                    type="text"

                    class="note-input ${
                        state.note !==
                        state.originalNote

                            ?

                            "changed"

                            :

                            ""
                    }"

                    data-item-id="${itemId}"

                    maxlength="500"

                    value="${escapeHtml(state.note)}"

                    placeholder="Nhập ghi chú..."
                >

            </div>


            <!-- ==============================
                 SỐ LƯỢNG
            =============================== -->

            <div class="quantity-manager">

                <span class="mobile-label">
                    Số lượng:
                </span>


                <button

                    type="button"

                    class="quantity-minus"

                    data-item-id="${itemId}"

                    ${
                        quantity <= 0

                            ?

                            "disabled"

                            :

                            ""
                    }

                >
                    -
                </button>


                <span

                    class="quantity-value ${
                        quantity === 0

                            ?

                            "zero-quantity"

                            :

                            ""
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


            <!-- ==============================
                 ĐƠN GIÁ
            =============================== -->

            <div class="unit-price">

                <span class="mobile-label">
                    Đơn giá:
                </span>

                ${formatCurrency(unitPrice)}

            </div>


            <!-- ==============================
                 THÀNH TIỀN
            =============================== -->

            <div class="item-total">

                <span class="mobile-label">
                    Thành tiền:
                </span>

                <strong>
                    ${formatCurrency(itemTotal)}
                </strong>

            </div>


            <!-- ==============================
                 ĐÃ NẤU
            =============================== -->

            <div class="cooking-status">

                <span class="mobile-label">
                    Đã nấu:
                </span>

                <span
                    class="${cookingInfo.className}"
                    title="${cookingInfo.title}"
                >
                    ✓
                </span>

            </div>


            <!-- ==============================
                 ĐÃ GIAO
            =============================== -->

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


            <!-- ==============================
                 ROBOT
            =============================== -->

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


            <!-- ==============================
                 CHUYỂN GIAO
            =============================== -->

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


    // ==================================================
    // TỔNG TIỀN
    // ==================================================

    updateTotalFromDrafts();


    // ==================================================
    // UPDATE BUTTON
    // ==================================================

    refreshActionButtons();
}


// ======================================================
// TRẠNG THÁI NẤU
// ======================================================

function getCookingInfo(
    cookingStatus
) {

    // ==================================================
    // 5 -> 10 GIÂY
    // ==================================================

    if (
        cookingStatus === 1
    ) {

        return {

            className:
                "cooking-indicator cooking",

            title:
                "Đang nấu"
        };
    }


    // ==================================================
    // >= 10 GIÂY
    // ==================================================

    if (
        cookingStatus >= 2
    ) {

        return {

            className:
                "cooking-indicator cooked",

            title:
                "Đã nấu xong"
        };
    }


    // ==================================================
    // 0 -> 5 GIÂY
    // ==================================================

    return {

        className:
            "cooking-indicator waiting",

        title:
            "Chưa bắt đầu nấu"
    };
}


// ======================================================
// UPDATE CHỈ TRẠNG THÁI LIVE
//
// Dùng khi user đang sửa ghi chú/số lượng.
//
// KHÔNG innerHTML.
// ======================================================

function updateLiveStatusesOnly(
    items
) {

    for (
        const item
        of items
    ) {

        const itemId =
            Number(
                item.id
            );


        const row =
            orderItems.querySelector(
                `.order-item-row[data-item-id="${itemId}"]`
            );


        if (!row) {

            continue;
        }


        // ==================================================
        // COOKING
        // ==================================================

        const cookingStatus =
            Number(
                item.cooking_status
                ??
                0
            );


        const cookingInfo =
            getCookingInfo(
                cookingStatus
            );


        const cookingIndicator =
            row.querySelector(
                ".cooking-indicator"
            );


        if (
            cookingIndicator
        ) {

            cookingIndicator.className =
                cookingInfo.className;


            cookingIndicator.title =
                cookingInfo.title;
        }


        // ==================================================
        // DELIVERED
        // ==================================================

        const delivered =
            item.delivered ===
            true;


        const deliveredButton =
            row.querySelector(
                ".delivered-button"
            );


        if (
            deliveredButton
        ) {

            deliveredButton.dataset.delivered =
                String(
                    delivered
                );


            deliveredButton.classList.toggle(
                "delivered",
                delivered
            );


            deliveredButton.title =
                delivered

                    ?

                    "Đã giao - bấm để chuyển thành chưa giao"

                    :

                    "Chưa giao - bấm để đánh dấu đã giao";
        }


        // ==================================================
        // ROBOT
        // ==================================================

        const robotSelect =
            row.querySelector(
                ".robot-select"
            );


        const dispatchButton =
            row.querySelector(
                ".robot-dispatch-button"
            );


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


        const robotDispatched =
            item.robot_dispatched ===
            true;


        // Nếu đã dispatch thành công
        if (
            robotDispatched
            &&
            (
                databaseRobot === 1
                ||
                databaseRobot === 2
            )
        ) {

            if (
                robotSelect
            ) {

                robotSelect.value =
                    String(
                        databaseRobot
                    );
            }


            if (
                dispatchButton
            ) {

                dispatchButton.classList.add(
                    "dispatched"
                );


                dispatchButton.textContent =
                    `✓ Robot ${databaseRobot}`;


                dispatchButton.disabled =
                    false;
            }


            robotDrafts.delete(
                itemId
            );
        }

        // Chưa dispatch
        else {

            if (
                dispatchButton
            ) {

                dispatchButton.classList.remove(
                    "dispatched"
                );


                dispatchButton.textContent =
                    "Xác nhận";


                dispatchButton.disabled =
                    cookingStatus < 1;


                dispatchButton.title =

                    cookingStatus < 1

                        ?

                        "Chờ đủ 5 giây để món bắt đầu nấu"

                        :

                        "Xác nhận chuyển món cho robot";
            }
        }
    }
}


// ======================================================
// USER NHẬP GHI CHÚ
//
// Chỉ sửa local.
//
// KHÔNG gửi DB ngay.
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


        // ==================================================
        // UPDATE LOCAL STATE
        // ==================================================

        state.note =
            noteInput.value;


        updateDirtyState(
            state
        );


        // ==================================================
        // STYLE INPUT
        // ==================================================

        noteInput.classList.toggle(
            "changed",

            state.note !==
                state.originalNote
        );


        // ==================================================
        // STYLE ROW
        // ==================================================

        const row =
            noteInput.closest(
                ".order-item-row"
            );


        row?.classList.toggle(
            "dirty-row",
            state.dirty
        );


        // ==================================================
        // UPDATE BUTTON
        // ==================================================

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
        // NÚT -
        // ==================================================

        const quantityMinus =
            event.target.closest(
                ".quantity-minus"
            );


        if (
            quantityMinus
        ) {

            changeQuantityDraft(

                Number(
                    quantityMinus.dataset.itemId
                ),

                -1
            );


            return;
        }


        // ==================================================
        // NÚT +
        // ==================================================

        const quantityPlus =
            event.target.closest(
                ".quantity-plus"
            );


        if (
            quantityPlus
        ) {

            changeQuantityDraft(

                Number(
                    quantityPlus.dataset.itemId
                ),

                +1
            );


            return;
        }


        // ==================================================
        // ĐÃ GIAO
        // ==================================================

        const deliveredButton =
            event.target.closest(
                ".delivered-button"
            );


        if (
            deliveredButton
        ) {

            const itemId =
                Number(
                    deliveredButton.dataset.itemId
                );


            const currentDelivered =
                deliveredButton.dataset.delivered
                ===
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


        if (
            robotDispatchButton
        ) {

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


            if (!robotSelect) {

                return;
            }


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


            return;
        }
    }
);


// ======================================================
// +/- SỐ LƯỢNG LOCAL
//
// 1 -> 0 được phép.
//
// Chỉ disable - khi = 0.
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
            currentQuantity
            +
            delta
        );


    if (
        newQuantity ===
        currentQuantity
    ) {

        return;
    }


    // ==================================================
    // UPDATE LOCAL
    // ==================================================

    state.quantity =
        newQuantity;


    updateDirtyState(
        state
    );


    // ==================================================
    // RENDER LOCAL
    //
    // Đây là render vì chính USER vừa click +/-.
    //
    // Không phải auto-refresh.
    // ==================================================

    renderOrderItems(
        currentItems
    );
}


// ======================================================
// SELECT ROBOT
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


        // ==================================================
        // LƯU LOCAL
        // ==================================================

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
// CLEAN ROBOT DRAFT
// ======================================================

function cleanupRobotDrafts(
    items
) {

    const currentIds =
        new Set(

            items.map(
                item =>
                    Number(
                        item.id
                    )
            )
        );


    for (
        const itemId
        of robotDrafts.keys()
    ) {

        if (
            !currentIds.has(
                Number(
                    itemId
                )
            )
        ) {

            robotDrafts.delete(
                itemId
            );
        }
    }
}


// ======================================================
// TỔNG TIỀN THEO LOCAL QUANTITY
// ======================================================

function updateTotalFromDrafts() {

    let total =
        0;


    for (
        const item
        of currentItems
    ) {

        const state =
            getEditState(
                item
            );


        const quantity =
            Number(
                state.quantity
            );


        const price =
            Number(
                item.unit_price
            );


        total +=
            quantity
            *
            price;
    }


    tableTotal.textContent =
        formatCurrency(
            total
        );
}


// ======================================================
// UPDATE TRẠNG THÁI NÚT
// ======================================================

function refreshActionButtons() {

    const hasItems =
        currentItems.length > 0;


    const dirty =
        hasPendingChanges();


    // ==================================================
    // UPDATE
    // ==================================================

    if (
        saveChangesButton
    ) {

        saveChangesButton.disabled =
            !dirty;
    }


    // ==================================================
    // THANH TOÁN
    //
    // Nếu đang có thay đổi chưa Update
    // thì chưa cho thanh toán.
    // ==================================================

    payButton.disabled =
        !hasItems
        ||
        dirty;


    payButton.title =

        dirty

            ?

            "Hãy bấm Update để lưu thay đổi trước khi thanh toán"

            :

            "Thanh toán";
}


// ======================================================
// NÚT UPDATE
// ======================================================

if (
    saveChangesButton
) {

    saveChangesButton.addEventListener(
        "click",
        async () => {


            if (
                selectedTableNumber ===
                null
            ) {

                return;
            }


            // ==================================================
            // LẤY THAY ĐỔI
            // ==================================================

            const changes =
                getPendingChanges();


            if (
                changes.length ===
                0
            ) {

                saveChangesButton.disabled =
                    true;


                return;
            }


            // ==================================================
            // CONFIRM
            // ==================================================

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

                        // ==========================================
                        // PATCH UPDATE NHIỀU MÓN
                        // ==========================================

                        const response =
                            await fetch(

                                `${API_BASE_URL}/orders/table/${selectedTableNumber}/items`,

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

                                                items:
                                                    changes.map(
                                                        change => ({

                                                            id:
                                                                change.id,

                                                            quantity:
                                                                change.quantity,

                                                            note:
                                                                change.note
                                                        })
                                                    )
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


                        const result =
                            await response.json();


                        // ==========================================
                        // XÓA EDIT STATE CŨ
                        // ==========================================

                        for (
                            const change
                            of changes
                        ) {

                            editStates.delete(
                                change.id
                            );


                            if (
                                change.quantity ===
                                0
                            ) {

                                robotDrafts.delete(
                                    change.id
                                );
                            }
                        }


                        // ==========================================
                        // QUAN TRỌNG
                        //
                        // Sau PATCH database thay đổi.
                        //
                        // Xóa snapshot để lần GET sau
                        // chắc chắn render dữ liệu chuẩn.
                        // ==========================================

                        previousServerSnapshots.delete(
                            selectedTableNumber
                        );


                        // ==========================================
                        // GET LẠI DB
                        // ==========================================

                        await loadTableOrder(
                            selectedTableNumber,
                            true,
                            false
                        );


                        await refreshTableStatuses(
                            false,
                            true
                        );


                        // ==========================================
                        // MESSAGE
                        // ==========================================

                        const messages =
                            [
                                "Cập nhật thành công!"
                            ];


                        if (
                            Number(
                                result.updated_items
                                ||
                                0
                            )
                            >
                            0
                        ) {

                            messages.push(

                                `Đã cập nhật: ${result.updated_items} món.`

                            );
                        }


                        if (
                            Number(
                                result.deleted_items
                                ||
                                0
                            )
                            >
                            0
                        ) {

                            messages.push(

                                `Đã xóa: ${result.deleted_items} món có số lượng bằng 0.`

                            );
                        }


                        alert(
                            messages.join(
                                "\n"
                            )
                        );
                    }

                    catch (error) {

                        console.error(
                            "Lỗi Update:",
                            error
                        );


                        alert(

                            "Không thể cập nhật đơn hàng.\n"

                            +

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
}


// ======================================================
// CONFIRM UPDATE
// ======================================================

function buildUpdateConfirmation(
    changes
) {

    const lines =
        [

            `XÁC NHẬN CẬP NHẬT BÀN ${selectedTableNumber}`,

            "",

            "Thông tin trước và sau thay đổi:"
        ];


    changes.forEach(
        (
            change,
            index
        ) => {


            lines.push(
                ""
            );


            lines.push(
                `${index + 1}. ${change.foodName}`
            );


            // ==================================================
            // QUANTITY
            // ==================================================

            if (
                change.originalQuantity
                !==
                change.quantity
            ) {

                lines.push(

                    `   Số lượng: ${change.originalQuantity} → ${change.quantity}`

                );
            }


            // ==================================================
            // NOTE
            // ==================================================

            if (
                change.originalNote
                !==
                change.note
            ) {

                lines.push(

                    `   Ghi chú: ${displayNote(change.originalNote)} → ${displayNote(change.note)}`

                );
            }


            // ==================================================
            // DELETE
            // ==================================================

            if (
                change.quantity ===
                0
            ) {

                lines.push(

                    "   ⚠ Số lượng = 0: món này sẽ bị XÓA."

                );
            }
        }
    );


    lines.push(
        ""
    );


    lines.push(
        "Bấm OK để lưu thay đổi."
    );


    return lines.join(
        "\n"
    );
}


// ======================================================
// FORMAT NOTE TRONG CONFIRM
// ======================================================

function displayNote(
    note
) {

    const value =
        normalizeNote(
            note
        )
        .trim();


    if (
        value === ""
    ) {

        return "(trống)";
    }


    return `"${value}"`;
}


// ======================================================
// KHÓA AUTO POLLING TRONG LÚC API ACTION
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
// CHUYỂN ROBOT
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


        robotDrafts.delete(
            itemId
        );


        // ==================================================
        // DATABASE VỪA THAY ĐỔI
        //
        // Xóa snapshot để GET kế tiếp render.
        // ==================================================

        previousServerSnapshots.delete(
            selectedTableNumber
        );


        await loadTableOrder(
            selectedTableNumber,
            true,
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
// TOGGLE ĐÃ GIAO
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


        // ==================================================
        // DATABASE VỪA THAY ĐỔI
        // ==================================================

        previousServerSnapshots.delete(
            selectedTableNumber
        );


        await loadTableOrder(
            selectedTableNumber,
            true,
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


        // ==================================================
        // CHƯA UPDATE
        // ==================================================

        if (
            hasPendingChanges()
        ) {

            alert(

                "Bạn đang có thay đổi chưa lưu.\n\n"
                +
                "Hãy bấm Update trước khi thanh toán."

            );


            return;
        }


        // ==================================================
        // KHÔNG CÓ MÓN
        // ==================================================

        if (
            currentItems.length ===
            0
        ) {

            alert(
                "Bàn này không có món để thanh toán."
            );


            return;
        }


        // ==================================================
        // FORCE FETCH
        //
        // Xóa snapshot để đảm bảo lấy
        // dữ liệu mới nhất trước thanh toán.
        // ==================================================

        previousServerSnapshots.delete(
            selectedTableNumber
        );


        await loadTableOrder(
            selectedTableNumber,
            true,
            false
        );


        // ==================================================
        // CHƯA NẤU
        // ==================================================

        const notCooked =
            currentItems.filter(
                item =>

                    Number(
                        item.cooking_status
                        ??
                        0
                    )
                    <
                    2
            );


        // ==================================================
        // CHƯA GIAO
        // ==================================================

        const notDelivered =
            currentItems.filter(
                item =>

                    item.delivered !==
                    true
            );


        // ==================================================
        // CẢNH BÁO
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

                warnings.join(
                    "\n"
                )

                +

                "\n\nHãy kiểm tra đồ trước khi thanh toán."

            );


            return;
        }


        // ==================================================
        // CONFIRM
        // ==================================================

        const confirmed =
            confirm(

                `Tất cả món đã nấu và đã giao.\n\n`

                +

                `Xác nhận thanh toán Bàn ${selectedTableNumber}?\n`

                +

                `Tổng tiền: ${tableTotal.textContent}\n\n`

                +

                `Sau khi xác nhận, toàn bộ món của bàn sẽ bị xóa.`

            );


        if (
            !confirmed
        ) {

            return;
        }


        // ==================================================
        // DELETE
        // ==================================================

        await withInteraction(
            async () => {


                payButton.disabled =
                    true;


                const oldText =
                    payButton.textContent;


                payButton.textContent =
                    "Đang thanh toán...";


                try {

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


                    // ==================================================
                    // THÔNG BÁO
                    // ==================================================

                    alert(

                        "Thanh toán thành công!\n"

                        +

                        `Bàn: ${selectedTableNumber}\n`

                        +

                        `Tổng tiền: ${formatCurrency(result.total)}\n`

                        +

                        `Đã xóa ${result.deleted_items} món.`

                    );


                    // ==================================================
                    // XÓA NEW
                    // ==================================================

                    clearNewFlag(
                        selectedTableNumber
                    );


                    // ==================================================
                    // XÓA LOCAL STATE
                    // ==================================================

                    for (
                        const item
                        of currentItems
                    ) {

                        const itemId =
                            Number(
                                item.id
                            );


                        editStates.delete(
                            itemId
                        );


                        robotDrafts.delete(
                            itemId
                        );
                    }


                    // ==================================================
                    // XÓA SNAPSHOT
                    // ==================================================

                    previousServerSnapshots.delete(
                        selectedTableNumber
                    );


                    // ==================================================
                    // LOAD LẠI
                    // ==================================================

                    await loadTableOrder(
                        selectedTableNumber,
                        true,
                        false
                    );


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
                        oldText;


                    refreshActionButtons();
                }
            }
        );
    }
);


// ======================================================
// NÚT LÀM MỚI DANH SÁCH BÀN
// ======================================================

refreshTablesButton.addEventListener(
    "click",
    async () => {


        await refreshTableStatuses(
            false,
            false
        );


        if (
            selectedTableNumber !==
            null
        ) {

            // ==================================================
            // USER CHỦ ĐỘNG LÀM MỚI
            //
            // Force render.
            // ==================================================

            previousServerSnapshots.delete(
                selectedTableNumber
            );


            await loadTableOrder(
                selectedTableNumber,
                true,
                false
            );
        }
    }
);


// ======================================================
// NÚT CẬP NHẬT Ở HEADER
//
// Đây là refresh server,
// KHÔNG PHẢI nút Update thay đổi món.
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

            // ==================================================
            // FORCE RELOAD
            // ==================================================

            previousServerSnapshots.delete(
                selectedTableNumber
            );


            await loadTableOrder(
                selectedTableNumber,
                true,
                false
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
// ESCAPE HTML
// ======================================================

function escapeHtml(
    text
) {

    return String(
        text
        ??
        ""
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


        // ==================================================
        // DETAIL STRING
        // ==================================================

        if (
            typeof data.detail ===
            "string"
        ) {

            return data.detail;
        }


        // ==================================================
        // FASTAPI VALIDATION ERROR
        // ==================================================

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