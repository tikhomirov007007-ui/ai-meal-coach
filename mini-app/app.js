const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_BASE = window.location.origin + "/api";

function getInitData() {
  return tg.initData;
}

async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getInitData(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "API error");
  }
  return res.json();
}

let userData = null;

async function loadUser() {
  userData = await api("/me");
  document.getElementById("goalInput").value = userData.goal_kcal;
  document.getElementById("timezoneSelect").value = userData.timezone || "UTC";
  document.getElementById("goalKcal").textContent = userData.goal_kcal;

  const badge = document.getElementById("premiumBadge");
  if (userData.is_premium) {
    badge.textContent = "⭐ Premium активен";
    badge.classList.remove("free");
  } else {
    badge.textContent = "Free: 3 фото/день. Premium — безлимит в боте (/premium)";
    badge.classList.add("free");
  }
}

async function loadToday() {
  const data = await api("/meals/today");
  const { meals, stats, goal_kcal } = data;

  document.getElementById("todayCalories").textContent =
    `${stats.total_calories} / ${goal_kcal}`;
  document.getElementById("proteinToday").textContent = `${Math.round(stats.total_protein)}g`;
  document.getElementById("fatToday").textContent = `${Math.round(stats.total_fat)}g`;
  document.getElementById("carbsToday").textContent = `${Math.round(stats.total_carbs)}g`;

  const pct = Math.min((stats.total_calories / goal_kcal) * 100, 100);
  const fill = document.getElementById("progressFill");
  fill.style.width = pct + "%";
  fill.classList.toggle("over", stats.total_calories > goal_kcal);

  const list = document.getElementById("todayMeals");
  const empty = document.getElementById("todayEmpty");
  list.innerHTML = "";

  if (meals.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  for (const meal of meals) {
    const li = document.createElement("li");
    li.className = "meal-item";
    li.innerHTML = `
      <div class="meal-item-header">
        <span class="meal-name">${escapeHtml(meal.dish_name)}</span>
        <span class="meal-calories">${meal.calories} ккал</span>
      </div>
      <div class="meal-macros">Б: ${meal.protein}g · Ж: ${meal.fat}g · У: ${meal.carbs}g</div>
      <div class="portion-control">
        <label>Порция (g):</label>
        <input type="number" value="100" min="10" max="2000" data-meal-id="${meal.id}" class="portion-input" />
        <button onclick="recalcPortion(${meal.id}, this)">Пересчитать</button>
      </div>
    `;
    list.appendChild(li);
  }
}

window.recalcPortion = async function (mealId, btn) {
  const input = btn.previousElementSibling;
  const grams = parseFloat(input.value) || 100;
  btn.disabled = true;
  try {
    await api(`/meals/${mealId}/portion`, {
      method: "PATCH",
      body: JSON.stringify({ grams, base_grams: 100 }),
    });
    await loadToday();
    tg.showAlert("Порция обновлена!");
  } catch (e) {
    tg.showAlert("Ошибка: " + e.message);
  } finally {
    btn.disabled = false;
  }
};

async function loadHistory() {
  const data = await api("/meals/history?days=7");
  const container = document.getElementById("historyList");
  const empty = document.getElementById("historyEmpty");
  container.innerHTML = "";

  const dates = Object.keys(data.grouped).sort().reverse();
  if (dates.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  for (const date of dates) {
    const meals = data.grouped[date];
    const total = meals.reduce((s, m) => s + m.calories, 0);
    const day = document.createElement("div");
    day.className = "history-day";
    day.innerHTML = `
      <div class="history-date">${formatDate(date)} · ${total} ккал</div>
      <ul class="meal-list">
        ${meals
          .map(
            (m) =>
              `<li class="meal-item">
                <div class="meal-item-header">
                  <span class="meal-name">${escapeHtml(m.dish_name)}</span>
                  <span class="meal-calories">${m.calories} ккал</span>
                </div>
              </li>`
          )
          .join("")}
      </ul>
    `;
    container.appendChild(day);
  }
}

async function loadStats() {
  const data = await api("/stats/weekly");

  document.getElementById("avgCalories").textContent = data.avg_calories || "—";
  document.getElementById("goalKcal").textContent = data.goal_kcal;
  document.getElementById("avgProtein").textContent = data.avg_protein ? `${data.avg_protein}g` : "—";
  document.getElementById("avgFat").textContent = data.avg_fat ? `${data.avg_fat}g` : "—";
  document.getElementById("avgCarbs").textContent = data.avg_carbs ? `${data.avg_carbs}g` : "—";

  renderChart(data.days, data.goal_kcal);

  const topList = document.getElementById("topDishes");
  topList.innerHTML = "";
  if (data.top_dishes.length === 0) {
    topList.innerHTML = '<li style="color: var(--tg-theme-hint-color)">Нет данных</li>';
  } else {
    for (const dish of data.top_dishes) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(dish.dish_name)}</span><span>${dish.count}×</span>`;
      topList.appendChild(li);
    }
  }
}

function renderChart(days, goal) {
  const chart = document.getElementById("weeklyChart");
  chart.innerHTML = "";

  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = days.find((day) => day.date?.slice(0, 10) === key);
    last7.push({
      date: key,
      calories: found ? found.total_calories : 0,
      label: d.toLocaleDateString("ru-RU", { weekday: "short" }),
    });
  }

  const maxCal = Math.max(goal, ...last7.map((d) => d.calories), 1);

  for (const day of last7) {
    const wrap = document.createElement("div");
    wrap.className = "chart-bar-wrap";
    const height = Math.max((day.calories / maxCal) * 100, day.calories > 0 ? 8 : 4);
    wrap.innerHTML = `
      <div class="chart-bar" style="height: ${height}%"></div>
      <span class="chart-label">${day.label}</span>
    `;
    chart.appendChild(wrap);
  }
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.id === tabName);
  });

  if (tabName === "today") loadToday();
  if (tabName === "history") loadHistory();
  if (tabName === "stats") loadStats();
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Сегодня";
  if (dateStr === yesterday) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

document.getElementById("closeBtn").addEventListener("click", () => tg.close());
document.getElementById("profileBtn").addEventListener("click", () => {
  document.getElementById("profileModal").classList.remove("hidden");
});
document.getElementById("closeProfile").addEventListener("click", () => {
  document.getElementById("profileModal").classList.add("hidden");
});

document.getElementById("saveProfile").addEventListener("click", async () => {
  const goal_kcal = parseInt(document.getElementById("goalInput").value, 10);
  const timezone = document.getElementById("timezoneSelect").value;
  try {
    userData = await api("/me", {
      method: "PATCH",
      body: JSON.stringify({ goal_kcal, timezone }),
    });
    document.getElementById("profileModal").classList.add("hidden");
    tg.showAlert("Настройки сохранены!");
    await loadToday();
  } catch (e) {
    tg.showAlert("Ошибка: " + e.message);
  }
});

async function init() {
  try {
    await loadUser();
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") || "today";
    switchTab(tab);
  } catch (e) {
    document.getElementById("content").innerHTML =
      `<p class="empty-state">Открой приложение через Telegram бота.<br><br>${escapeHtml(e.message)}</p>`;
  }
}

init();
