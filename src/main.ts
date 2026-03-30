import './style.css';

document.getElementById('app')!.innerHTML = `
<div class="page">

  <!-- Background orbs -->
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>

  <!-- NAV -->
  <nav class="nav">
    <div class="nav-inner">
      <a href="#" class="logo" aria-label="SubGuard home">
        <div class="logo-mark">S</div>
        <span>SubGuard</span>
      </a>
      <div class="nav-links">
        <a href="#problem">Why</a>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
      </div>
      <a href="#pricing" class="btn btn-primary btn-sm">Get Started Free</a>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-bg-image"></div>
    <div class="hero-inner">
      <div class="hero-badge fade-up">Browser Extension · Chrome & Edge</div>
      <h1 class="hero-title fade-up">
        You're probably paying for<br/>
        <span class="accent">things you forgot about.</span>
      </h1>
      <p class="hero-sub fade-up">
        SubGuard sits quietly in your browser and keeps track of every subscription —
        what it costs, when it renews, and how to cancel it.
        No cloud account. No data leaving your device.
      </p>
      <div class="hero-actions fade-up">
        <a href="#pricing" class="btn btn-primary btn-lg">Start Free — 1 Month on Us</a>
        <a href="#features" class="btn btn-ghost btn-lg">See how it works</a>
      </div>
      <p class="hero-note fade-up">No credit card required for the free month.</p>

      <div class="hero-visual fade-up">
        <div class="browser-mockup">
          <div class="browser-bar">
            <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
            <div class="browser-url">SubGuard — Subscription Dashboard</div>
          </div>
          <div class="dashboard-preview">
            <div class="preview-sidebar">
              <div class="preview-nav-item active"></div>
              <div class="preview-nav-item"></div>
              <div class="preview-nav-item"></div>
              <div class="preview-nav-item"></div>
            </div>
            <div class="preview-content">
              <div class="preview-stats">
                <div class="preview-stat"><div class="stat-label">Monthly</div><div class="stat-value">$84.97</div></div>
                <div class="preview-stat"><div class="stat-label">Annual</div><div class="stat-value">$1,019</div></div>
                <div class="preview-stat"><div class="stat-label">Active</div><div class="stat-value">12</div></div>
              </div>
              <div class="preview-cards">
                <div class="preview-card"><div class="card-dot red-dot"></div><div class="card-info"><div class="card-name">Netflix</div><div class="card-meta">Renews in 3 days · $15.99</div></div></div>
                <div class="preview-card"><div class="card-dot green-dot"></div><div class="card-info"><div class="card-name">Spotify</div><div class="card-meta">Renews in 12 days · $9.99</div></div></div>
                <div class="preview-card"><div class="card-dot yellow-dot"></div><div class="card-info"><div class="card-name">Adobe CC</div><div class="card-meta">Trial ends in 2 days · $54.99</div></div></div>
                <div class="preview-card"><div class="card-dot blue-dot"></div><div class="card-info"><div class="card-name">Notion</div><div class="card-meta">Renews in 18 days · $8.00</div></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- PROBLEM -->
  <section class="problem" id="problem">
    <div class="problem-image-wrap">
      <img src="/images/problem-illustration.png" alt="" aria-hidden="true" />
    </div>
    <div class="container">
      <div class="section-label fade-up">The honest truth</div>
      <h2 class="section-title fade-up">Subscriptions are designed to be forgotten.</h2>
      <p class="section-sub fade-up">Companies know that once you sign up, you probably won't notice the monthly charge. They count on it. That's not a conspiracy — it's just how the business model works.</p>
      <div class="pain-grid">
        <div class="pain-card fade-up"><div class="pain-icon">💸</div><h3>The silent drain</h3><p>The average person pays for 4–6 subscriptions they haven't used in over 3 months. That's $30–$80 quietly leaving your account every month.</p></div>
        <div class="pain-card fade-up"><div class="pain-icon">🔔</div><h3>The surprise renewal</h3><p>You signed up for a free trial. You forgot. Now it's been 6 months and you've paid $90 for something you used once.</p></div>
        <div class="pain-card fade-up"><div class="pain-icon">🌀</div><h3>The cancellation maze</h3><p>You want to cancel but can't find the button. It's buried 4 menus deep, requires a phone call, or only works on a Tuesday.</p></div>
        <div class="pain-card fade-up"><div class="pain-icon">📊</div><h3>No single view</h3><p>Your subscriptions are spread across 3 email addresses, 2 credit cards, and a PayPal account you forgot the password to.</p></div>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section class="features" id="features">
    <div class="container">
      <div class="section-label fade-up">What SubGuard does</div>
      <h2 class="section-title fade-up">One place. Full picture. No surprises.</h2>
      <div class="features-grid">

        <div class="feature-row fade-up">
          <div class="feature-text">
            <div class="feature-tag">Dashboard</div>
            <h3>See everything at once</h3>
            <p>Your total monthly spend, upcoming renewals, and every active subscription in one clean view. Filter by category, sort by cost or renewal date.</p>
            <ul class="feature-list">
              <li>Monthly & annual spend totals</li>
              <li>Upcoming renewals in the next 7 days</li>
              <li>Filter by Streaming, SaaS, Fitness, AI, and more</li>
            </ul>
          </div>
          <div class="feature-visual">
            <div class="mini-dashboard">
              <div class="mini-stat-row">
                <div class="mini-stat"><span class="mini-label">Monthly</span><span class="mini-val">$84.97</span></div>
                <div class="mini-stat"><span class="mini-label">Annual</span><span class="mini-val">$1,019</span></div>
                <div class="mini-stat"><span class="mini-label">Active</span><span class="mini-val">12</span></div>
              </div>
              <div class="mini-tags">
                <span class="tag active">All</span><span class="tag">Streaming</span><span class="tag">SaaS</span><span class="tag">AI</span>
              </div>
              <div class="mini-list">
                <div class="mini-item"><span class="mini-dot r"></span><span>Netflix · $15.99</span><span class="mini-date">3d</span></div>
                <div class="mini-item"><span class="mini-dot g"></span><span>Spotify · $9.99</span><span class="mini-date">12d</span></div>
                <div class="mini-item"><span class="mini-dot y"></span><span>Adobe CC · $54.99</span><span class="mini-date">Trial</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="feature-row reverse fade-up">
          <div class="feature-text">
            <div class="feature-tag">Renewal Reminders</div>
            <h3>Never get surprised again</h3>
            <p>SubGuard sends you a browser notification before any subscription renews. You decide how many days in advance — 1 day, 3 days, a week.</p>
            <ul class="feature-list">
              <li>Configurable reminder lead time (1–30 days)</li>
              <li>Special alerts for trials about to convert</li>
              <li>Works even when the browser is closed</li>
            </ul>
          </div>
          <div class="feature-visual">
            <div class="notification-mockup">
              <div class="notif"><div class="notif-icon">🛡️</div><div class="notif-body"><div class="notif-title">SubGuard — Upcoming Renewal</div><div class="notif-msg">Netflix renews tomorrow — $15.99</div></div></div>
              <div class="notif notif-trial"><div class="notif-icon">⏱️</div><div class="notif-body"><div class="notif-title">SubGuard — Trial Ending Soon</div><div class="notif-msg">Adobe CC trial ends in 2 days. You'll be charged $54.99 unless you cancel.</div></div></div>
            </div>
          </div>
        </div>

        <div class="feature-row fade-up">
          <div class="feature-text">
            <div class="feature-tag">Cancel Helper</div>
            <h3>Step-by-step cancellation guidance</h3>
            <p>For every major service, SubGuard shows you exactly how to cancel — with a direct link to the cancellation page. No more hunting through settings menus.</p>
            <ul class="feature-list">
              <li>40+ services with cancellation instructions</li>
              <li>Direct "Open Cancel Page" button</li>
              <li>Marks subscription as cancelled automatically</li>
            </ul>
          </div>
          <div class="feature-visual">
            <div class="cancel-mockup">
              <div class="cancel-header"><div class="cancel-service">Netflix</div><div class="cancel-warning">⚠️ Renews in 3 days · $15.99</div></div>
              <div class="cancel-steps">
                <div class="cancel-step done">1. Go to Account settings</div>
                <div class="cancel-step done">2. Click "Membership & Billing"</div>
                <div class="cancel-step active">3. Click "Cancel Membership"</div>
                <div class="cancel-step">4. Confirm cancellation</div>
              </div>
              <div class="cancel-btn">Open Cancel Page →</div>
            </div>
          </div>
        </div>

        <div class="feature-row reverse fade-up privacy-section">
          <div class="privacy-image-wrap">
            <img src="/images/privacy-illustration.png" alt="" aria-hidden="true" />
          </div>
          <div class="feature-text">
            <div class="feature-tag">Privacy First</div>
            <h3>Your data never leaves your device</h3>
            <p>Everything is stored locally in your browser. No account required. No server. No cloud sync. Just you and your data.</p>
            <ul class="feature-list">
              <li>100% local storage — no cloud account</li>
              <li>Export your data as CSV anytime</li>
              <li>Delete everything with one click</li>
            </ul>
          </div>
          <div class="feature-visual">
            <div class="privacy-visual">
              <div class="privacy-device">
                <div class="device-icon">💻</div>
                <div class="device-label">Your Browser</div>
                <div class="device-items">
                  <div class="device-item">📋 Subscriptions</div>
                  <div class="device-item">⚙️ Settings</div>
                  <div class="device-item">🔑 License</div>
                </div>
              </div>
              <div class="privacy-arrow">
                <div class="arrow-line"></div>
                <div class="arrow-cross">✕</div>
                <div class="arrow-label">No data sent</div>
              </div>
              <div class="privacy-cloud">
                <div class="cloud-icon">☁️</div>
                <div class="cloud-label">Any Server</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- PRICING -->
  <section class="pricing" id="pricing">
    <div class="container">
      <div class="section-label fade-up">Pricing</div>
      <h2 class="section-title fade-up">Start free. Stay if it helps.</h2>
      <p class="section-sub fade-up">One month free, no credit card needed. After that, it's less than a coffee. If SubGuard saves you even one forgotten subscription, it pays for itself.</p>
      <div class="pricing-toggle fade-up">
        <button id="toggle-monthly" class="toggle-btn active">Monthly</button>
        <button id="toggle-yearly" class="toggle-btn">Yearly <span class="save-badge">Save 44%</span></button>
      </div>
      <div class="pricing-cards fade-up">
        <div class="pricing-card">
          <div class="plan-name">Free</div>
          <div class="plan-price"><span class="price-amount">$0</span><span class="price-period">1 month</span></div>
          <div class="plan-desc">Everything you need to get started. No card required.</div>
          <ul class="plan-features">
            <li>✓ Full dashboard & spend tracking</li>
            <li>✓ Renewal reminders</li>
            <li>✓ Cancel helper (40+ services)</li>
            <li>✓ Calendar view</li>
            <li>✓ CSV export & import</li>
            <li>✓ 100% local — no account</li>
          </ul>
          <a href="#" class="btn btn-outline btn-full">Install Free</a>
        </div>
        <div class="pricing-card featured" id="pricing-monthly">
          <div class="plan-badge">Most Popular</div>
          <div class="plan-name">Pro</div>
          <div class="plan-price"><span class="price-amount">$2.99</span><span class="price-period">/ month</span></div>
          <div class="plan-desc">After your free month. Cancel anytime.</div>
          <ul class="plan-features">
            <li>✓ Everything in Free</li>
            <li>✓ Gmail email scanning</li>
            <li>✓ AI keep/cancel recommendations</li>
            <li>✓ Auto-highlight cancel buttons</li>
            <li>✓ Smart auto-categorization</li>
            <li>✓ Priority support</li>
          </ul>
          <a href="#" class="btn btn-primary btn-full">Start Free Month</a>
          <p class="plan-note">No credit card for the first month</p>
        </div>
        <div class="pricing-card featured hidden" id="pricing-yearly">
          <div class="plan-badge">Best Value</div>
          <div class="plan-name">Pro Yearly</div>
          <div class="plan-price"><span class="price-amount">$19.99</span><span class="price-period">/ year</span></div>
          <div class="plan-desc">That's $1.67/month. One subscription to rule them all.</div>
          <ul class="plan-features">
            <li>✓ Everything in Free</li>
            <li>✓ Gmail email scanning</li>
            <li>✓ AI keep/cancel recommendations</li>
            <li>✓ Auto-highlight cancel buttons</li>
            <li>✓ Smart auto-categorization</li>
            <li>✓ Priority support</li>
          </ul>
          <a href="#" class="btn btn-primary btn-full">Start Free Month</a>
          <p class="plan-note">No credit card for the first month</p>
        </div>
      </div>
      <p class="pricing-footer fade-up">All plans include a 1-month free trial. No credit card required to start.</p>
    </div>
  </section>

  <!-- TRUST -->
  <section class="trust">
    <div class="container">
      <div class="trust-grid fade-up">
        <div class="trust-item"><div class="trust-icon">🔒</div><div class="trust-text"><strong>No account required</strong><span>Your data never leaves your browser — ever</span></div></div>
        <div class="trust-item"><div class="trust-icon">📋</div><div class="trust-text"><strong>Plain English privacy policy</strong><span>No legal jargon. We tell you exactly what we do and don't do with your data</span></div></div>
        <div class="trust-item"><div class="trust-icon">🚫</div><div class="trust-text"><strong>No ads, ever</strong><span>We make money from Pro subscriptions, not your attention</span></div></div>
        <div class="trust-item"><div class="trust-icon">📤</div><div class="trust-text"><strong>Export anytime</strong><span>Your data is yours — download it as CSV and leave whenever you want</span></div></div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="cta">
    <div class="container">
      <div class="cta-inner fade-up">
        <h2>Stop paying for things you forgot about.</h2>
        <p>Install SubGuard free. Takes 30 seconds. No account, no card, no nonsense.</p>
        <a href="#" class="btn btn-primary btn-lg">Add to Chrome — It's Free</a>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="container">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="logo"><div class="logo-mark">S</div><span>SubGuard</span></div>
          <p>Know what you're paying for.</p>
        </div>
        <div class="footer-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </div>
      <div class="footer-copy">© 2025 SubGuard. Built with care for people who hate surprise charges.</div>
    </div>
  </footer>

</div>
`;

// Intersection observer for scroll animations
const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.1 }
);
document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el));

// Pricing toggle
const monthlyBtn = document.getElementById('toggle-monthly');
const yearlyBtn = document.getElementById('toggle-yearly');
const monthlyCard = document.getElementById('pricing-monthly');
const yearlyCard = document.getElementById('pricing-yearly');

monthlyBtn?.addEventListener('click', () => {
  monthlyBtn.classList.add('active'); yearlyBtn?.classList.remove('active');
  monthlyCard?.classList.remove('hidden'); yearlyCard?.classList.add('hidden');
});
yearlyBtn?.addEventListener('click', () => {
  yearlyBtn.classList.add('active'); monthlyBtn?.classList.remove('active');
  yearlyCard?.classList.remove('hidden'); monthlyCard?.classList.add('hidden');
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const href = (anchor as HTMLAnchorElement).getAttribute('href');
    if (!href || href === '#') return;
    e.preventDefault();
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  });
});
