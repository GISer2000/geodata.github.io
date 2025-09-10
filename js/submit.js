// 信息提交反馈
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("contactForm");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);

        try {
            const response = await fetch(form.action, {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                showFeedback("✅ 消息已成功发送！请检查您的邮箱。", "success");
                form.reset();
            } else {
                showFeedback("❌ 消息发送失败，请稍后重试。", "error");
            }
        } catch (err) {
            console.error("提交错误:", err);
            showFeedback("⚠️ 网络错误，请检查您的连接。", "error");
        }
    });

    function showFeedback(message, type) {
        let feedbackBox = document.getElementById("feedbackMessage");

        if (!feedbackBox) {
            feedbackBox = document.createElement("div");
            feedbackBox.id = "feedbackMessage";
            feedbackBox.className = "mt-4 p-3 rounded-lg text-sm";
            form.parentNode.appendChild(feedbackBox);
        }

        feedbackBox.textContent = message;
        feedbackBox.className =
            type === "success"
                ? "mt-4 p-3 rounded-lg text-sm bg-green-100 text-green-700 border border-green-300"
                : "mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-700 border border-red-300";
    }
});
