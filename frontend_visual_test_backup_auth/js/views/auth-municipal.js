/**
 * HydroCybernetics
 * Municipal Authority Authentication View
 *
 * Municipal users do NOT have public registration.
 * They must authenticate using an authorized municipal account.
 */

const AuthMunicipalView = {

  renderLogin: () => `

    <div class="auth-page-container">

      <div class="container">

        <div class="auth-card municipal-auth-card">


          <!-- SECURITY BADGE -->

          <div class="municipal-auth-badge">

            ${Icons.shieldCheck('icon')}

            <span>
              ENGINEERING CONTROL ACCESS
            </span>

          </div>


          <!-- HEADER -->

          <div class="auth-card-header">

            <div class="icon-box icon-box-lg municipal-icon-box">

              ${Icons.municipal('icon')}

            </div>


            <h1 class="auth-card-title">
              Municipal Authority Access
            </h1>


            <p class="auth-card-subtitle">

              Secure access to water-network monitoring,
              simulation and decision-support tools.

            </p>

          </div>


          <!-- LOGIN FORM -->

          <form
            class="auth-form"
            id="municipal-login-form"
            onsubmit="
              AuthMunicipalView.submitLogin(event);
            "
          >


            <!-- MUNICIPAL ID -->

            <div class="form-group">

              <label
                class="form-label"
                for="municipal-id"
              >
                Official Email / Municipal ID
              </label>


              <div class="input-with-icon">

                <span class="input-icon">
                  ${Icons.user('icon')}
                </span>


                <input
                  type="email"
                  id="municipal-id"
                  class="form-input"
                  placeholder="engineer@waterboard.gov.in"
                  autocomplete="username"
                  required
                />

              </div>

            </div>


            <!-- PASSWORD -->

            <div class="form-group">

              <label
                class="form-label"
                for="municipal-password"
              >
                Password
              </label>


              <div class="input-with-icon">

                <span class="input-icon">
                  ${Icons.lock('icon')}
                </span>


                <input
                  type="password"
                  id="municipal-password"
                  class="form-input"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  required
                />

              </div>

            </div>


            <!-- SECURITY NOTICE -->

            <div class="auth-notice-box">

              ${Icons.shield('icon')}

              <span>

                Authorized municipal personnel only.
                All access is logged and auditable.

              </span>

            </div>


            <!-- ERROR MESSAGE -->

            <div
              id="municipal-login-error"
              style="
                display:none;
                margin-top:14px;
              "
            ></div>


            <!-- ACTION -->

            <div class="form-actions">

              <button
                type="submit"
                class="btn btn-primary btn-block"
                id="municipal-login-button"
              >

                ${Icons.shieldCheck('icon')}

                <span>
                  Secure Sign In
                </span>

              </button>

            </div>


          </form>


          <!-- FOOTER -->

          <div class="auth-card-footer">

            <p class="text-xs text-muted">

              Need municipal access credentials?

              <span class="text-accent">
                Contact Department Administrator
              </span>

            </p>

          </div>


        </div>

      </div>

    </div>

  `,


  // ============================================================
  // MUNICIPAL LOGIN
  // ============================================================

  submitLogin: async (event) => {

    event.preventDefault();


    const emailInput =
      document.getElementById(
        'municipal-id'
      );


    const passwordInput =
      document.getElementById(
        'municipal-password'
      );


    const button =
      document.getElementById(
        'municipal-login-button'
      );


    const errorBox =
      document.getElementById(
        'municipal-login-error'
      );


    if (!emailInput || !passwordInput) {

      console.error(
        'HydroCybernetics: Municipal login fields not found.'
      );

      return;

    }


    const email =
      emailInput.value.trim();


    const password =
      passwordInput.value;


    if (!email || !password) {

      AuthMunicipalView.showError(
        'Please enter your municipal email and password.'
      );

      return;

    }


    // ----------------------------------------------------------
    // Disable button while authenticating
    // ----------------------------------------------------------

    if (button) {

      button.disabled = true;

      button.dataset.originalText =
        button.innerHTML;

      button.innerHTML = `

        <span>
          Authenticating...
        </span>

      `;

    }


    if (errorBox) {

      errorBox.style.display =
        'none';

      errorBox.innerHTML = '';

    }


    console.log(
      'HydroCybernetics: Municipal authentication requested.',
      {
        email: email,
        role: 'municipal'
      }
    );


    try {

      const result =
        await window.app.handleAuthSubmit(
          'municipal',
          '#/municipal/dashboard',
          {
            email: email,
            password: password
          }
        );


      console.log(
        'HydroCybernetics: Municipal authentication response.',
        result
      );


      if (!result || !result.ok) {

        AuthMunicipalView.showError(
          result?.message ||
          'Municipal authentication failed.'
        );

        return;

      }


      console.log(
        'HydroCybernetics: Municipal authentication successful.'
      );


      /*
       * handleAuthSubmit() already changes
       * the hash to #/municipal/dashboard.
       */

    } catch (error) {

      console.error(
        'HydroCybernetics: Municipal login failed:',
        error
      );


      AuthMunicipalView.showError(
        error.message ||
        'Unable to authenticate with the municipal server.'
      );

    } finally {

      if (button) {

        button.disabled = false;

        button.innerHTML =
          button.dataset.originalText ||
          `
            ${Icons.shieldCheck('icon')}
            <span>
              Secure Sign In
            </span>
          `;

      }

    }

  },


  // ============================================================
  // ERROR DISPLAY
  // ============================================================

  showError: (message) => {

    const errorBox =
      document.getElementById(
        'municipal-login-error'
      );


    if (!errorBox) {

      alert(message);

      return;

    }


    errorBox.style.display =
      'block';


    errorBox.innerHTML = `

      <div
        class="notice-box-subtle"
        style="
          border-color:rgba(255,80,80,.3);
        "
      >

        <span class="text-xs text-secondary">

          ${AuthMunicipalView.escape(
            message
          )}

        </span>

      </div>

    `;

  },


  // ============================================================
  // ESCAPE HTML
  // ============================================================

  escape: (value) => {

    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  },


  // ============================================================
  // INIT
  // ============================================================

  init: () => {

    if (window.currentNetworkCanvas) {

      window.currentNetworkCanvas.stop();

      window.currentNetworkCanvas =
        null;

    }

  }

};


window.AuthMunicipalView =
  AuthMunicipalView;