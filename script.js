const form = document.querySelector("#login-form");
const username = document.querySelector("#username");
const password = document.querySelector("#password");
const message = document.querySelector("#form-message");

function clearMessage() {
  message.textContent = "";
  message.classList.remove("form-message--error", "form-message--info");
  username.removeAttribute("aria-invalid");
  password.removeAttribute("aria-invalid");
}

function showMessage(text, kind) {
  message.textContent = text;
  message.classList.add(`form-message--${kind}`);
}

username.addEventListener("input", clearMessage);
password.addEventListener("input", clearMessage);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearMessage();

  if (!username.value.trim()) {
    username.setAttribute("aria-invalid", "true");
    showMessage("أدخل اسم المستخدم أولاً.", "error");
    username.focus();
    return;
  }

  if (!password.value) {
    password.setAttribute("aria-invalid", "true");
    showMessage("أدخل كلمة السر أولاً.", "error");
    password.focus();
    return;
  }

  showMessage(
    "هذه واجهة تجريبية فقط؛ تسجيل الدخول غير مفعّل، ولم تُرسل بياناتك أو تُتحقق منها.",
    "info",
  );
});
