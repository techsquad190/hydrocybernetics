/**
 * HydroCybernetics Citizen Authentication
 *
 * Real backend-backed authentication for Citizen accounts.
 * The Flask backend owns password hashing and the authenticated session.
 */

const AuthCitizenView = {

  state: {
    loading: false
  },

  renderLogin: () => `
    <div class="auth-page-container">
      <div class="container">
        <div class="auth-card citizen-auth-card">

          <div class="auth-card-header">
            <div class="icon-box icon-box-lg">
              ${Icons.citizen('icon')}
            </div>

            <h1 class="auth-card-title">Citizen Sign In</h1>

            <p class="auth-card-subtitle">
              Access local water information and manage your service reports.
            </p>
          </div>

          <form
            class="auth-form"
            id="citizen-login-form"
            onsubmit="AuthCitizenView.submitLogin(event);"
          >

            <div
              id="citizen-login-message"
              class="auth-notice-box"
              style="display:none;"
              role="alert"
            ></div>

            <div class="form-group">
              <label class="form-label" for="citizen-email">
                Email Address
              </label>

              <div class="input-with-icon">
                <span class="input-icon">
                  ${Icons.user('icon')}
                </span>

                <input
                  type="email"
                  id="citizen-email"
                  class="form-input"
                  placeholder="name@example.com"
                  autocomplete="email"
                  required
                />
              </div>
            </div>

            <div class="form-group">

              <div class="form-label-row">
                <label
                  class="form-label"
                  for="citizen-password"
                >
                  Password
                </label>

                <a
                  href="#/citizen/login"
                  class="form-link text-xs"
                  onclick="event.preventDefault(); AuthCitizenView.showMessage('Password recovery will be connected after the core authentication flow is complete.', 'info');"
                >
                  Forgot Password?
                </a>
              </div>

              <div class="input-with-icon">
                <span class="input-icon">
                  ${Icons.lock('icon')}
                </span>

                <input
                  type="password"
                  id="citizen-password"
                  class="form-input"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  minlength="8"
                  required
                />

                <button
                  type="button"
                  class="password-toggle-btn"
                  onclick="AuthCitizenView.togglePassword('citizen-password', this);"
                  aria-label="Show password"
                >
                  Show
                </button>
              </div>
            </div>

            <div class="form-actions">

              <button
                type="submit"
                id="citizen-login-submit"
                class="btn btn-primary btn-block"
              >
                <span id="citizen-login-submit-label">
                  Sign In
                </span>
                ${Icons.arrowRight('icon')}
              </button>

            </div>

          </form>

          <div class="auth-card-footer">

            <p class="text-xs text-muted">
              Don't have an account?
              <a
                href="#/citizen/register"
                class="text-accent"
                data-route="/citizen/register"
              >
                Create Citizen Account
              </a>
            </p>

            <p class="text-xs text-muted mt-3">
              Your session is authenticated by the HydroCybernetics
              backend.
            </p>

          </div>

        </div>
      </div>
    </div>
  `,

  renderRegister: () => `
    <div class="auth-page-container">
      <div class="container">
        <div class="auth-card citizen-auth-card">

          <div class="auth-card-header">
            <div class="icon-box icon-box-lg">
              ${Icons.citizen('icon')}
            </div>

            <h1 class="auth-card-title">
              Create Citizen Account
            </h1>

            <p class="auth-card-subtitle">
              Register to access neighborhood water information
              and submit service requests.
            </p>
          </div>

          <form
            class="auth-form"
            id="citizen-register-form"
            onsubmit="AuthCitizenView.submitRegister(event);"
          >

            <div
              id="citizen-register-message"
              class="auth-notice-box"
              style="display:none;"
              role="alert"
            ></div>

            <div class="form-group">
              <label
                class="form-label"
                for="citizen-reg-name"
              >
                Full Name
              </label>

              <div class="input-with-icon">
                <span class="input-icon">
                  ${Icons.user('icon')}
                </span>

                <input
                  type="text"
                  id="citizen-reg-name"
                  class="form-input"
                  placeholder="Jane Doe"
                  autocomplete="name"
                  minlength="2"
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <label
                class="form-label"
                for="citizen-reg-email"
              >
                Email Address
              </label>

              <div class="input-with-icon">
                <span class="input-icon">
                  ${Icons.user('icon')}
                </span>

                <input
                  type="email"
                  id="citizen-reg-email"
                  class="form-input"
                  placeholder="name@example.com"
                  autocomplete="email"
                  required
                />
              </div>
            </div>

            <div class="form-group">

              <label
                class="form-label"
                for="citizen-reg-password"
              >
                Password
              </label>

              <div class="input-with-icon">
                <span class="input-icon">
                  ${Icons.lock('icon')}
                </span>

                <input
                  type="password"
                  id="citizen-reg-password"
                  class="form-input"
                  placeholder="Minimum 8 characters"
                  autocomplete="new-password"
                  minlength="8"
                  required
                />

                <button
                  type="button"
                  class="password-toggle-btn"
                  onclick="AuthCitizenView.togglePassword('citizen-reg-password', this);"
                  aria-label="Show password"
                >
                  Show
                </button>
              </div>

            </div>

            <div class="form-group">

              <label
                class="form-label"
                for="citizen-reg-confirm"
              >
                Confirm Password
              </label>

              <div class="input-with-icon">
                <span class="input-icon">
                  ${Icons.lock('icon')}
                </span>

                <input
                  type="password"
                  id="citizen-reg-confirm"
                  class="form-input"
                  placeholder="Re-enter your password"
                  autocomplete="new-password"
                  minlength="8"
                  required
                />
              </div>

            </div>

            <div class="auth-notice-box">
              ${Icons.shield('icon')}

              <span>
                Your password is stored as a secure hash by the
                local HydroCybernetics authentication backend.
              </span>
            </div>

            <div class="form-actions">

              <button
                type="submit"
                id="citizen-register-submit"
                class="btn btn-primary btn-block"
              >
                <span id="citizen-register-submit-label">
                  Create Account
                </span>
                ${Icons.arrowRight('icon')}
              </button>

            </div>

          </form>

          <div class="auth-card-footer">

            <p class="text-xs text-muted">
              Already have an account?
              <a
                href="#/citizen/login"
                class="text-accent"
                data-route="/citizen/login"
              >
                Sign In
              </a>
            </p>

          </div>

        </div>
      </div>
    </div>
  `,

  showMessage: (message, type = 'error') => {

    const messageEl =
      document.getElementById(
        window.location.hash.includes('/register')
          ? 'citizen-register-message'
          : 'citizen-login-message'
      );

    if (!messageEl) {
      return;
    }

    messageEl.style.display = 'flex';
    messageEl.dataset.messageType = type;

    messageEl.innerHTML = `
      <span class="text-xs">
        ${AuthCitizenView.escape(message)}
      </span>
    `;
  },

  setLoading: (buttonId, labelId, loading) => {

    const button =
      document.getElementById(buttonId);

    const label =
      document.getElementById(labelId);

    if (!button || !label) {
      return;
    }

    button.disabled = loading;

    label.textContent =
      loading
        ? 'Please wait...'
        : buttonId === 'citizen-login-submit'
          ? 'Sign In'
          : 'Create Account';
  },

  submitLogin: async (event) => {

    event.preventDefault();

    const email =
      document.getElementById('citizen-email').value.trim();

    const password =
      document.getElementById('citizen-password').value;

    AuthCitizenView.showMessage('', 'info');

    if (password.length < 8) {
      AuthCitizenView.showMessage(
        'Password must contain at least 8 characters.'
      );
      return;
    }

    AuthCitizenView.setLoading(
      'citizen-login-submit',
      'citizen-login-submit-label',
      true
    );

    const result =
      await window.app.handleAuthSubmit(
        'citizen',
        '#/citizen/dashboard',
        {
          email,
          password
        }
      );

    AuthCitizenView.setLoading(
      'citizen-login-submit',
      'citizen-login-submit-label',
      false
    );

    if (!result.ok) {
      AuthCitizenView.showMessage(result.message);
    }
  },

  submitRegister: async (event) => {

    event.preventDefault();

    const name =
      document.getElementById('citizen-reg-name').value.trim();

    const email =
      document.getElementById('citizen-reg-email').value.trim();

    const password =
      document.getElementById('citizen-reg-password').value;

    const confirm =
      document.getElementById('citizen-reg-confirm').value;

    if (name.length < 2) {
      AuthCitizenView.showMessage(
        'Please enter your full name.'
      );
      return;
    }

    if (password.length < 8) {
      AuthCitizenView.showMessage(
        'Password must contain at least 8 characters.'
      );
      return;
    }

    if (password !== confirm) {
      AuthCitizenView.showMessage(
        'Passwords do not match.'
      );
      return;
    }

    AuthCitizenView.setLoading(
      'citizen-register-submit',
      'citizen-register-submit-label',
      true
    );

    try {

      const response =
        await fetch(
          `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.AUTH_REGISTER}`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name,
              email,
              password
            })
          }
        );

      const data =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        AuthCitizenView.showMessage(
          data.message ||
          'Unable to create your account.'
        );
        return;
      }

      window.app.currentUser =
        data.user || null;

      window.app.setSavedRole(
        data.user ? data.user.role : 'citizen'
      );

      window.location.hash =
        '#/citizen/dashboard';

    } catch (error) {

      console.error(
        'Citizen registration failed:',
        error
      );

      AuthCitizenView.showMessage(
        'Unable to reach the authentication server. Make sure the Flask backend is running on port 5000.'
      );

    } finally {

      AuthCitizenView.setLoading(
        'citizen-register-submit',
        'citizen-register-submit-label',
        false
      );
    }
  },

  togglePassword: (inputId, button) => {

    const input =
      document.getElementById(inputId);

    if (!input) {
      return;
    }

    const visible =
      input.type === 'text';

    input.type =
      visible ? 'password' : 'text';

    button.textContent =
      visible ? 'Show' : 'Hide';

    button.setAttribute(
      'aria-label',
      visible ? 'Show password' : 'Hide password'
    );
  },

  escape: (value) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  init: () => {

    if (window.currentNetworkCanvas) {
      window.currentNetworkCanvas.stop();
      window.currentNetworkCanvas = null;
    }
  }
};

window.AuthCitizenView = AuthCitizenView;
