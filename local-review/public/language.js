(function () {
  'use strict';
  const dictionary = Object.fromEntries(`
Download LaTeX template|Tải mẫu LaTeX
Choices blocks automatically create multiple-choice questions. Use CorrectChoice for the answer. Questions without choices become reasoning.|Khối choices tự động tạo câu hỏi trắc nghiệm. Dùng CorrectChoice để đánh dấu đáp án đúng. Câu hỏi không có choices sẽ là câu tự luận.
Some multiple-choice questions need exactly one correct answer. Select it before publishing.|Một số câu trắc nghiệm cần đúng một đáp án đúng. Hãy chọn trước khi giao bài.
Cancel publication|Hủy giao bài
Republish assignment|Giao lại bài
Publication cancelled. Student work is preserved.|Đã hủy giao bài. Bài làm của học sinh được giữ lại.
Hide this assignment from students? Submitted work and grades will be preserved.|Ẩn bài tập này khỏi học sinh? Bài làm và điểm số sẽ được giữ lại.
Publication cancelled. Submitted work is preserved; this paper is locked against edits.|Đã hủy giao bài. Bài làm được giữ lại; đề đã khóa chỉnh sửa.
Overview|Tổng quan
Mathroom · Phase 4 review|Mathroom · Bản dùng thử giai đoạn 4
Lessons and notes saved on this computer.|Buổi học và ghi chú được lưu trên máy tính này.
Username:|Tên đăng nhập:
PHASE 4|GIAI ĐOẠN 4
Local review · papers, accounts, and lessons save on this computer|Dùng thử tại máy · đề, tài khoản và buổi học được lưu trên máy tính này
Accounts, chapters, and lessons save on this computer. Hosting and access from other devices are configured before the real-use trial.|Tài khoản, chương học và buổi học được lưu trên máy tính này. Truy cập từ thiết bị khác sẽ được thiết lập trước khi dùng thực tế.
Unable to change password. Try again.|Không thể đổi mật khẩu. Vui lòng thử lại.
Use 3–32 letters, numbers, dots, underscores, or hyphens.|Sử dụng 3–32 chữ cái, chữ số, dấu chấm, gạch dưới hoặc gạch ngang.
Enter a student name (up to 80 characters).|Nhập tên học sinh (tối đa 80 ký tự).
Student not found.|Không tìm thấy học sinh.
Unable to reset password.|Không thể đặt lại mật khẩu.
Enter a valid name and access setting.|Nhập tên và thiết lập quyền truy cập hợp lệ.
Enter an assignment title (up to 160 characters).|Nhập tiêu đề bài tập (tối đa 160 ký tự).
Add 1–100 questions.|Thêm từ 1 đến 100 câu hỏi.
Every question needs text (up to 10,000 characters).|Mỗi câu hỏi cần có nội dung (tối đa 10.000 ký tự).
Choose a supported question type.|Chọn dạng câu hỏi được hỗ trợ.
Question points must be greater than 0 and no more than 100.|Điểm mỗi câu phải lớn hơn 0 và không quá 100.
Multiple choice needs 2–6 options.|Câu trắc nghiệm cần từ 2 đến 6 lựa chọn.
Every multiple-choice question needs distinct options and a correct answer.|Mỗi câu trắc nghiệm cần các lựa chọn khác nhau và một đáp án đúng.
Choose an existing chapter.|Chọn một chương học đã có.
Choose assigned students.|Chọn học sinh nhận bài.
Choose available active students.|Chọn học sinh đang hoạt động.
Choose a valid deadline.|Chọn hạn nộp hợp lệ.
Choose a chapter, at least one student, and a deadline before publishing.|Chọn chương, ít nhất một học sinh và hạn nộp trước khi giao bài.
Upload limit is 20 MB.|Giới hạn tải lên là 20 MB.
Invalid filename.|Tên tệp không hợp lệ.
Image not found.|Không tìm thấy hình ảnh.
Assignment not found.|Không tìm thấy bài tập.
Return this assignment to draft before editing.|Chuyển bài tập về bản nháp trước khi chỉnh sửa.
Resolve the question preview errors before publishing.|Sửa lỗi xem trước câu hỏi trước khi giao bài.
Photo not found.|Không tìm thấy ảnh.
Choose a reasoning question.|Chọn câu tự luận.
Score must be between zero and the available points.|Điểm phải nằm trong khoảng từ 0 đến điểm tối đa của câu.
Feedback must be at most 5,000 characters.|Nhận xét không được quá 5.000 ký tự.
Only students can submit work.|Chỉ học sinh được nộp bài.
Upload photos using the file picker.|Tải ảnh lên bằng nút chọn tệp.
Total upload limit is 20 MB.|Tổng dung lượng tải lên tối đa là 20 MB.
Invalid photo upload.|Ảnh tải lên không hợp lệ.
Choose 1–8 photos.|Chọn từ 1 đến 8 ảnh.
Each photo must be under 8 MB.|Mỗi ảnh phải nhỏ hơn 8 MB.
Only PNG, JPEG and WebP photos are supported.|Chỉ hỗ trợ ảnh PNG, JPEG và WebP.
Answer every multiple-choice question.|Trả lời đầy đủ các câu trắc nghiệm.
Choose one valid answer for every question.|Chọn một đáp án hợp lệ cho mỗi câu.
This paper has no reasoning questions.|Đề này không có câu tự luận.
Choose a student and chapter.|Chọn học sinh và chương học.
Choose an active student enrolled in this chapter.|Chọn học sinh đang hoạt động thuộc chương học này.
Choose a valid lesson date and time.|Chọn ngày và giờ học hợp lệ.
Duration must be 15–240 minutes.|Thời lượng phải từ 15 đến 240 phút.
Choose a valid lesson status.|Chọn trạng thái buổi học hợp lệ.
Choose a valid performance.|Chọn mức đánh giá học tập hợp lệ.
Chapter number must be between 1 and 9999.|Số chương phải từ 1 đến 9999.
Choose students for this chapter.|Chọn học sinh cho chương học này.
One of the selected students does not exist.|Một học sinh được chọn không tồn tại.
That chapter number already exists.|Số chương này đã tồn tại.
Chapter not found.|Không tìm thấy chương học.
Keep students who already have lessons in this chapter.|Giữ lại học sinh đã có buổi học trong chương này.
Lesson not found.|Không tìm thấy buổi học.
Send JSON.|Yêu cầu phải ở định dạng JSON.
Request too large.|Yêu cầu vượt quá dung lượng cho phép.
Send a JSON object.|Gửi yêu cầu JSON hợp lệ.
Method not allowed.|Thao tác không được hỗ trợ.
Request verification failed.|Không thể xác minh yêu cầu.
Assignments|Bài tập
Progress|Tiến bộ
Students|Học sinh
Chapters|Chương học
Calendar|Lịch học
Settings|Cài đặt
Editor|Soạn bài
Work|Làm bài
Tutor|Gia sư
Student|Học sinh
Tutor workspace|Không gian gia sư
Student workspace|Không gian học sinh
A LITTLE PROGRESS, EVERY LESSON|TIẾN BỘ QUA TỪNG BUỔI HỌC
Your teaching, in one place|Quản lý việc dạy học tại một nơi
Your chapters. Your progress.|Chương học và sự tiến bộ của em.
Sign in|Đăng nhập
Sign out|Đăng xuất
Email or username|Email hoặc tên đăng nhập
Username|Tên đăng nhập
Password|Mật khẩu
Temporary password|Mật khẩu tạm thời
New password|Mật khẩu mới
Current password|Mật khẩu hiện tại
Confirm password|Xác nhận mật khẩu
Confirm new password|Xác nhận mật khẩu mới
Welcome back.|Chào mừng trở lại.
Choose your own password.|Đặt mật khẩu của em.
Replace the temporary password your tutor gave you.|Thay mật khẩu tạm thời do gia sư cung cấp.
Sign in to your personal learning workspace.|Đăng nhập vào không gian học tập của bạn.
Save password & continue|Lưu mật khẩu và tiếp tục
Use at least 10 characters.|Sử dụng ít nhất 10 ký tự.
Your tutor provides your username and password. Ask your tutor if you need a reset.|Gia sư cung cấp tên đăng nhập và mật khẩu. Liên hệ gia sư nếu cần đặt lại mật khẩu.
Tutor: sign in with your Supabase email and password. Students: use the login provided by your tutor.|Gia sư: đăng nhập bằng email và mật khẩu Supabase. Học sinh: sử dụng tài khoản do gia sư cung cấp.
☀ Light mode|☀ Giao diện sáng
☾ Dark mode|☾ Giao diện tối
Dark mode|Giao diện tối
Switch to light mode|Chuyển sang giao diện sáng
Switch to dark mode|Chuyển sang giao diện tối
Close dialog|Đóng hộp thoại
Save|Lưu
Cancel|Hủy
Open|Mở
Edit|Chỉnh sửa
Remove|Xóa
Move up|Chuyển lên
Today|Hôm nay
Status|Trạng thái
Account|Tài khoản
Active|Đang hoạt động
Disabled|Đã vô hiệu hóa
Ready|Sẵn sàng
Password change due|Cần đổi mật khẩu
Manage →|Quản lý →
A clear view of their progress.|Theo dõi rõ sự tiến bộ của học sinh.
Active students|Học sinh đang học
Up to 10 students|Tối đa 10 học sinh
Organized your way|Sắp xếp theo cách của bạn
Upcoming lessons|Buổi học sắp tới
Individual sessions|Buổi học cá nhân
Your students|Học sinh của bạn
Personal accounts for individual learning.|Tài khoản riêng cho từng học sinh.
+ Add student|+ Thêm học sinh
Add a student|Thêm học sinh
Your chapters|Các chương học
View chapters →|Xem chương học →
Begin with a chapter|Bắt đầu với một chương học
Choose its number, title, and students.|Chọn số chương, tiêu đề và học sinh.
Create chapter|Tạo chương học
Coming up|Sắp tới
Calendar →|Lịch học →
YOUR NEXT REVIEW|CHUẨN BỊ BUỔI HỌC TIẾP THEO
Prepare your next assignment.|Chuẩn bị bài tập tiếp theo.
Upload a paper, review equations and images, choose question types, and publish it to your students.|Tải đề lên, kiểm tra công thức và hình ảnh, chọn dạng câu hỏi rồi giao bài cho học sinh.
Account & appearance →|Tài khoản và giao diện →
Your lessons and tutor feedback, all in one place.|Buổi học và nhận xét của gia sư, tại cùng một nơi.
Assigned by your tutor|Do gia sư giao
Your individual sessions|Buổi học cá nhân của em
Lessons completed|Buổi học đã hoàn thành
Every lesson is a step forward|Mỗi buổi học là một bước tiến
Your next lessons|Buổi học tiếp theo
Recent feedback|Nhận xét gần đây
Your tutor’s lesson comments will appear here.|Nhận xét của gia sư về buổi học sẽ xuất hiện tại đây.
Your tutor will assign your first chapter.|Gia sư sẽ giao chương học đầu tiên cho em.
A space for your learning.|Không gian học tập của em.
Your lesson summaries and comments are private to you and your tutor.|Nội dung buổi học và nhận xét chỉ hiển thị cho em và gia sư.
Open Assignments to submit your work, or Progress to see chapter averages.|Mở Bài tập để nộp bài, hoặc Tiến bộ để xem điểm trung bình theo chương.
Your first student starts here.|Thêm học sinh đầu tiên tại đây.
Create their username and temporary password, then share it with them.|Tạo tên đăng nhập và mật khẩu tạm thời, rồi gửi cho học sinh.
Create accounts, manage access, and reset passwords.|Tạo tài khoản, quản lý quyền truy cập và đặt lại mật khẩu.
You share each student’s username and temporary password yourself. Students choose a new password at first sign-in.|Bạn tự gửi tên đăng nhập và mật khẩu tạm thời cho học sinh. Học sinh đổi mật khẩu khi đăng nhập lần đầu.
Chapters, at your pace.|Chương học theo tiến độ của bạn.
Choose the number and title. Add as many individual lessons as needed.|Chọn số chương và tiêu đề. Thêm các buổi học cá nhân theo nhu cầu.
Your tutor organizes your lessons into chapters.|Gia sư sắp xếp các buổi học theo chương.
+ New chapter|+ Chương học mới
A new chapter in your learning.|Một chương học mới trong hành trình học tập.
View lessons|Xem buổi học
+ Lesson|+ Buổi học
No chapters yet.|Chưa có chương học.
Create your first chapter and assign students.|Tạo chương học đầu tiên và chọn học sinh.
Your tutor will add your chapters here.|Gia sư sẽ thêm chương học tại đây.
Nothing scheduled here.|Chưa có lịch học.
Your next individual lesson will appear here.|Buổi học cá nhân tiếp theo sẽ xuất hiện tại đây.
Study calendar|Lịch học
All lesson times and deadlines use Bangkok time (UTC+7).|Giờ học và hạn nộp sử dụng múi giờ UTC+7 (giống giờ Việt Nam).
+ Schedule lesson|+ Lên lịch học
All students|Tất cả học sinh
Filter student|Lọc học sinh
+ Lesson on this day|+ Thêm buổi học ngày này
Due|Hạn nộp
Account & appearance|Tài khoản và giao diện
Make your workspace comfortable.|Tùy chỉnh không gian học tập.
Appearance|Giao diện
Your choice is remembered in this browser.|Lựa chọn được lưu trên trình duyệt này.
Your account|Tài khoản của bạn
Change password|Đổi mật khẩu
This review version|Phiên bản dùng thử
Your account, chapters and work are stored in the hosted workspace.|Tài khoản, chương học và bài làm được lưu trên hệ thống trực tuyến.
Import your paper, prepare questions, then publish.|Nhập đề, chuẩn bị câu hỏi rồi giao bài.
Papers assigned to you by your tutor.|Bài tập gia sư giao cho em.
+ New assignment|+ Bài tập mới
Upload LaTeX|Tải đề LaTeX lên
No deadline yet|Chưa có hạn nộp
Do assignment|Làm bài
No assignments yet.|Chưa có bài tập.
Upload a .tex file or a ZIP containing your paper and images.|Tải tệp .tex hoặc ZIP chứa đề và hình ảnh lên.
Your tutor will publish assignments here.|Gia sư sẽ giao bài tập tại đây.
Submit your answers and view tutor feedback.|Nộp bài và xem nhận xét của gia sư.
Published · return to draft to make changes.|Đã giao · chuyển về bản nháp để chỉnh sửa.
Return to draft|Chuyển về bản nháp
Prepare your assignment|Soạn bài tập
Save to update the equation and image previews.|Lưu để cập nhật bản xem trước công thức và hình ảnh.
Assignment title|Tiêu đề bài tập
Chapter|Chương
Choose chapter|Chọn chương học
Deadline · Bangkok (UTC+7)|Hạn nộp · UTC+7
No active students yet. Add a student in the admin Students page.|Chưa có học sinh đang hoạt động. Thêm học sinh trong trang Học sinh của gia sư.
Choose who receives this assignment. Selected students are also added to the chosen chapter when you save. Only published assignments are visible to students.|Chọn học sinh nhận bài. Khi lưu, các em cũng được thêm vào chương đã chọn. Học sinh chỉ thấy bài tập đã giao.
Type|Dạng câu hỏi
Reasoning · photo upload|Tự luận · nộp ảnh bài làm
Multiple choice|Trắc nghiệm
Points|Điểm
Question text and LaTeX|Nội dung câu hỏi và LaTeX
Correct answer|Đáp án đúng
Choose correct answer|Chọn đáp án đúng
Students upload one shared set of photos for all reasoning questions. Two submissions maximum; the latest replaces the first.|Học sinh nộp chung ảnh cho toàn bộ câu tự luận. Tối đa hai lần nộp; lần sau thay thế lần đầu.
Last saved preview|Bản xem trước đã lưu
Save to render this question.|Lưu để hiển thị câu hỏi.
+ Add question|+ Thêm câu hỏi
Save & update preview|Lưu và cập nhật bản xem trước
Student preview|Xem trước giao diện học sinh
Publish assignment|Giao bài tập
Publishing requires a chapter, deadline, assigned students, valid equations/images, and complete answer keys. Late submissions are accepted and labelled.|Để giao bài cần có chương học, hạn nộp, học sinh, công thức/hình ảnh hợp lệ và đủ đáp án. Bài nộp muộn vẫn được nhận và đánh dấu.
Photo answer|Ảnh bài làm
Students can upload photos after publication.|Học sinh có thể tải ảnh lên sau khi bài được giao.
Import a LaTeX paper|Nhập đề LaTeX
Upload one .tex file, or a ZIP containing one .tex file and PNG, JPG, or WebP images.|Tải một tệp .tex hoặc ZIP chứa một tệp .tex và ảnh PNG, JPG hoặc WebP.
Drag your paper here|Kéo đề vào đây
or choose a file below · .tex or .zip · up to 20 MB|hoặc chọn tệp bên dưới · .tex hoặc .zip · tối đa 20 MB
Supported question lists: enumerate with item, or questions with question. Equations use standard math delimiters. Custom packages and macros are flagged for review.|Hỗ trợ danh sách enumerate với item, hoặc questions với question. Công thức dùng dấu phân cách toán học tiêu chuẩn. Gói và macro tùy chỉnh được đánh dấu để kiểm tra.
Student name|Tên học sinh
Account access|Quyền truy cập tài khoản
Disabling immediately signs the student out. Their chapters and notes are retained.|Vô hiệu hóa sẽ đăng xuất học sinh ngay. Chương học và ghi chú vẫn được giữ lại.
Share these credentials yourself. The student must change the password at first sign-in.|Bạn tự gửi thông tin đăng nhập. Học sinh phải đổi mật khẩu khi đăng nhập lần đầu.
Reset password|Đặt lại mật khẩu
Save changes|Lưu thay đổi
Create student|Tạo học sinh
This signs the student out and requires a password change at their next sign-in.|Thao tác này đăng xuất học sinh và yêu cầu đổi mật khẩu khi đăng nhập lại.
New temporary password|Mật khẩu tạm thời mới
Edit chapter|Chỉnh sửa chương học
Create a chapter|Tạo chương học
Chapter number|Số chương
Title|Tiêu đề
Description (optional)|Mô tả (không bắt buộc)
Assign students|Chọn học sinh
Create student accounts first, or save the chapter and assign them later.|Tạo tài khoản học sinh trước, hoặc lưu chương và chọn học sinh sau.
+ Add lesson|+ Thêm buổi học
Edit lesson|Chỉnh sửa buổi học
Schedule an individual lesson|Lên lịch buổi học cá nhân
Only active students assigned to the selected chapter appear here.|Chỉ hiển thị học sinh đang hoạt động thuộc chương đã chọn.
Lesson title|Tiêu đề buổi học
Date & time · Bangkok (UTC+7)|Ngày và giờ · UTC+7
Duration in minutes|Thời lượng (phút)
Scheduled|Đã lên lịch
Completed|Đã hoàn thành
Cancelled|Đã hủy
scheduled|Đã lên lịch
completed|Đã hoàn thành
cancelled|Đã hủy
draft|Bản nháp
published|Đã giao
Student performance|Tình hình học tập
Not reviewed|Chưa nhận xét
Needs practice|Cần luyện tập thêm
Good progress|Tiến bộ tốt
Confident|Nắm vững kiến thức
What you covered|Nội dung đã học
Comment visible to the student|Nhận xét hiển thị cho học sinh
Save lesson|Lưu buổi học
Schedule lesson|Lên lịch học
What we covered|Nội dung đã học
Your tutor will add a summary after the lesson.|Gia sư sẽ bổ sung nội dung sau buổi học.
Tutor’s comment|Nhận xét của gia sư
No comment yet.|Chưa có nhận xét.
Edit lesson & feedback|Sửa buổi học và nhận xét
Change your password|Đổi mật khẩu
Test work submitted this day|Bài làm đã nộp trong ngày
Latest result|Kết quả mới nhất
Review work|Xem và chấm bài
No retained submissions on this date.|Không có bài nộp được lưu vào ngày này.
Part 1 · Multiple choice → Part 2 · Reasoning → Results|Phần 1 · Trắc nghiệm → Phần 2 · Tự luận → Kết quả
Work submitted|Đã nộp bài
Wait for A Tung review|Chờ anh Tùng chấm bài
Multiple-choice results|Kết quả trắc nghiệm
Your reasoning work|Bài làm tự luận
Replace reasoning work|Nộp lại bài tự luận
One replacement allowed. It deletes the previous photos and reasoning evaluations.|Được nộp lại một lần. Ảnh và nhận xét tự luận trước đó sẽ bị xóa.
Both reasoning submissions have been used.|Đã dùng hết hai lần nộp bài tự luận.
Part 1 · Multiple choice|Phần 1 · Trắc nghiệm
Complete every question, then continue to reasoning. Correct answers appear after you submit the whole assignment.|Trả lời đủ câu hỏi rồi chuyển sang tự luận. Đáp án đúng hiển thị sau khi nộp toàn bộ bài.
Continue to reasoning|Tiếp tục phần tự luận
Submit assignment|Nộp bài
Your choices are final when you continue.|Không thể đổi đáp án sau khi tiếp tục.
Part 2 · Reasoning|Phần 2 · Tự luận
Finish all the questions below on paper, then upload your work together once. You may include several photos for multiple pages.|Làm tất cả câu hỏi bên dưới trên giấy rồi tải chung bài làm lên một lần. Có thể nộp nhiều ảnh cho nhiều trang.
Upload all your reasoning work|Tải toàn bộ bài tự luận lên
Drop your photos here or choose files|Kéo ảnh vào đây hoặc chọn tệp
One upload for all questions · up to 8 photos · 8 MB each · 20 MB total|Nộp chung cho tất cả câu · tối đa 8 ảnh · 8 MB mỗi ảnh · tổng 20 MB
Cancel replacement|Hủy nộp lại
Submitted reasoning work|Bài tự luận đã nộp
Progress & marking|Tiến bộ và chấm bài
Your chapter progress|Tiến bộ theo chương
Chapter averages include fully graded assignments only. Each assignment has equal weight.|Điểm trung bình chương chỉ tính bài đã chấm xong. Mỗi bài có trọng số như nhau.
Chapter average graph. Details below.|Biểu đồ điểm trung bình theo chương. Chi tiết bên dưới.
No results yet|Chưa có kết quả
Published assignments will appear here.|Bài tập đã giao sẽ xuất hiện tại đây.
Reasoning submission · all questions|Bài nộp tự luận · tất cả câu hỏi
Not submitted|Chưa nộp
Student working|Bài làm của học sinh
Score|Điểm
Feedback visible to student|Nhận xét hiển thị cho học sinh
Save evaluation|Lưu đánh giá
Graded|Đã chấm
Missing work|Chưa nộp đủ bài
Awaiting marking|Chờ chấm bài
Late|Nộp muộn
Opening your workspace…|Đang mở không gian học tập…
Workspace unavailable|Không thể mở không gian học tập
Check your connection, then reload this page.|Kiểm tra kết nối rồi tải lại trang.
Try again|Thử lại
Private lessons, work and feedback.|Buổi học, bài làm và nhận xét riêng tư.
Mathroom · Hosted review|Mathroom · Bản dùng thử trực tuyến
HOSTED REVIEW|DÙNG THỬ TRỰC TUYẾN
Mathroom · your personal learning workspace|Mathroom · không gian học tập cá nhân
Times: Bangkok · UTC+7|Múi giờ: UTC+7 · giờ Việt Nam
MON|T2
TUE|T3
WED|T4
THU|T5
FRI|T6
SAT|T7
SUN|CN
Saving…|Đang lưu…
Saved.|Đã lưu.
Evaluation saved.|Đã lưu đánh giá.
Assignment submitted.|Đã nộp bài.
Multiple choice saved. Continue to reasoning.|Đã lưu trắc nghiệm. Tiếp tục phần tự luận.
Draft saved. Preview updated.|Đã lưu bản nháp và cập nhật bản xem trước.
Published to the assigned students.|Đã giao bài cho học sinh được chọn.
Your password has been changed.|Đã đổi mật khẩu.
Passwords do not match.|Mật khẩu không khớp.
Your session ended. Please sign in again.|Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.
Unable to reach the server.|Không thể kết nối đến máy chủ.
Request failed.|Yêu cầu không thành công.
Invalid email, username or password.|Email, tên đăng nhập hoặc mật khẩu không đúng.
Please sign in.|Vui lòng đăng nhập.
Too many attempts. Try again in 15 minutes.|Thử quá nhiều lần. Vui lòng thử lại sau 15 phút.
Change your temporary password first.|Vui lòng đổi mật khẩu tạm thời trước.
Current password is incorrect.|Mật khẩu hiện tại không đúng.
Use a password of 10–128 characters.|Sử dụng mật khẩu từ 10 đến 128 ký tự.
Choose a different password.|Vui lòng chọn mật khẩu khác.
Tutor access required.|Chỉ gia sư được thực hiện thao tác này.
Create a chapter and assign a student first.|Tạo chương học và chọn học sinh trước.
Answer every multiple-choice question first.|Trả lời đầy đủ câu trắc nghiệm trước.
Choose at least one photo first.|Chọn ít nhất một ảnh trước.
Leave with unsent answers? Opening another paper discards this draft.|Rời trang khi chưa nộp bài? Mở đề khác sẽ xóa bản nháp này.
Leave without saving your changes?|Rời trang mà không lưu thay đổi?
Discard unsent answers and open this paper?|Bỏ câu trả lời chưa nộp và mở đề này?
Submit your final multiple-choice answers? You have one attempt.|Chốt đáp án trắc nghiệm? Em chỉ có một lần nộp.
Replace your first photos and evaluation permanently? This is your final submission.|Xóa và thay thế ảnh cùng đánh giá lần đầu? Đây là lần nộp cuối.
Choose up to 8 PNG, JPEG or WebP photos, under 8 MB each and 20 MB total.|Chọn tối đa 8 ảnh PNG, JPEG hoặc WebP, dưới 8 MB mỗi ảnh và tổng 20 MB.
Drop one .tex file or one ZIP containing your paper and images.|Kéo một tệp .tex hoặc ZIP chứa đề và hình ảnh vào đây.
Choose a .tex file or a .zip archive.|Chọn tệp .tex hoặc .zip.
Choose a file no larger than 20 MB.|Chọn tệp không quá 20 MB.
Paper imported as a draft. Review every question before publishing.|Đã nhập đề dưới dạng bản nháp. Kiểm tra từng câu trước khi giao bài.
Drop your paper inside the upload area.|Kéo đề vào trong vùng tải lên.
Open Assignments → Upload LaTeX, then drop your paper into the upload area.|Mở Bài tập → Tải đề LaTeX lên, rồi kéo đề vào vùng tải lên.
Student created. Share their credentials yourself.|Đã tạo học sinh. Bạn tự gửi thông tin đăng nhập cho học sinh.
Password reset. Share the new temporary password yourself.|Đã đặt lại mật khẩu. Bạn tự gửi mật khẩu tạm thời mới.
Answers selected here are for preview only and are not saved.|Đáp án chọn ở đây chỉ để xem trước và không được lưu.
Unable to complete this request. Please try again.|Không thể hoàn tất yêu cầu. Vui lòng thử lại.
This record conflicts with existing data.|Thông tin này xung đột với dữ liệu hiện có.
Unable to create account. Check whether this username already exists in Supabase.|Không thể tạo tài khoản. Kiểm tra tên đăng nhập đã tồn tại trong Supabase hay chưa.
Username already used.|Tên đăng nhập đã được sử dụng.
The workspace supports 10 active students.|Hệ thống hỗ trợ tối đa 10 học sinh đang hoạt động.
This time overlaps another individual lesson.|Thời gian này trùng với một buổi học khác.
Multiple-choice answers have already been submitted.|Đáp án trắc nghiệm đã được nộp.
Two submissions have already been used.|Đã dùng hết hai lần nộp bài.
Complete multiple choice first.|Hoàn thành trắc nghiệm trước.
This submission changed. Reload before marking.|Bài nộp đã thay đổi. Tải lại trước khi chấm.
Submission changed. Reload before uploading again.|Bài nộp đã thay đổi. Tải lại trước khi nộp tiếp.
Students have submitted work. This paper is locked to protect their results. Create a new assignment for changes.|Học sinh đã nộp bài. Đề được khóa để bảo vệ kết quả. Tạo bài tập mới nếu cần thay đổi.
`.trim().split('\n').map(line=>line.split('|')));
  let language;try{language=localStorage.getItem('mathroom-language')}catch{}
  if(!['en','vi'].includes(language))language='en';
  const sourceNodes=new WeakMap(),sourceAttributes=new WeakMap();
  const protectedSelector='[translate="no"], [data-user-content], .paper-content, .katex, .option, input, textarea, script, style, [data-language-switch], #student-filter option, #progress-student option, #lesson-student option, select[name=chapter_id] option:not([value=""]), select[name=chapterId] option';
  function translate(value){
    if(language!=='vi')return value;
    const raw=String(value),s=raw.trim(),space=raw.match(/^\s*/)[0],tail=raw.match(/\s*$/)[0];
    if(!s)return raw;
    let out=dictionary[s];
    if(out===undefined){
      out=s;
      const exact=[[/^Welcome back, (.+)\.$/,'Chào mừng trở lại, $1.'],[/^Manage (.+)$/,'Quản lý $1'],[/^Reset (.+)’s password$/,'Đặt lại mật khẩu cho $1'],[/^Student preview: (.+)$/,'Xem trước: $1'],[/^Importing (.+)…$/,'Đang nhập $1…']];
      for(const [pattern,replacement]of exact)if(pattern.test(out))return space+out.replace(pattern,replacement)+tail;
      // Only UI phrases and numeric templates; arbitrary user text is protected in the DOM.
      out=out.replace(/^(Tutor|Student) \/ (Overview|Assignments|Progress|Students|Chapters|Calendar|Settings|Editor|Work)$/,(m,a,b)=>dictionary[a]+' / '+dictionary[b]);
      const pieces={'Chapter ':'Chương ','Question ':'Câu ','Option ':'Lựa chọn ','Ch ':'Ch ','Page ':'Trang ','Draft page ':'Trang nháp ','Final result: ':'Kết quả cuối: ','Your answer: ':'Đáp án của em: ','Correct answer: ':'Đáp án đúng: ','Submission ':'Lần nộp ',' of 2':' / 2',' · Answer ':' · Đáp án đã chọn ',' · Correct ':' · Đáp án đúng ',' percentage points':' điểm phần trăm',' assignments with missing work':' bài chưa nộp đủ',' awaiting marking':' bài chờ chấm',' questions':' câu hỏi',' points':' điểm',' students':' học sinh',' lessons':' buổi học',' minutes':' phút',' min':' phút',' available':' học sinh có thể chọn',' more':' mục khác',' (disabled)':' (đã vô hiệu hóa)',' · Late':' · Nộp muộn','Assign students · ':'Chọn học sinh · ',' · Your tutor workspace':' · Không gian gia sư','Due: ':'Hạn nộp: ','Due ':'Hạn nộp ',' · Due ':' · Hạn nộp ',' Bangkok':' UTC+7'};
      for(const [en,vi]of Object.entries(pieces))out=out.split(en).join(vi);
      const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const days={Mon:'Thứ Hai',Tue:'Thứ Ba',Wed:'Thứ Tư',Thu:'Thứ Năm',Fri:'Thứ Sáu',Sat:'Thứ Bảy',Sun:'Chủ nhật'};
      out=out.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})\b/g,(m,d,mo,n)=>days[d]+', '+n+'/'+(months.indexOf(mo)+1));
      out=out.replace(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/,(m,mo,n)=>n+'/'+(months.indexOf(mo)+1));
      out=out.replace(/^(\d{4}-\d{2}-\d{2}), (\d+) buổi học and (\d+) deadlines$/,'$1, $2 buổi học và $3 hạn nộp');
      out=out.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g,(m,d,n,mo)=>({Mon:'Thứ Hai',Tue:'Thứ Ba',Wed:'Thứ Tư',Thu:'Thứ Năm',Fri:'Thứ Sáu',Sat:'Thứ Bảy',Sun:'Chủ nhật'}[d])+', '+n+'/'+(months.indexOf(mo)+1));
      out=out.replace(/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/,(m,mo,y)=>'Tháng '+(['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(mo)+1)+' năm '+y);
    }
    return space+out+tail;
  }
  function apply(root=document.body){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){
      if(node.parentElement?.closest(protectedSelector))continue;
      let entry=sourceNodes.get(node);if(!entry||node.nodeValue!==entry.output)entry={source:node.nodeValue};
      entry.output=translate(entry.source);if(node.nodeValue!==entry.output)node.nodeValue=entry.output;sourceNodes.set(node,entry);
    }
    root.querySelectorAll('[aria-label],[alt]').forEach(el=>{
      if(el.closest(protectedSelector))return;const record=sourceAttributes.get(el)||{};
      for(const attr of ['aria-label','alt'])if(el.hasAttribute(attr)){let e=record[attr];if(!e||el.getAttribute(attr)!==e.output)e={source:el.getAttribute(attr)};e.output=translate(e.source);if(el.getAttribute(attr)!==e.output)el.setAttribute(attr,e.output);record[attr]=e}sourceAttributes.set(el,record);
    });
    document.documentElement.lang=language;
    document.title=language==='vi'?'Mathroom · Không gian học tập':'Mathroom · Your teaching workspace';
    document.querySelectorAll('[data-language-switch]').forEach(el=>{el.value=language});
  }
  let observer;
  function refresh(){observer?.disconnect();apply();observer?.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','alt']})}
  function setLanguage(value){if(!['en','vi'].includes(value))return;language=value;try{localStorage.setItem('mathroom-language',value)}catch{}refresh()}
  window.mathroomLanguage={translate,set:setLanguage,get:()=>language,refresh};
  document.addEventListener('change',event=>{if(event.target.matches('[data-language-switch]'))setLanguage(event.target.value)});
  document.addEventListener('DOMContentLoaded',()=>{observer=new MutationObserver(refresh);refresh()});
})();
