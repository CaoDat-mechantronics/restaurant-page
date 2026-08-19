// =============================================
// CẤU HÌNH
// =============================================
// SỐ BÀN MẶC ĐỊNH
//
// Muốn đổi sang bàn khác
// chỉ cần sửa số ở đây.
//
// Ví dụ:
// const DEFAULT_TABLE_NUMBER = 5;
//
const DEFAULT_TABLE_NUMBER = 10;
// =============================================
// LẤY CÁC PHẦN TỬ HTML
// =============================================
// Lấy tất cả món ăn
const foodCards =
    document.querySelectorAll(
        ".food-card"
    );
// Khung danh sách món đã chọn
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
// HIỂN THỊ SỐ BÀN
// =============================================
// Gán giá trị mặc định vào input
tableNumberInput.value =
    DEFAULT_TABLE_NUMBER;
// =============================================
// XỬ LÝ TỪNG MÓN ĂN
// =============================================
foodCards.forEach((card) => {
    // Checkbox
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
    // KHI CHỌN / BỎ CHỌN MÓN
    // =========================================
    checkbox.addEventListener(
        "change",
        () => {
            // Đổi trạng thái card
            updateCardSelectedState(
                card
            );
            // Cập nhật đơn hàng
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
            // Nếu lỗi
            if (
                isNaN(
                    currentQuantity
                )
            ) {
                currentQuantity = 1;
            }
            // Không cho nhỏ hơn 1
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
            // Không cho số lượng dưới 1
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
    // KHI NHẬP GHI CHÚ
    // =========================================
    if (noteInput) {
        noteInput.addEventListener(
            "input",
            () => {
                // Cập nhật ngay phần đơn hàng
                updateOrderSummary();
            }
        );
    }
});
// =============================================
// ĐỔI TRẠNG THÁI CARD
// =============================================
function updateCardSelectedState(
    card
) {
    const checkbox =
        card.querySelector(
            ".food-checkbox"
        );
    // Nếu món được chọn
    if (
        checkbox.checked
    ) {
        card.classList.add(
            "selected"
        );
    } else {
        card.classList.remove(
            "selected"
        );
    }
}
// =============================================
// CẬP NHẬT ĐƠN HÀNG
// =============================================
function updateOrderSummary() {
    // Tổng tiền
    let total = 0;
    // HTML danh sách món
    let selectedItemsHtml = "";
    // =========================================
    // DUYỆT TẤT CẢ MÓN
    // =========================================
    foodCards.forEach(
        (card) => {
            // Checkbox
            const checkbox =
                card.querySelector(
                    ".food-checkbox"
                );
            // Số lượng
            const quantityInput =
                card.querySelector(
                    ".quantity-input"
                );
            // Ghi chú
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
                isNaN(quantity)
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
                    noteInput.value.trim();
            }
            // =================================
            // NẾU MÓN ĐƯỢC CHỌN
            // =================================
            if (
                checkbox.checked
            ) {
                // Thành tiền
                const itemTotal =
                    foodPrice
                    *
                    quantity;
                // Cộng tổng
                total +=
                    itemTotal;
                // =================================
                // HIỂN THỊ GHI CHÚ
                // =================================
                let noteText = "";
                // Chỉ hiện dấu ()
                // nếu thực sự có ghi chú
                if (
                    note !== ""
                ) {
                    noteText =
                        ` (${escapeHtml(note)})`;
                }
                // =================================
                // TẠO HTML
                // =================================
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
    // NẾU CHƯA CHỌN MÓN
    // =========================================
    if (
        selectedItemsHtml === ""
    ) {
        selectedItemsBox.innerHTML =
            "Chưa chọn món nào.";
    } else {
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
        value.toLocaleString(
            "vi-VN"
        )
        +
        " VNĐ"
    );
}
// =============================================
// CHỐNG CHÈN HTML TRONG GHI CHÚ
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
// =============================================
// KHI BẤM NÚT ĐẶT MÓN
// =============================================
orderButton.addEventListener("click", async () => {
    // =========================================
    // 1. LẤY SỐ BÀN
    // =========================================
    const tableNumber =
        parseInt(tableNumberInput.value);
    // Kiểm tra số bàn
    if (
        isNaN(tableNumber)
        ||
        tableNumber <= 0
    ) {
        alert("Số bàn không hợp lệ.");
        return;
    }
    // =========================================
    // 2. LẤY DANH SÁCH MÓN ĐÃ CHỌN
    // =========================================
    const selectedFoods = [];
    foodCards.forEach((card) => {
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
        // =====================================
        // CHỈ LẤY MÓN ĐƯỢC CHECK
        // =====================================
        if (checkbox.checked) {
            const quantity =
                parseInt(
                    quantityInput.value
                );
            const price =
                parseInt(
                    card.dataset.price
                );
            selectedFoods.push({
                // Tên món
                name:
                    card.dataset.name,
                // Giá món
                price:
                    price,
                // Số lượng
                quantity:
                    quantity,
                // Ghi chú
                note:
                    noteInput
                        ? noteInput.value.trim()
                        : ""
            });
        }
    });
    // =========================================
    // 3. KIỂM TRA ĐÃ CHỌN MÓN CHƯA
    // =========================================
    if (selectedFoods.length === 0) {
        alert(
            "Bạn chưa chọn món nào."
        );
        return;
    }
    // =========================================
    // 4. TẠO JSON GỬI CHO FASTAPI
    // =========================================
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
    // =========================================
    // 5. KHÓA NÚT TRÁNH BẤM 2 LẦN
    // =========================================
    orderButton.disabled =
        true;
    orderButton.innerText =
        "Đang đặt món...";
    // =========================================
    // 6. GỌI FASTAPI
    // =========================================
    try {
        const response =
            await fetch(
                "http://127.0.0.1:8000/orders",
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
        // =====================================
        // 7. ĐỌC DỮ LIỆU SERVER TRẢ VỀ
        // =====================================
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
        // =====================================
        // 8. SERVER BÁO LỖI
        // =====================================
        if (!response.ok) {
            console.error(
                "Đặt món lỗi:",
                result
            );
            // FastAPI thường trả lỗi trong detail
            let errorMessage =
                "Đặt món thất bại.";
            if (result.detail) {
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
        // =====================================
        // 9. THÀNH CÔNG
        // =====================================
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
        // =====================================
        // 10. RESET CÁC MÓN
        // =====================================
        foodCards.forEach((card) => {
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
            // Bỏ chọn món
            checkbox.checked =
                false;
            // Quantity về 1
            quantityInput.value =
                1;
            // Xóa ghi chú
            if (noteInput) {
                noteInput.value =
                    "";
            }
            // Xóa viền selected
            card.classList.remove(
                "selected"
            );
        });
        // =====================================
        // 11. CẬP NHẬT DANH SÁCH ĐƠN
        // =====================================
        updateOrderSummary();
    }
    catch (error) {
        // =====================================
        // 12. KHÔNG KẾT NỐI ĐƯỢC FASTAPI
        // =====================================
        console.error(
            "Lỗi kết nối FastAPI:",
            error
        );
        alert(
            "Không kết nối được tới FastAPI.\n"
            +
            "Kiểm tra server http://127.0.0.1:8000"
        );
    }
    finally {
        // =====================================
        // 13. MỞ LẠI NÚT
        // =====================================
        orderButton.disabled =
            false;
        orderButton.innerText =
            "Đặt món";
    }
});