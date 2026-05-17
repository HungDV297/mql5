# Feedback Và Câu Chuyện Khách Hàng Mẫu

> Ghi chú: các câu chuyện dưới đây là mẫu biên tập dựa trên nhóm khách hàng và feedback đang có trên website. Khi dùng public, nên thay bằng case thật hoặc xin phép khách trước khi nêu tên/hình ảnh.

## Feedback ngắn có thể dùng trên landing page

### Mr.Long - Trader full-time

"Phần học này giúp tôi hiểu rõ hơn về bot và tự tay xây dựng được một hệ thống giao dịch theo phong cách của riêng mình. Giá trị lớn nhất không chỉ là code chạy được, mà là biết bot đang chạy theo rule nào."

### Mr.Khắc Anh - Chuyên gia trade bot

"Tôi được hệ thống lại kiến thức bot từ cơ bản đến nâng cao. Phần hữu ích nhất là cách đọc logic, debug và kiểm chứng trước khi tin vào kết quả backtest."

### Mr.Phước - IB pro

"Tôi hiểu hơn về cách vận hành bot và áp dụng khi làm việc với khách hàng. Trước đây tôi nhìn bot như công cụ vào lệnh, sau buổi học tôi nhìn nó như một hệ thống cần rule, risk và log rõ ràng."

## Câu chuyện khách hàng mẫu 1 - Trader có chiến lược nhưng chưa biết code

### Bối cảnh

Khách đã trade thủ công hơn 2 năm, có một setup vào lệnh theo nến và vùng giá nhưng mô tả còn nhiều chữ "nhìn bối cảnh", "nếu thấy đẹp" và "tùy thị trường".

### Điểm nghẽn

- Không biết chuyển setup thủ công thành điều kiện đo được.
- Dùng AI sinh code nhưng kết quả mỗi lần một kiểu.
- Không biết lỗi nằm ở prompt, code hay chính rule chưa rõ.

### Cách xử lý trong coaching

- Viết lại setup thành checklist vào lệnh, thoát lệnh và điều kiện không trade.
- Tách rule thành từng hàm MQL5 nhỏ để dễ đọc và dễ test.
- Thêm log để biết vì sao bot vào lệnh hoặc bỏ qua tín hiệu.

### Kết quả có thể truyền thông

Khách có bản EA đầu tiên đi theo đúng checklist của mình, hiểu được luồng xử lý chính và biết cách sửa rule thay vì chỉ copy code.

## Câu chuyện khách hàng mẫu 2 - Người đã có EA nhưng chưa tin backtest

### Bối cảnh

Khách đã mua hoặc thuê viết EA, backtest có giai đoạn equity tăng đẹp nhưng khi chạy demo thì kết quả lệch nhiều.

### Điểm nghẽn

- Chưa kiểm tra spread, slippage, commission và chất lượng dữ liệu.
- Không có log giải thích từng lệnh.
- Risk/lệnh và điều kiện dừng còn xử lý thủ công.

### Cách xử lý trong coaching

- Đọc lại report, soi giai đoạn thắng/thua bất thường.
- Bổ sung log cho tín hiệu, order và lỗi giao dịch.
- Thiết kế lại risk engine: giới hạn lot, daily loss và điều kiện dừng.

### Kết quả có thể truyền thông

Khách không còn nhìn backtest như lời hứa lợi nhuận, mà dùng nó như công cụ kiểm chứng giả thuyết trước khi forward test.

## Câu chuyện khách hàng mẫu 3 - Trader part-time muốn bớt thao tác tay

### Bối cảnh

Khách có công việc chính, không thể ngồi chart cả ngày nhưng vẫn muốn giữ kỷ luật vào/thoát lệnh.

### Điểm nghẽn

- Hay bỏ lỡ tín hiệu hoặc vào lệnh muộn.
- Muốn bot hỗ trợ nhưng sợ mất kiểm soát.
- Chưa có quy trình review định kỳ.

### Cách xử lý trong coaching

- Chọn phần nên tự động hóa trước: alert, lọc tín hiệu hoặc quản lý lệnh.
- Giữ các quyết định rủi ro quan trọng ở mức rõ ràng, có điều kiện dừng.
- Thiết lập workflow demo/forward test và ghi log.

### Kết quả có thể truyền thông

Khách có quy trình vận hành nhẹ hơn, giảm thao tác lặp lại nhưng vẫn hiểu bot đang làm gì và khi nào phải can thiệp.

## Câu hỏi nên dùng để thu thập case thật

- Trước khi học, bạn đang trade theo rule nào?
- Bạn đã có EA/backtest/log chưa?
- Phần nào làm bạn kẹt nhất: rule, code, risk, dữ liệu hay vận hành?
- Sau quá trình làm việc, điều gì thay đổi rõ nhất trong cách bạn nhìn bot?
- Bạn có đồng ý cho dùng feedback/câu chuyện của mình trên website không?
