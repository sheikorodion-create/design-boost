const app = document.getElementById("app");
// Работы участников скрыты до Версии 1; чтобы вернуть галерею, поставьте true
const SHOW_WORKS = false;

// Типографика: короткие предлоги, союзы и частицы не остаются в конце строки,
// тире не переносится в начало строки, число не отрывается от следующего слова
const SHORT_WORDS = /(?<![\p{L}\p{N}])([а-яё]{1,2}|для|без|при|про|над|под|или|что|как|чем|где)\s+/giu;
function typograph(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    node.nodeValue = node.nodeValue
      .replace(SHORT_WORDS, "$1\u00A0")
      .replace(/\s+—/g, "\u00A0—")
      .replace(/(\d)\s+(?=[а-яё])/giu, "$1\u00A0");
  }
}

function signature(b) {
  return b.collab ? `Design boost X ${b.collab}` : "Design boost";
}

// Шапка: логотип и раскрывающееся меню
function head(logo) {
  return `
    <header class="head">
      <div class="head-row">
        ${logo}
        <div class="menu">
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu-panel" aria-label="Открыть меню">
            <span class="burger"><i></i><i></i></span>
          </button>
          <nav class="menu-panel" id="menu-panel" aria-label="Меню">
            <p class="menu-desc">Разминки для дизайнеров.<br>Продуктовый дизайн, интерфейсы, графика и визуальные эксперименты. Здесь лежат все прошедшие задания и работы участников.</p>
            <div class="menu-links">
              <a class="menu-item" href="https://t.me/rudsdesign" target="_blank" rel="noopener">
                <span>Предложить сотрудничество</span>
                <img class="arrow" src="icons/arrow.svg" alt="">
              </a>
            </div>
          </nav>
        </div>
      </div>
    </header>`;
}

function setMenu(open) {
  const toggle = document.querySelector(".menu-toggle");
  if (!toggle) return;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  // Пока меню открыто, страница под ним не прокручивается
  document.documentElement.classList.toggle("menu-open", open);
}

function card(b, i) {
  return `
    <a class="card" href="#/boost/${b.id}" style="--c:${b.color};--i:${i}">
      <div class="card-row">
        <span>${b.deadline}</span>
        <span>${b.type}</span>
      </div>
      <div class="card-text">
        <h2 class="card-title">${b.title}</h2>
        <p class="card-desc">${b.desc}</p>
      </div>
      <div class="card-row">
        <span>${signature(b)}</span>
        <img class="arrow" src="icons/arrow.svg" alt="">
      </div>
    </a>`;
}

function renderList(intro) {
  document.title = "Design Boost — разминки для дизайнеров";
  app.innerHTML = `
    ${head(`<h1 class="logo">DESIGN BOOST</h1>`)}
    <section class="list${intro ? " is-intro" : ""}">${BOOSTS.map(card).join("")}</section>`;
  typograph(app);
}

function renderBoost(b) {
  document.title = `${b.title} — Design Boost`;
  const works = SHOW_WORKS && b.works.length
    ? `<section class="gallery">
        <h2>Работы участников</h2>
        <div class="works">${b.works.map((src, i) => `
          <button class="work" type="button" data-i="${i}" aria-label="Открыть работу ${i + 1}">
            <img src="${src}" alt="Работа участника ${i + 1}" loading="lazy">
          </button>`).join("")}</div>
      </section>`
    : "";

  // Картинки из поста с заданием: одна на всю ширину, несколько — сеткой
  const images = b.images && b.images.length
    ? `<div class="shots${b.images.length > 1 ? " is-grid" : ""}">${b.images.map((src, i) => `
        <button class="shot" type="button" data-i="${i}" aria-label="Открыть изображение ${i + 1}">
          <img src="${src}" alt="Изображение к заданию ${i + 1}" loading="lazy">
        </button>`).join("")}</div>`
    : "";

  const materials = b.links.length
    ? `<nav class="materials" aria-label="Материалы">
        <h2>Материалы</h2>
        ${b.links.map(([label, url]) => `
          <a href="${url}" target="_blank" rel="noopener">
            <span>${label}</span>
            <img class="arrow" src="icons/arrow.svg" alt="">
          </a>`).join("")}
      </nav>`
    : "";

  app.innerHTML = `
    ${head(`<a class="logo" href="#/">DESIGN BOOST</a>`)}
    <div class="page">
      <a class="back" href="#/"><img class="arrow" src="icons/arrow.svg" alt="">Назад</a>
      <div class="card hero" style="--c:${b.color}">
        <div class="card-row">
          <span>${b.deadline}</span>
          <span>${b.type}</span>
        </div>
        <div class="card-text">
          <h1 class="card-title">${b.title}</h1>
        </div>
        <div class="card-row">
          <span>${signature(b)}</span>
        </div>
      </div>
      ${images}
      <div class="sheet">
        <article class="brief">${b.brief}</article>
        <aside class="side">
          <dl class="facts">
            ${b.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}
          </dl>
          ${materials}
        </aside>
      </div>
      ${works}
    </div>`;
  typograph(app);
  viewer.list = b.images || [];
}

// Переходы между списком и страницей задания
let currentId = null;
let listScroll = 0;
let firstRender = true;

let shownPath = null;

function route(path = location.hash) {
  if (path === shownPath) return;
  shownPath = path;
  const m = path.match(/^#\/boost\/([\w-]+)/);
  const boost = (m && BOOSTS.find((b) => b.id === m[1])) || null;
  document.documentElement.classList.remove("menu-open");
  const prevId = currentId;
  currentId = boost ? boost.id : null;
  if (!prevId && boost) listScroll = window.scrollY;

  const render = () => {
    if (boost) {
      renderBoost(boost);
      window.scrollTo(0, 0);
    } else {
      renderList(firstRender);
      // Возвращаемся в то место списка, откуда ушли
      window.scrollTo(0, prevId ? listScroll : 0);
    }
  };

  if (firstRender || !document.startViewTransition) {
    render();
    firstRender = false;
    return;
  }

  // Направление сдвига: вперёд в задание или назад к списку
  document.documentElement.dataset.nav = boost ? "forward" : "back";
  // Если переход недоступен или прерван, страница всё равно отрисовывается
  try {
    const transition = document.startViewTransition(render);
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
  } catch {
    render();
  }
}

// Внутренние ссылки открываем сами, не дожидаясь перехода по адресу: встроенные
// просмотрщики файлов на телефонах такие переходы могут блокировать
function navigate(path) {
  try {
    history.pushState(null, "", path);
  } catch {
    try { location.hash = path; } catch {}
  }
  route(path);
}

document.addEventListener("click", (e) => {
  const link = e.target.closest('a[href^="#/"]');
  if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  navigate(link.getAttribute("href"));
});

// Просмотр работ
const viewer = {
  el: document.getElementById("viewer"),
  img: document.getElementById("viewer-img"),
  count: document.getElementById("viewer-count"),
  list: [],
  i: 0,
  show(i) {
    this.i = (i + this.list.length) % this.list.length;
    this.img.src = this.list[this.i];
    this.count.textContent = `${this.i + 1} / ${this.list.length}`;
    if (!this.el.open) this.el.showModal();
  },
};

viewer.el.addEventListener("click", (e) => {
  const act = e.target.dataset.act;
  if (act === "prev") viewer.show(viewer.i - 1);
  else if (act === "next") viewer.show(viewer.i + 1);
  else if (act === "close" || e.target === viewer.el) viewer.el.close();
});

document.addEventListener("keydown", (e) => {
  if (!viewer.el.open) return;
  if (e.key === "ArrowLeft") viewer.show(viewer.i - 1);
  if (e.key === "ArrowRight") viewer.show(viewer.i + 1);
});

// Меню: открытие, закрытие по клику мимо и по Escape
document.addEventListener("click", (e) => {
  const toggle = e.target.closest(".menu-toggle");
  if (toggle) {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
    return;
  }
  setMenu(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMenu(false);
});

app.addEventListener("click", (e) => {
  const shot = e.target.closest(".shot");
  if (shot) viewer.show(Number(shot.dataset.i));
});

typograph(document.querySelector(".foot"));
window.addEventListener("hashchange", () => route());
window.addEventListener("popstate", () => route());
route();
