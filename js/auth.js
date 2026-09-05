import { supabase } from "./supabaseClient.js";

const form = document.getElementById("auth-form");
const modeToggle = document.getElementById("mode-toggle");
const submitBtn = document.getElementById("submit-btn");
const errorEl = document.getElementById("auth-error");
const titleEl = document.getElementById("auth-title");
const subtitleEl = document.getElementById("auth-subtitle");

let mode = "login"; // or "signup"

// If already logged in, skip straight to the dashboard
supabase.auth.getSession().then(({ data }) => {
    if (data.session) window.location.href = "dashboard.html";
});

function setMode(next) {
    mode = next;
    const isLogin = mode === "login";
    titleEl.textContent = isLogin ? "Welcome back" : "Create your account";
    subtitleEl.textContent = isLogin
        ? "Log in to keep your hydration streak going."
        : "Just an email and password — nothing else.";
    submitBtn.textContent = isLogin ? "Log in" : "Sign up";
    modeToggle.textContent = isLogin
        ? "Need an account? Sign up"
        : "Already have an account? Log in";
    errorEl.textContent = "";
}

modeToggle.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    submitBtn.disabled = true;
    submitBtn.textContent = "Please wait…";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } =
        mode === "login"
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });

    if (error) {
        errorEl.textContent = error.message;
        submitBtn.disabled = false;
        submitBtn.textContent = mode === "login" ? "Log in" : "Sign up";
        return;
    }

    if (mode === "signup") {
        errorEl.textContent = "Account created. Check your email to confirm, then log in.";
        errorEl.classList.remove("text-red-400");
        errorEl.classList.add("text-green-400");
        setMode("login");
        submitBtn.disabled = false;
        return;
    }

    window.location.href = "dashboard.html";
});

setMode("login");
