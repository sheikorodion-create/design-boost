// ПРОТОТИП мини-приложения: загрузка работ, модерация и реакции.
// Сервера пока нет: всё хранится в браузере (localStorage), пользователь —
// из Telegram, если страница открыта внутри него, иначе из демо-панели внизу.
//
// Правила:
// — пока задание идёт, чужие работы видны только тем, кто загрузил свою
//   и подтвердил, что понимает риск зафреймиться;
// — после дедлайна загрузка закрыта, одобренные работы видны всем;
// — работа появляется в ленте только после одобрения модератором;
// — реакция одна (🔥), на свою работу ставить нельзя;
// — грузить можно только картинки, до 5 штук на работу.

const MAX_IMAGES = 5;
const DEMO_ACTIVE_BOOST = "netflix"; // задание, которое в демо считается «идущим»

const DEMO_USERS = {
  guest: null,
  member: { id: 1001, name: "Вы (участник)" },
  admin: { id: 1, name: "Родион (модератор)", admin: true },
};

const store = {
  read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
};

// ---------- демо-настройки ----------
const demo = store.read("db-demo", { user: "member", mode: "active" });
function saveDemo() { store.write("db-demo", demo); }

function currentUser() {
  const tg = window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe;
  if (tg && tg.user) return { id: tg.user.id, name: [tg.user.first_name, tg.user.last_name].filter(Boolean).join(" ") };
  return DEMO_USERS[demo.user];
}
const isAdmin = () => !!(currentUser() && currentUser().admin);
const isActive = (boostId) => boostId === DEMO_ACTIVE_BOOST && demo.mode === "active";

// ---------- «база» ----------
function placeholder(name, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${color}"/><text x="400" y="310" font-family="Golos Text, Arial" font-size="44" font-weight="700" text-anchor="middle" fill="#111214">${name}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function seed() {
  const people = [["Аня", "#FFDB00"], ["Тим", "#8AA8FF"], ["Полина", "#FF95D6"], ["Никита", "#00DAB4"]];
  return {
    works: people.map(([name, color], i) => ({
      id: "seed" + i, boostId: DEMO_ACTIVE_BOOST, userId: 2000 + i, userName: name,
      images: [placeholder("Работа: " + name, color)], status: i === 3 ? "pending" : "approved", createdAt: Date.now() - i * 3600e3,
    })),
    reactions: { seed0: [2001, 2002], seed1: [2000], seed2: [] },
    acks: {},
  };
}
let db = store.read("db-store", null) || seed();
function saveDb() {
  if (!store.write("db-store", db)) alertBox("Не хватает места в браузере для демо-картинок. Сбросьте демо в панели внизу.");
}

const worksOf = (boostId) => db.works.filter((w) => w.boostId === boostId);
const myWork = (boostId, user) => user && worksOf(boostId).find((w) => w.userId === user.id);
const acked = (boostId, user) => user && (db.acks[boostId] || []).includes(user.id);
const reactionsOf = (workId) => db.reactions[workId] || [];

// ---------- разметка ----------
const plural = (n, one, few, many) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};

function workCard(w, user) {
  const mine = user && w.userId === user.id;
  const r = reactionsOf(w.id);
  const on = user && r.includes(user.id);
  return `
    <article class="work-card">
      <button class="work-cover" type="button" data-c="open" data-work="${w.id}" aria-label="Открыть работу ${w.userName}">
        <img src="${w.images[0]}" alt="Работа ${w.userName}" loading="lazy">
        ${w.images.length > 1 ? `<span class="work-count">${w.images.length}</span>` : ""}
      </button>
      <div class="work-meta">
        <span>${mine ? "Ваша работа" : w.userName}</span>
        <button class="react${on ? " is-on" : ""}" type="button" data-c="react" data-work="${w.id}"
          ${!user || mine ? "disabled" : ""} aria-pressed="${!!on}"
          aria-label="${mine ? "На свою работу реакцию не ставят" : on ? "Убрать огонь" : "Поставить огонь"}">
          <span aria-hidden="true">🔥</span>${r.length || ""}
        </button>
      </div>
    </article>`;
}

function uploadForm() {
  return `
    <form class="block upload" data-c="upload-form">
      <h3 class="p-sub">Загрузить свою работу</h3>
      <p class="upload-hint">До ${MAX_IMAGES} картинок: JPG, PNG или WebP. После проверки модератором работа появится в ленте.</p>
      <label class="upload-drop">
        <input type="file" name="images" accept="image/png,image/jpeg,image/webp" multiple>
        <span data-c="picked">Выбрать картинки</span>
      </label>
      <div class="upload-previews" data-c="previews"></div>
      <button class="btn" type="submit" disabled data-c="submit">
        <span>Отправить на модерацию</span>
      </button>
    </form>`;
}

function renderCommunity(b) {
  const root = document.getElementById("community");
  if (!root) return;
  const user = currentUser();
  const active = isActive(b.id);
  const all = worksOf(b.id);
  const approved = all.filter((w) => w.status === "approved").sort((x, y) => reactionsOf(y.id).length - reactionsOf(x.id).length);
  const mine = myWork(b.id, user);
  let body = "";

  if (!active) {
    // после дедлайна — архив для всех
    // у прошедших заданий без работ блок не показываем вовсе
    if (!approved.length) { root.hidden = true; return; }
    body = `<p class="c-note">Приём работ закрыт. Здесь все одобренные работы.</p><div class="works-grid">${approved.map((w) => workCard(w, user)).join("")}</div>`;
  } else if (!user) {
    body = `
      <div class="block c-gate">
        <p>Загрузить работу и посмотреть чужие можно в Telegram — там вас узнают без регистрации.</p>
        <span class="btn is-disabled"><span>Открыть в Telegram</span></span>
      </div>`;
  } else if (!mine) {
    body = `
      ${uploadForm()}
      <div class="block c-gate">
        <p>Уже ${approved.length} ${plural(approved.length, "работа", "работы", "работ")}. Чужие работы откроются после того, как вы загрузите свою.</p>
      </div>`;
  } else {
    const status = mine.status === "pending"
      ? `<p class="c-status">Ваша работа на модерации. Она появится в ленте после проверки.</p>`
      : mine.status === "rejected" ? `<p class="c-status">Модератор отклонил работу. Можно загрузить новую.</p>` : "";
    const gallery = acked(b.id, user)
      ? `<div class="works-grid">${approved.map((w) => workCard(w, user)).join("")}</div>`
      : `
        <div class="block c-gate">
          <h3 class="p-sub">Перед тем как смотреть</h3>
          <p>Чужие решения могут зафреймить: после них сложнее думать своей головой. Если хотите ещё доработать свою, лучше вернуться к ленте после дедлайна.</p>
          <button class="btn" type="button" data-c="ack"><span>Понимаю, показать работы</span></button>
        </div>`;
    body = `${status}${mine.status === "rejected" ? uploadForm() : ""}${gallery}`;
  }

  root.hidden = false;
  root.innerHTML = `<h2 class="p-title">Работы участников</h2>${body}`;
  if (typeof typograph === "function") typograph(root);
}

// ---------- модерация ----------
function renderModeration() {
  document.title = "Модерация — Design Boost";
  const pending = db.works.filter((w) => w.status === "pending");
  const titleOf = (id) => (BOOSTS.find((x) => x.id === id) || {}).title || id;
  app.innerHTML = `
    ${head(`<a class="logo" href="#/">DESIGN BOOST</a>`, "moderation")}
    <div class="page partners-page">
      <a class="back" href="#/"><img class="arrow" src="icons/arrow.svg" alt="">Назад</a>
      <section class="p-section">
        <h1 class="p-title">Модерация</h1>
        ${!isAdmin() ? `<p class="c-note">Раздел доступен только модераторам.</p>`
        : !pending.length ? `<p class="c-note">Новых работ нет.</p>`
        : `<div class="works-grid">${pending.map((w) => `
          <article class="work-card">
            <button class="work-cover" type="button" data-c="open" data-work="${w.id}"><img src="${w.images[0]}" alt=""></button>
            <div class="mod-meta">
              <span>${w.userName}</span>
              <span class="p-label">${titleOf(w.boostId)} · ${w.images.length} ${plural(w.images.length, "картинка", "картинки", "картинок")}</span>
            </div>
            <div class="mod-actions">
              <button class="btn" type="button" data-c="approve" data-work="${w.id}"><span>Одобрить</span></button>
              <button class="btn is-ghost" type="button" data-c="reject" data-work="${w.id}"><span>Отклонить</span></button>
            </div>
          </article>`).join("")}</div>`}
      </section>
    </div>`;
}

// ---------- действия ----------
let picked = [];

function rerender() {
  const m = location.hash.match(/^#\/boost\/([\w-]+)/);
  const b = m && BOOSTS.find((x) => x.id === m[1]);
  if (b) renderCommunity(b);
  else if (location.hash === "#/moderation") renderModeration();
}

function alertBox(text) {
  const el = document.createElement("div");
  el.className = "c-toast";
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 3200);
}

async function shrink(file) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

document.addEventListener("change", async (e) => {
  if (!e.target.matches('[data-c="upload-form"] input[type=file]')) return;
  const form = e.target.closest("form");
  const files = [...e.target.files].filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
  if (files.length > MAX_IMAGES) alertBox(`Можно до ${MAX_IMAGES} картинок — взял первые ${MAX_IMAGES}.`);
  picked = await Promise.all(files.slice(0, MAX_IMAGES).map(shrink));
  form.querySelector('[data-c="previews"]').innerHTML = picked.map((src) => `<img src="${src}" alt="">`).join("");
  form.querySelector('[data-c="picked"]').textContent = picked.length ? `Выбрано: ${picked.length}` : "Выбрать картинки";
  form.querySelector('[data-c="submit"]').disabled = !picked.length;
});

document.addEventListener("submit", (e) => {
  if (!e.target.matches('[data-c="upload-form"]')) return;
  e.preventDefault();
  const user = currentUser();
  const m = location.hash.match(/^#\/boost\/([\w-]+)/);
  if (!user || !m || !picked.length) return;
  db.works = db.works.filter((w) => !(w.boostId === m[1] && w.userId === user.id));
  db.works.push({ id: "w" + Date.now(), boostId: m[1], userId: user.id, userName: user.name, images: picked, status: "pending", createdAt: Date.now() });
  picked = [];
  saveDb();
  rerender();
  alertBox("Работа отправлена на модерацию");
});

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-c]");
  if (!el) return;
  const act = el.dataset.c;
  const user = currentUser();
  const work = el.dataset.work && db.works.find((w) => w.id === el.dataset.work);
  const m = location.hash.match(/^#\/boost\/([\w-]+)/);

  if (act === "ack" && user && m) {
    db.acks[m[1]] = [...new Set([...(db.acks[m[1]] || []), user.id])];
    saveDb(); rerender();
  } else if (act === "react" && user && work && work.userId !== user.id) {
    const r = reactionsOf(work.id);
    db.reactions[work.id] = r.includes(user.id) ? r.filter((id) => id !== user.id) : [...r, user.id];
    saveDb(); rerender();
  } else if (act === "open" && work) {
    viewer.list = work.images;
    viewer.show(0);
  } else if ((act === "approve" || act === "reject") && work && isAdmin()) {
    work.status = act === "approve" ? "approved" : "rejected";
    saveDb(); rerender();
  }
});

// ---------- демо-панель ----------
function demoPanel() {
  if (window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user) return;
  const el = document.createElement("div");
  el.className = "demo-panel";
  el.innerHTML = `
    <span>Прототип</span>
    <select data-demo="user" aria-label="Кто смотрит">
      <option value="guest">Гость в браузере</option>
      <option value="member">Участник из Telegram</option>
      <option value="admin">Модератор</option>
    </select>
    <select data-demo="mode" aria-label="Состояние задания Netflix">
      <option value="active">Netflix: идёт</option>
      <option value="finished">Netflix: завершено</option>
    </select>
    <button type="button" data-demo="reset">Сбросить</button>`;
  el.querySelector('[data-demo="user"]').value = demo.user;
  el.querySelector('[data-demo="mode"]').value = demo.mode;
  el.addEventListener("change", (e) => {
    demo[e.target.dataset.demo] = e.target.value;
    saveDemo();
    shownPath = null;
    route(location.hash);
  });
  el.querySelector('[data-demo="reset"]').addEventListener("click", () => {
    db = seed(); saveDb();
    shownPath = null;
    route(location.hash);
  });
  document.body.append(el);
  document.body.classList.add("has-demo");
}
document.addEventListener("DOMContentLoaded", demoPanel);
