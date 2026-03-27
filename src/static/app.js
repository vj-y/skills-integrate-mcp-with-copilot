// ── Auth helpers ──────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem("teacher_token"); }
function getUsername() { return localStorage.getItem("teacher_username"); }
function isTeacher() { return !!getToken(); }

function updateAuthUI() {
  const authBtn = document.getElementById("auth-btn");
  const loggedInUser = document.getElementById("logged-in-user");
  const signupContainer = document.getElementById("signup-container");

  if (isTeacher()) {
    loggedInUser.textContent = `👤 ${getUsername()}`;
    loggedInUser.classList.remove("hidden");
    authBtn.textContent = "Logout";
    authBtn.onclick = handleLogout;
    if (signupContainer) signupContainer.classList.remove("hidden");
  } else {
    loggedInUser.classList.add("hidden");
    authBtn.textContent = "🔑 Teacher Login";
    authBtn.onclick = openLoginModal;
    if (signupContainer) signupContainer.classList.add("hidden");
  }
}

function openLoginModal() {
  document.getElementById("login-modal").classList.remove("hidden");
  document.getElementById("login-username").focus();
}

function closeLoginModal() {
  document.getElementById("login-modal").classList.add("hidden");
  document.getElementById("login-form").reset();
  document.getElementById("login-error").classList.add("hidden");
}

async function handleLogout() {
  const token = getToken();
  if (token) {
    await fetch("/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  localStorage.removeItem("teacher_token");
  localStorage.removeItem("teacher_username");
  updateAuthUI();
  fetchActivities();
}

// ── Fetch and render activities (global so logout can call it) ────────────────
async function fetchActivities() {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  try {
    const response = await fetch("/activities");
    const activities = await response.json();

    activitiesList.innerHTML = "";
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

    Object.entries(activities).forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft = details.max_participants - details.participants.length;

      const participantsHTML =
        details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li>
                        <span class="participant-email">${email}</span>
                        ${isTeacher()
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""}
                      </li>`
                  )
                  .join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

      activityCard.innerHTML = `
        <h4>${name}</h4>
        <p>${details.description}</p>
        <p><strong>Schedule:</strong> ${details.schedule}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-container">
          ${participantsHTML}
        </div>
      `;

      activitiesList.appendChild(activityCard);

      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      activitySelect.appendChild(option);
    });

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });
  } catch (error) {
    activitiesList.innerHTML =
      "<p>Failed to load activities. Please try again later.</p>";
    console.error("Error fetching activities:", error);
  }
}

// ── Unregister (global so fetchActivities can attach it) ─────────────────────
async function handleUnregister(event) {
  const button = event.target;
  const activity = button.getAttribute("data-activity");
  const email = button.getAttribute("data-email");
  const messageDiv = document.getElementById("message");

  try {
    const response = await fetch(
      `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      }
    );

    const result = await response.json();
    messageDiv.textContent = response.ok
      ? result.message
      : result.detail || "An error occurred";
    messageDiv.className = response.ok ? "success" : "error";
    messageDiv.classList.remove("hidden");
    if (response.ok) fetchActivities();
  } catch (error) {
    messageDiv.textContent = "Failed to unregister. Please try again.";
    messageDiv.className = "error";
    messageDiv.classList.remove("hidden");
  }

  setTimeout(() => document.getElementById("message").classList.add("hidden"), 5000);
}

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginForm = document.getElementById("login-form");

  // ── Login form submission ──────────────────────────────────────────────────
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    const errorDiv = document.getElementById("login-error");

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (response.ok) {
        localStorage.setItem("teacher_token", result.token);
        localStorage.setItem("teacher_username", result.username);
        closeLoginModal();
        updateAuthUI();
        fetchActivities();
      } else {
        errorDiv.textContent = result.detail || "Login failed";
        errorDiv.classList.remove("hidden");
      }
    } catch (err) {
      errorDiv.textContent = "Login request failed. Please try again.";
      errorDiv.classList.remove("hidden");
    }
  });

  // Close modal when clicking outside it
  document.getElementById("login-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("login-modal")) closeLoginModal();
  });

  // ── Sign up ───────────────────────────────────────────────────────────────
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      const result = await response.json();
      messageDiv.textContent = response.ok
        ? result.message
        : result.detail || "An error occurred";
      messageDiv.className = response.ok ? "success" : "error";
      if (response.ok) { signupForm.reset(); fetchActivities(); }
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
    }

    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  });

  // ── Initialize ────────────────────────────────────────────────────────────
  updateAuthUI();
  fetchActivities();
});
